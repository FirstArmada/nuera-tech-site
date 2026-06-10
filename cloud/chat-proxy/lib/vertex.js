/* Vertex AI (Gemini) chat loop with function calling.
 * Authentication is via ADC — on Cloud Run this is the runtime service account
 * (roles/aiplatform.user). No API key is read or stored.
 */
import { VertexAI } from '@google-cloud/vertexai';
import { functionDeclarations, resolveTool } from './tools.js';
import { ensureFresh, summary } from './catalog.js';

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT;
const LOCATION = process.env.VERTEX_LOCATION || 'northamerica-northeast1';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 5;

function systemText() {
  const s = summary();
  const cat = s
    ? `You can quote ${s.deviceCount} device models across: ${s.brands.join(', ')}. Repair types: ${s.repairTypes.join(', ')}. Prices are in CAD.`
    : 'Prices are in CAD.';
  return [
    'You are the repair-pricing concierge for Nuera Tech, a phone & tablet repair shop in Guelph, Ontario.',
    'Be warm, concise, and genuinely helpful. ' + cat,
    'RULES:',
    '- NEVER invent prices, savings, SKUs, or device models. Only state a price that a tool returned.',
    '- Use lookup_repair_price for a known model; use find_devices when the model is vague.',
    '- When the customer is ready to book, call get_booking_link and share the WhatsApp link.',
    '- We do same-day repairs with a 90-day parts-and-labour warranty. For anything off-topic or that needs a person, point them to WhatsApp.',
    '- Keep replies to a few sentences. Lead with the cheapest relevant option; mention the saving vs other shops only when the data includes one.',
  ].join('\n');
}

let cachedModel = null;
function getModel() {
  if (cachedModel) return cachedModel;
  if (!PROJECT) throw new Error('GOOGLE_CLOUD_PROJECT (or VERTEX_PROJECT) is not set');
  const vertex = new VertexAI({ project: PROJECT, location: LOCATION });
  cachedModel = vertex.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'system', parts: [{ text: systemText() }] },
    tools: [{ functionDeclarations }],
    generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
  });
  return cachedModel;
}

// Map client messages → Vertex history, ensuring it starts with a user turn.
function toHistory(messages) {
  const hist = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '') }],
  }));
  while (hist.length && hist[0].role !== 'user') hist.shift();
  return hist;
}

export async function runAssistant(messages) {
  await ensureFresh(); // load catalog before building the system prompt
  const full = toHistory(messages);
  if (!full.length) return { text: '' };

  const chat = getModel().startChat({ history: full.slice(0, -1) });
  let result = await chat.sendMessage(full[full.length - 1].parts);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const parts = result.response?.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);
    if (!calls.length) break;
    const responses = await Promise.all(
      calls.map(async (call) => {
        const out = await resolveTool(call.name, call.args || {});
        return { functionResponse: { name: call.name, response: out } };
      })
    );
    result = await chat.sendMessage(responses);
  }

  const parts = result.response?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === 'string').map((p) => p.text).join('').trim();
  return { text: text || "Sorry, I didn't catch that — could you rephrase, or reach us on WhatsApp?" };
}
