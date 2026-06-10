const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const html = `<a class="nt-chat-wa" href="https://wa.me/12345&quot;onclick=&quot;alert(1)" target="_blank" rel="noopener">Book on WhatsApp</a>`;
document.getElementById('test').innerHTML = html;
console.log(document.getElementById('test').querySelector('a').getAttribute('href'));
console.log(document.getElementById('test').querySelector('a').getAttribute('onclick'));
