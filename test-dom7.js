const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const q = '<script>alert(1)</script>';

const countText = `“${q}”`;
document.getElementById('test').innerHTML = countText;
console.log(document.getElementById('test').innerHTML);
