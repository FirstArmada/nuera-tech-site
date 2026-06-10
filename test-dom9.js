const { JSDOM } = require("jsdom");
const dom = new JSDOM(`<!DOCTYPE html><div id="test"></div>`);
const document = dom.window.document;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const stats = { maxSaving: 100, avgPct: 50, top: [{ chip: 'screen', repair_type: 'screen repair', mk_price: 200, model: 'iPhone 13 <script>alert(1)</script>', price: 100, savings: 100 }] };
const best = stats.top[0];
const CHIP_LABEL = { screen: 'Screen' };
const moneyExact = (n) => n;
const money = (n) => n;

const headline = `Why pay ${moneyExact(best.mk_price)} elsewhere for a ${best.model} ${what}?`;
console.log(headline);
