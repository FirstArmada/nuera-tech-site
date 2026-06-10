const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const waLink = (text) => `https://wa.me/12269784666?text=${encodeURIComponent(text)}`;
const state_q = 'test" onclick="alert(1)';

const html = `
      <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <p class="empty-title">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" href="${waLink('Hi Nuera Tech! Do you repair: ' + (state_q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>`;

document.getElementById('test').innerHTML = html;
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));

const htmlEscaped = `
      <span class="empty-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
      <p class="empty-title">No devices match.</p>
      <p>Try a different model, or message us — we repair more than we can list.</p>
      <a class="btn btn-wa" href="${waLink('Hi Nuera Tech! Do you repair: ' + (state_q || 'my device') + '?')}" target="_blank" rel="noopener">Ask on WhatsApp</a>`;
document.getElementById('test').innerHTML = htmlEscaped;
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));

const htmlTest = `<a href="https://wa.me/12269784666?text=Hi%20Nuera%20Tech!%20Do%20you%20repair%3A%20test%22%20onclick%3D%22alert(1)%3F">test</a>`;
document.getElementById('test').innerHTML = htmlTest;
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));
