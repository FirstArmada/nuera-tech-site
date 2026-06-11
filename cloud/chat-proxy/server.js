/* Nuera Tech chat proxy — Cloud Run service.
 * POST /chat  → Server-Sent Events stream of the assistant's reply.
 * GET  /healthz → liveness probe.
 *
 * The browser talks to this service (whitelisted in the site CSP connect-src).
 * Vertex credentials live here via ADC; nothing secret reaches the client.
 */
import express from 'express';
import cors from 'cors';
import { runAssistant } from './lib/vertex.js';
import { createRateLimiter } from './lib/ratelimit.js';

const PORT = process.env.PORT || 8080;
const ALLOWED = new Set((process.env.ALLOWED_ORIGINS || 'https://nuera.talha-k.com')
  .split(',').map((s) => s.trim()).filter(Boolean));
const MAX_MSG_LEN = 1000;
const MAX_TURNS = 12;

const allow = createRateLimiter({ capacity: 20, refillPerSec: 20 / 60 });

const app = express();
app.set('trust proxy', 1); // Trust Cloud Run (1 hop) to reliably set req.ip
app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use(cors({
  origin(origin, cb) {
    // Allow same-origin/no-origin (curl, health checks) and whitelisted sites only.
    if (!origin || ALLOWED.has(origin)) return cb(null, true);
    cb(new Error('origin not allowed'));
  },
  methods: ['POST'],
}));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/chat', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!allow(ip)) return res.status(429).json({ error: 'Too many requests — please slow down.' });

  let messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || !messages.length) return res.status(400).json({ error: 'messages[] required' });
  messages = messages.slice(-MAX_TURNS)
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, MAX_MSG_LEN) }));
  if (!messages.length) return res.status(400).json({ error: 'no valid messages' });

  // Stream the reply as SSE.
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
  res.flushHeaders?.();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const { text } = await runAssistant(messages);
    // Emit in small word groups so the widget renders progressively.
    const words = text.split(/(\s+)/);
    for (let i = 0; i < words.length; i += 3) send({ delta: words.slice(i, i + 3).join('') });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[chat] error:', err?.message || err);
    if (!res.headersSent) return res.status(500).json({ error: 'assistant unavailable' });
    send({ error: 'assistant unavailable' });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

app.listen(PORT, () => console.log(`nuera-chat-proxy on :${PORT} — ${ALLOWED.size} allowed origin(s)`));
