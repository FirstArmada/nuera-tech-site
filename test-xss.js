const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const logEl = document.getElementById('test');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function addMsg(role, html) {
  const el = document.createElement('div');
  el.className = `nt-chat-msg ${role}`;
  el.innerHTML = html;
  logEl.appendChild(el);
  return el;
}

addMsg('user', esc('User input <script>alert("xss")</script>'));
console.log("LOG:", logEl.innerHTML);

function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) =>
    `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`);
}

const botHtml = renderReply('Bot reply with url https://wa.me/12345"onclick="alert(1)');
addMsg('bot', botHtml);
console.log("LOG 2:", logEl.innerHTML);
