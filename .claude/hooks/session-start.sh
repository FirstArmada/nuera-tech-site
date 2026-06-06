#!/bin/bash
#
# SessionStart hook — nuera-tech-site (Claude Code on the web)
#
# This repo is a static single-page site with no package manager, build step,
# or test suite, so there are no dependencies to install. Instead this hook
# confirms the verification toolchain (node) and sanity-checks the critical
# artifacts when a web session starts, surfacing a corrupt file the moment a
# session begins. Checks are non-fatal (warn only) so a session can still start
# in order to fix them.
#
# It supports both site layouts so it stays correct regardless of which open
# PR lands first:
#   * current — all JS lives inline in <script> blocks in index.html.
#   * rehaul  — JS lives in assets/js/app.js (loaded as type="module") + sw.js,
#               index.html holds only <script type="application/ld+json"> data
#               blocks under a strict script-src 'self' CSP, and a PWA
#               manifest.webmanifest is present.
#
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment; local sessions
# already have node and don't need the startup sanity check.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Use the harness-provided project dir when present; otherwise derive the repo
# root from this script's location (.claude/hooks/ -> repo root) so the hook is
# also runnable standalone.
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# node is the project's only verification tool (node --check + JSON.parse).
if ! command -v node >/dev/null 2>&1; then
  echo "WARNING: node not found — JS syntax checks and JSON validation unavailable." >&2
  exit 0
fi
echo "node $(node --version) available for verification."

# "test": validate the JSON artifacts the site depends on. pricing-data.json is
# always required; manifest.webmanifest exists only in the rehauled PWA layout.
for json in pricing-data.json manifest.webmanifest; do
  [ -f "$json" ] || continue
  if node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$json" 2>/dev/null; then
    echo "$json: valid JSON OK"
  else
    echo "WARNING: $json is not valid JSON — fix before deploying." >&2
  fi
done

# "lint": syntax-check every executable JS artifact that exists, in either layout:
#   - inline <script> blocks in index.html (skipping src= and non-JS types such
#     as application/ld+json), parsed with vm.Script;
#   - real JS files assets/js/**/*.js and sw.js, parsed with node --check
#     (module-aware for files that use import/export).
# Each artifact is reported individually and the whole step is non-fatal.
node - <<'NODE'
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

let checked = 0, failed = 0, tmpDir = null;

function ok(label) { console.log("  " + label + ": syntax OK"); checked++; }
function bad(label, err) {
  const msg = String(err && err.message ? err.message : err).split("\n")[0];
  console.error("  WARNING: " + label + " failed syntax check — " + msg);
  checked++; failed++;
}

// Syntax-check a JS file path. node --check treats .js as CommonJS, so route
// files that use static import/export through a temp .mjs (always a module).
function checkFile(file) {
  const code = fs.readFileSync(file, "utf8");
  if (/^[ \t]*(import|export)\b/m.test(code)) {
    if (!tmpDir) tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nuera-lint-"));
    const mjs = path.join(tmpDir, "m.mjs");
    fs.writeFileSync(mjs, code);
    execFileSync(process.execPath, ["--check", mjs], { stdio: "pipe" });
  } else {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  }
}

// 1. Inline executable <script> blocks in index.html.
const EXEC_TYPES = new Set(["", "text/javascript", "application/javascript",
  "text/ecmascript", "module"]);
if (fs.existsSync("index.html")) {
  const html = fs.readFileSync("index.html", "utf8");
  let n = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || "", body = m[2] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;                 // external script
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = (tm ? tm[1] : "").toLowerCase();
    if (!EXEC_TYPES.has(type)) continue;                    // e.g. application/ld+json
    if (!body.trim()) continue;
    const label = "index.html inline <script> #" + (++n);
    // Module scripts (type=module or static import/export) aren't parseable by
    // vm.Script (CommonJS); route them through `node --check` on a temp .mjs.
    const isModule = type === "module" || /^[ \t]*(import|export)\b/m.test(body);
    try {
      if (isModule) {
        if (!tmpDir) tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nuera-lint-"));
        const mjs = path.join(tmpDir, "inline.mjs");
        fs.writeFileSync(mjs, body);
        execFileSync(process.execPath, ["--check", mjs], { stdio: "pipe" });
      } else {
        new vm.Script(body);
      }
      ok(label);
    } catch (e) { bad(label, e.stderr ? e.stderr.toString() : e); }
  }
}

// 2. Real JS files: assets/js/**/*.js plus a root sw.js (rehauled layout).
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith(".js")) out.push(p);
  }
  return out;
}
const jsFiles = walk("assets/js", []);
if (fs.existsSync("sw.js")) jsFiles.push("sw.js");
for (const f of jsFiles) {
  try { checkFile(f); ok(f); }
  catch (e) { bad(f, e.stderr ? e.stderr.toString() : e); }
}

if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });

if (checked === 0) {
  console.error("  WARNING: no executable JS artifacts found to syntax-check.");
} else {
  console.log("  lint: " + checked + " JS artifact(s) checked, " + failed + " failed.");
}
NODE

echo "Session start hook complete — nuera-tech-site ready (static site, no deps to install)."
