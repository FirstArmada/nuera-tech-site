const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) =>
    `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`);
}

document.getElementById('test').innerHTML = renderReply('Check out this link: https://wa.me/12345"onclick="alert(1)');
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));
