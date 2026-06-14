/* Nuera Tech — Brand Concept board interactions.
 * Build-less, dependency-free ES module (external per the site CSP: script-src 'self').
 * Kept independent from brand.js so the two brand pages stay separate.
 *   chrome: footer year · mobile nav · header scrolled state · scroll-progress · aria-live toast
 *   deck:   scroll-reveal (IntersectionObserver) · sticky sub-nav highlight · copy swatch/prompt
 */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Footer year */
const yr = $('#year');
if (yr) yr.textContent = new Date().getFullYear();

/* Mobile nav toggle */
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

/* Header scrolled state */
const header = $('.header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

/* Reading-progress bar */
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

/* Toast */
const toast = $('#bc-toast');
let toastTimer;
function flash(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

/* Copy-to-clipboard: colour fields ([data-copy]) + the image-gen prompt */
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    flash(label || 'Copied ' + text);
  } catch {
    flash('Press ⌘/Ctrl+C to copy');
  }
}
$$('[data-copy]').forEach((el) => {
  el.addEventListener('click', () => copyText(el.getAttribute('data-copy')));
});
const copyPromptBtn = $('#copy-prompt');
const promptText = $('#prompt-text');
if (copyPromptBtn && promptText) {
  copyPromptBtn.addEventListener('click', () => copyText(promptText.textContent, 'Prompt copied'));
}

/* Per-section image prompts: any [data-copy-target] copies the textContent of the element it points to */
$$('[data-copy-target]').forEach((btn) => {
  const target = $(btn.getAttribute('data-copy-target'));
  if (target) btn.addEventListener('click', () => copyText(target.textContent, 'Prompt copied'));
});

/* Image slots: reveal the dropped-in <img> once it has a real src (no src = no network request) */
$$('[data-slot]').forEach((slot) => {
  const img = slot.querySelector('img');
  if (!img) return;
  const reveal = () => { if (img.getAttribute('src')) slot.classList.add('has-img'); };
  reveal();
  img.addEventListener('load', reveal);
});

/* Scroll-reveal */
const revealEls = $$('.bc-reveal');
if (reduceMotion() || !('IntersectionObserver' in window)) {
  revealEls.forEach((el) => el.classList.add('in'));
} else {
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
  );
  revealEls.forEach((el) => io.observe(el));
}

/* Sticky sub-nav active-section highlight */
const subnavLinks = $$('.bc-subnav a');
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
  $$('.bc-slide[id]').forEach((s) => io.observe(s));
}
