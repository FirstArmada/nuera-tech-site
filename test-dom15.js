const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Or stop at &
function renderReply(text) {
  const safe = esc(text).replace(/\n/g, '<br>');
  // If we stop at &, legitimate URLs with query params (e.g. &text=...) will be truncated
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) => {
    // but the input is escaped, so & is &amp;! Let's check what a legitimate URL looks like
    console.log("url matched:", url);
    return `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`;
  });
}
// But wait! if the bot sends https://wa.me/12345?text=Hello&World
// it will be escaped to https://wa.me/12345?text=Hello&amp;World
renderReply('link: https://wa.me/12345?text=Hello&World');
