const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const waLink = (text) => `https://wa.me/12269784666?text=${encodeURIComponent(text)}`;
const state = { q: 'test" onclick="alert(1)' };

const html = `
      <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <p class="empty-title">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" href="${waLink('Hi Nuera Tech! Do you repair: ' + (state.q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>`;

document.getElementById('test').innerHTML = html;
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));
console.log("OUTER:", document.getElementById('test').querySelector('a').outerHTML);
