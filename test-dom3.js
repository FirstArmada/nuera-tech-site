const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  // Note: Since text is escaped, https://wa.me/12345"onclick="alert(1) becomes https://wa.me/12345&quot;onclick=&quot;alert(1)
  // Which matches the regex. The replacement inserts url which contains &quot;
  // <a class="nt-chat-wa" href="https://wa.me/12345&quot;onclick=&quot;alert(1)" ...
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) =>
    `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`);
}

const input = 'Check out this link: https://wa.me/12345"onclick="alert(1)';
const output = renderReply(input);
console.log("RENDERED HTML:", output);
document.getElementById('test').innerHTML = output;

console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));
console.log("OUTER:", document.getElementById('test').querySelector('a').outerHTML);
