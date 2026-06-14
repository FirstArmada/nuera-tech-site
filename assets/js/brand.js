/* Nuera Tech — Brand Book page interactions.
 * Build-less, dependency-free ES module (loaded external per the site CSP: script-src 'self').
 * Mirrors the helpers/patterns used in app.js so the page feels native:
 *   $/$$ DOM helpers · header scrolled state · scroll-progress bar · aria-live toast.
 * Page-specific: click-to-copy swatches, a WCAG contrast checker, a logo background previewer.
 */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Footer year */
const yr = $('#year');
if (yr) yr.textContent = new Date().getFullYear();

/* Mobile nav toggle (mirrors index.html's #nav-toggle behaviour) */
const navToggle = $('#nav-toggle');
const mobileNav = $('#mobile-nav');
if (navToggle && mobileNav) {
  const setOpen = (open) => {
    if (open) mobileNav.removeAttribute('hidden');
    else mobileNav.setAttribute('hidden', '');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  navToggle.addEventListener('click', () => setOpen(mobileNav.hasAttribute('hidden')));
  $$('a', mobileNav).forEach((a) => a.addEventListener('click', () => setOpen(false)));
}

/* Header gains .scrolled past a few px (matches the main site's sticky header) */
const header = $('.header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

/* Reading-progress bar — scaleX driven by --p (0–1) */
const progress = $('#scroll-progress-bar');
if (progress) {
  const update = () => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    progress.style.setProperty('--p', max > 0 ? (el.scrollTop / max).toFixed(4) : 0);
  };
  update();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
}

/* Toast (single aria-live region, mirrors app.js flash()) */
const toast = $('#bb-toast');
let toastTimer;
function flash(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

/* Click-to-copy — any element carrying [data-copy] copies its value */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    flash('Copied ' + text);
  } catch {
    flash('Press ⌘/Ctrl+C to copy');
  }
}
$$('[data-copy]').forEach((el) => {
  el.addEventListener('click', () => copyText(el.getAttribute('data-copy')));
});

/* Sticky sub-nav active-section highlight */
const subnavLinks = $$('.bb-subnav a');
if (subnavLinks.length && 'IntersectionObserver' in window) {
  const linkFor = (id) => subnavLinks.find((a) => a.getAttribute('href') === '#' + id);
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        subnavLinks.forEach((a) => a.removeAttribute('aria-current'));
        const link = linkFor(entry.target.id);
        if (link) link.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );
  $$('.bb-section[id]').forEach((s) => io.observe(s));
}

/* Logo background previewer (roving single-select) */
const stage = $('#bb-logo-stage');
const stageBtns = $$('[data-stage-bg]');
stageBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    stageBtns.forEach((b) => b.setAttribute('aria-checked', 'false'));
    btn.setAttribute('aria-checked', 'true');
    if (stage) stage.style.background = btn.getAttribute('data-stage-bg');
  });
});
/* Initialise the previewer to suit the active theme (light → White, dark → Ink 800) so the
   big stage integrates with the page instead of defaulting dark on the light theme. */
if (stage && stageBtns.length) {
  const want = document.documentElement.dataset.theme === 'light' ? '#f4f6ff' : '#0c0d16';
  const initBtn = stageBtns.find((b) => b.getAttribute('data-stage-bg') === want) || stageBtns[0];
  stageBtns.forEach((b) => b.setAttribute('aria-checked', String(b === initBtn)));
  stage.style.background = initBtn.getAttribute('data-stage-bg');
}

/* ---- WCAG contrast checker ---- */
function relLuminance(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const channel = (i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
function contrastRatio(fg, bg) {
  const a = relLuminance(fg) + 0.05;
  const b = relLuminance(bg) + 0.05;
  return Math.max(a, b) / Math.min(a, b);
}

let fgColor = '#f4f6ff';
let bgColor = '#07070c';
const ratioEl = $('#bb-ratio');
const previewEl = $('#bb-preview');

function setBadge(id, pass) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle('pass', pass);
  el.classList.toggle('fail', !pass);
  const s = el.querySelector('.s');
  if (s) s.textContent = pass ? 'Pass' : 'Fail';
}
function renderContrast() {
  const ratio = contrastRatio(fgColor, bgColor);
  if (ratioEl) ratioEl.innerHTML = ratio.toFixed(2) + ' : 1<span>contrast ratio</span>';
  if (previewEl) {
    previewEl.style.background = bgColor;
    previewEl.style.color = fgColor;
  }
  setBadge('#bb-aa-lg', ratio >= 3);
  setBadge('#bb-aa', ratio >= 4.5);
  setBadge('#bb-aaa', ratio >= 7);
}
$$('[data-fg]').forEach((btn) => {
  btn.addEventListener('click', () => {
    fgColor = btn.getAttribute('data-fg');
    $$('[data-fg]').forEach((b) => b.setAttribute('aria-checked', 'false'));
    btn.setAttribute('aria-checked', 'true');
    renderContrast();
  });
});
$$('[data-bg]').forEach((btn) => {
  btn.addEventListener('click', () => {
    bgColor = btn.getAttribute('data-bg');
    $$('[data-bg]').forEach((b) => b.setAttribute('aria-checked', 'false'));
    btn.setAttribute('aria-checked', 'true');
    renderContrast();
  });
});
renderContrast();
