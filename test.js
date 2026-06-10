const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;

function renderReply(text) {
  // Use regex to find links and build HTML string
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return safe.replace(/https:\/\/wa\.me\/\d+[^\s<]*/g, (url) => {
      // url here is escaped already, but if it has attributes injected?
      return `<a class="nt-chat-wa" href="${url}" target="_blank" rel="noopener">Book on WhatsApp</a>`
  });
}
