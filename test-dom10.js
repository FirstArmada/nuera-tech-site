const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// simulating index.html structure
const indexHtml = `
<div id="grid"></div>
<div id="emptyEl"></div>
`;
document.body.innerHTML = indexHtml;

const emptyEl = document.getElementById('emptyEl');
const q = 'my device" onclick="alert(1)';
const state_q = q;
const waLink = (text) => `https://wa.me/12269784666?text=${encodeURIComponent(text)}`;

emptyEl.innerHTML = `
  <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
  <p class="empty-title">No devices match.</p>
  <p>Try a different model, or message us — we repair more than we can list.</p>
  <a class="btn btn-wa" href="${waLink('Hi Nuera Tech! Do you repair: ' + (state_q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>`;

console.log(emptyEl.innerHTML);
console.log(emptyEl.querySelector('a').getAttribute('href'));
