# Bolt's Journal — Critical Performance Learnings

Codebase: nuera-tech-site. Static single-page site (no build step, no package.json).
- `index.html` contains all CSS + JS inline.
- `pricing-data.json` (~120KB, 435 repair lines) is fetched client-side and grouped into device cards (~153 unique models).
- No npm scripts / test suite. "Verify" = JS syntax check via `node --check` on the extracted script + manual reasoning.

---
