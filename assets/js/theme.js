/* Nuera Tech — theme bootstrap.
 * Loaded as a BLOCKING <script src> in <head> (before the inline <style>) so the
 * data-theme attribute is on <html> before first paint — no dark→light flash. It is a
 * same-origin external file because the site CSP is `script-src 'self'` (no inline JS).
 * Shared verbatim by index.html, brand.html and brand-concept.html.
 *
 * Model: first visit follows the OS (prefers-color-scheme); the in-header toggle overrides
 * and PERSISTS the choice (localStorage). While the user has made no explicit choice we keep
 * following the OS live. No-JS → no data-theme → the base :root (dark) applies.
 */
(function () {
  var KEY = 'nuera-theme';
  var BG = { dark: '#07070c', light: '#f6f7fb' }; // must match --color-bg per theme

  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) { return null; }
  }
  function systemLight() {
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  }

  // --- Pre-paint: resolve + apply synchronously ---
  var theme = stored() || (systemLight() ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  syncMeta(theme);

  function syncMeta(t) {
    var tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', BG[t]);
    var cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.setAttribute('content', t);
  }

  function apply(t, persist) {
    document.documentElement.dataset.theme = t;
    syncMeta(t);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', String(t === 'light'));
      var label = t === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
    if (persist) { try { localStorage.setItem(KEY, t); } catch (e) {} }
  }

  // --- Wire the toggle + live OS-following once the DOM exists ---
  document.addEventListener('DOMContentLoaded', function () {
    apply(document.documentElement.dataset.theme, false); // sync the toggle's aria on load

    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function () {
        apply(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', true);
      });
    }

    // Keep following the OS as it changes — but only until the user has chosen explicitly.
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-color-scheme: light)');
      var onChange = function (e) { if (!stored()) apply(e.matches ? 'light' : 'dark', false); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  });
})();
