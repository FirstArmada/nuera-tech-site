const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const html = `<a href="https://wa.me/12345&quot; onclick=&quot;alert(1)">Test</a>`;
document.getElementById('test').innerHTML = html;
console.log("HREF:", document.getElementById('test').querySelector('a').getAttribute('href'));
console.log("ONCLICK:", document.getElementById('test').querySelector('a').getAttribute('onclick'));
console.log("OUTER:", document.getElementById('test').querySelector('a').outerHTML);
