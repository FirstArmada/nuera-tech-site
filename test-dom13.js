const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// What if the regex matches quotes that were escaped?
// If we decode them back to quotes?
function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  // the regex matches up to space or <.
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) => {
    console.log("url:", url);
    return `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`;
  });
}
renderReply('link: https://wa.me/12345"onclick="alert(1)');
