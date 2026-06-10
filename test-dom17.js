const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// What if the regex is stopped at &quot;?
function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  // Exclude &quot; and &#39; by just excluding quotes in the matching phase.
  // Wait, if it's already escaped, it's matching literal characters.
  // We can exclude &quot; using negative lookahead or just excluding `&quot;` by match pattern.
  return safe.replace(/https:\/\/wa\.me\/\d+(?:(?!&quot;|&lt;|&#39;)[^\s<])*/g, (url) => {
    console.log("url:", url);
    return `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`;
  });
}
renderReply('link: https://wa.me/12345"onclick="alert(1)');
renderReply("link: https://wa.me/12345'onclick='alert(1)");
renderReply('link: https://wa.me/12345?text=Hello&World');
renderReply('link: https://wa.me/12345<script>alert(1)</script>');
