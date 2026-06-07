/* Nuera Tech — AI assistant widget.
 *
 * A self-contained chat launcher that talks to the Cloud Run proxy. The proxy
 * holds the Vertex AI (Gemini) credentials via ADC — no key ever ships to the
 * browser. Answers are grounded in the same /pricing-data.json the page renders,
 * so quotes here match the on-page prices (Rule 1).
 *
 * The WhatsApp number is NOT hardcoded here: we read it from an existing booking
 * link in the DOM so it stays defined once, in app.js / the static markup (Rule 2).
 *
 * The widget is purely additive: a launcher button in the .fab stack plus a
 * dialog panel that is `hidden` until opened. It never touches the finder/grid/
 * modal state, so the existing UI and its tests are unaffected.
 */
const CHAT_ENDPOINT = 'https://chat.nuera.talha-k.com/chat';
const MAX_TURNS = 12; // trim history to bound proxy cost / prompt size

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Read the shop's WhatsApp number from an existing link so it lives in one place.
function waHref(text) {
  const a = document.querySelector('[data-wa], a[href*="wa.me/"]');
  const m = a && a.getAttribute('href') && a.getAttribute('href').match(/wa\.me\/(\d+)/);
  const num = m ? m[1] : '';
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

// Escape text, then upgrade any wa.me links the assistant returns into buttons.
function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) =>
    `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`);
}

const STYLE = `
.nt-chat-launch{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;border:1px solid rgba(255,255,255,.14);
  background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#0b0b12;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.45)}
.nt-chat-launch svg{width:26px;height:26px}
.nt-chat-launch:focus-visible{outline:2px solid #c4b5fd;outline-offset:3px}
.nt-chat-panel{position:fixed;z-index:80;right:18px;bottom:18px;width:min(380px,calc(100dvw - 28px));height:min(560px,calc(100dvh - 36px));
  display:flex;flex-direction:column;background:#0f0d18;color:#f4f4f8;border:1px solid rgba(255,255,255,.12);
  border-radius:18px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.6)}
.nt-chat-panel[hidden]{display:none}
.nt-chat-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);
  background:linear-gradient(135deg,rgba(139,92,246,.22),rgba(34,211,238,.14))}
.nt-chat-head b{font-size:.98rem}
.nt-chat-head .nt-chat-sub{font-size:.74rem;color:#b9b9c6}
.nt-chat-x{margin-left:auto;background:none;border:0;color:#f4f4f8;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}
.nt-chat-x:hover{background:rgba(255,255,255,.08)}
.nt-chat-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.nt-chat-msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:.9rem;line-height:1.45;white-space:normal;word-wrap:break-word}
.nt-chat-msg.user{align-self:flex-end;background:#2a2440;border:1px solid rgba(196,181,253,.3)}
.nt-chat-msg.bot{align-self:flex-start;background:#16151f;border:1px solid rgba(255,255,255,.08)}
.nt-chat-wa{display:inline-block;margin-top:8px;padding:7px 12px;border-radius:10px;background:#34d399;color:#000;
  font-weight:700;text-decoration:none;font-size:.82rem}
.nt-chat-form{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.1)}
.nt-chat-form input{flex:1;min-width:0;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.14);
  background:#16151f;color:#f4f4f8;font:inherit;font-size:.9rem}
.nt-chat-form input:focus-visible{outline:2px solid #8b5cf6;outline-offset:1px}
.nt-chat-form button{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;border:0;cursor:pointer;
  background:linear-gradient(135deg,#8b5cf6,#22d3ee);color:#0b0b12}
.nt-chat-form button:disabled{opacity:.5;cursor:not-allowed}
.nt-chat-form button svg{width:20px;height:20px}
@media (prefers-reduced-motion: no-preference){.nt-chat-dots span{animation:nt-blink 1.2s infinite}}
.nt-chat-dots span:nth-child(2){animation-delay:.2s}.nt-chat-dots span:nth-child(3){animation-delay:.4s}
@keyframes nt-blink{0%,60%,100%{opacity:.25}30%{opacity:1}}
`;

const state = { open: false, busy: false, history: [] };
let panel, logEl, inputEl, sendEl, launchEl, lastFocus;

function init() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
  buildLauncher();
  buildPanel();
}

function buildLauncher() {
  launchEl = document.createElement('button');
  launchEl.type = 'button';
  launchEl.className = 'nt-chat-launch';
  launchEl.setAttribute('aria-label', 'Ask Nuera — repair pricing assistant');
  launchEl.setAttribute('aria-haspopup', 'dialog');
  launchEl.setAttribute('aria-expanded', 'false');
  launchEl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>';
  launchEl.addEventListener('click', openPanel);
  const fab = document.querySelector('.fab');
  if (fab) fab.insertBefore(launchEl, fab.firstChild);
  else document.body.appendChild(launchEl);
}

function buildPanel() {
  panel = document.createElement('div');
  panel.className = 'nt-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', 'Nuera repair assistant');
  panel.hidden = true;
  panel.innerHTML = `
    <div class="nt-chat-head">
      <div>
        <b>Nuera assistant</b>
        <div class="nt-chat-sub">Live pricing · same-day repairs · Guelph</div>
      </div>
      <button class="nt-chat-x" type="button" aria-label="Close chat">&times;</button>
    </div>
    <div class="nt-chat-log" id="nt-chat-log" aria-live="polite" aria-atomic="false"></div>
    <form class="nt-chat-form">
      <input type="text" autocomplete="off" maxlength="1000"
        aria-label="Ask about a repair price" placeholder="e.g. iPhone 14 screen price?">
      <button type="submit" aria-label="Send message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>
      </button>
    </form>`;
  document.body.appendChild(panel);

  logEl = panel.querySelector('#nt-chat-log');
  inputEl = panel.querySelector('input');
  sendEl = panel.querySelector('button[type="submit"]');
  panel.querySelector('.nt-chat-x').addEventListener('click', closePanel);
  panel.querySelector('form').addEventListener('submit', onSubmit);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) closePanel(); });

  addBot("Hi! I'm Nuera's repair assistant. Tell me your device and what's wrong — I'll look up the price and help you book.");
}

function openPanel() {
  lastFocus = document.activeElement;
  panel.hidden = false;
  state.open = true;
  launchEl.setAttribute('aria-expanded', 'true');
  // Hide the FAB stack while open so its buttons (WhatsApp / back-to-top / this
  // launcher) don't overlap the panel's input. Restored on close.
  toggleFab(false);
  inputEl.focus();
}

function closePanel() {
  panel.hidden = true;
  state.open = false;
  launchEl.setAttribute('aria-expanded', 'false');
  toggleFab(true);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

// Show/hide the shared .fab stack the launcher lives in (no-op if the launcher
// was appended straight to <body> because no .fab existed).
function toggleFab(show) {
  const fab = launchEl.closest('.fab');
  if (fab) fab.style.display = show ? '' : 'none';
}

function addMsg(role, html) {
  const el = document.createElement('div');
  el.className = `nt-chat-msg ${role}`;
  el.innerHTML = html;
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
  return el;
}
const addBot = (text) => addMsg('bot', renderReply(text));

async function onSubmit(e) {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text || state.busy) return;
  inputEl.value = '';
  setBusy(true);
  addMsg('user', esc(text));
  state.history.push({ role: 'user', content: text });

  const bot = addMsg('bot', '<span class="nt-chat-dots"><span>•</span><span>•</span><span>•</span></span>');
  let acc = '';
  try {
    await streamChat(state.history.slice(-MAX_TURNS), (delta) => {
      acc += delta;
      bot.innerHTML = renderReply(acc);
      logEl.scrollTop = logEl.scrollHeight;
    });
    if (!acc) throw new Error('empty');
    state.history.push({ role: 'assistant', content: acc });
  } catch (err) {
    bot.innerHTML = renderReply(
      "Sorry — I couldn't reach the assistant just now. You can message us directly and we'll quote you fast:\n"
      + waHref("Hi Nuera Tech! I'd like a repair quote."));
  } finally {
    setBusy(false);
    inputEl.focus();
  }
}

function setBusy(b) {
  state.busy = b;
  sendEl.disabled = b;
  inputEl.disabled = b;
}

async function streamChat(messages, onDelta) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const obj = JSON.parse(payload);
        if (obj.error) throw new Error(obj.error);
        if (obj.delta) onDelta(obj.delta);
      } catch (_) { /* tolerate keep-alive / partial frames */ }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
