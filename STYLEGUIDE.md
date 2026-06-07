# Nuera Tech — Design System

The shared visual foundation for the site: design tokens, typography, and the base
UI primitives (Button, Badge/Pill, Card, Section). This document is the contract
for everyone working on the front end — reference these tokens and classes in new
code instead of hard-coding values.

> **Foundation (2026 refresh).** The OG Nuera dark-neon palette is preserved, but the
> *bones* now follow the **TELUS/UDS (Allium)** system: Inter on the four-weight scale
> (300/400/500/700), the 4px spacing + Allium radius scale, TELUS 250/300ms motion, the
> semantic-token architecture, and Allium iconography. The display weight is **300** with
> the brand gradient; there is **one unified action green** (`#34d399`, solid — savings +
> WhatsApp) and a **sharper danger red** (`#ef4444`). **Dark-only — there is no light
> theme.** Source: Claude Design handoff (`nuera-tech-design-system`).

## Scope & architecture

The site is intentionally **build-less**: no framework, bundler, or `node_modules`.
**All CSS lives in one inline `<style>` block in [`index.html`](./index.html)**
(the `:root` token block comes first, then base elements, then primitives, then
sections). It stays inline on purpose — zero render-blocking, and it satisfies the
strict CSP (`style-src 'self' 'unsafe-inline'`). Add new global styles/tokens to
that block; do not introduce an external stylesheet without revisiting the
performance/CSP trade-off.

All JS is self-hosted under `/assets/js`; there are **no third-party scripts** and the CSP stays
`script-src 'self'` (mirrored in `vercel.json` + `_headers`). Motion is hand-rolled in vanilla
(see *Motion & animation layer*). Don't add external script origins without revisiting the CSP.

The token system is **layered** so it can evolve without breaking anything:

```
primitives (raw palette)  →  semantic tokens  →  scales  →  legacy aliases
--c-purple-500               --color-accent      --space-4   --purple, --bg, --radius …
```

New code should use the **semantic** and **scale** tokens. The **legacy aliases**
(`--bg`, `--text`, `--purple`, `--panel`, `--radius`, `--grad`, …) are retained
because existing rules and runtime-generated markup reference them — they now
simply point at the semantic tokens.

---

## Token reference

### Color — primitives → semantic

| Semantic token | Value (via primitive) | Use for |
|---|---|---|
| `--color-bg` | `#07070c` | Page background |
| `--color-bg-raised` | `#0c0d16` | Raised background (aurora floor) |
| `--color-surface-1` | `rgba(255,255,255,.045)` | Base glass panel |
| `--color-surface-2` | `rgba(255,255,255,.07)` | Raised glass panel |
| `--color-surface-3` | `rgba(255,255,255,.10)` | Solid-ish fill (e.g. secondary button) |
| `--color-border` | `rgba(255,255,255,.10)` | Default hairline border |
| `--color-border-strong` | `rgba(255,255,255,.16)` | Emphasized / interactive border |
| `--color-text-primary` | `#f4f6ff` | Primary text |
| `--color-text-secondary` | `#9fa9bd` | Secondary / muted text |
| `--color-text-tertiary` | `#8794ab` | Tertiary / placeholder text |
| `--color-accent` | `#8b5cf6` | Brand purple |
| `--color-accent-soft` | `#c4b5fd` | Light purple (gradient start, focus ring) |
| `--color-accent-2` | `#22d3ee` | Brand cyan |
| `--color-on-accent` | `#0a0a12` | Text on accent/gradient fills |
| `--color-success` | `#34d399` | Success / savings |
| `--color-success-text` | `#34d399` | Success text on dark (unified action green) |
| `--color-on-success` | `#04130c` | Text on green/WhatsApp fills |
| `--color-danger` | `#ef4444` | Errors / struck "before" price (sharpened) |
| `--color-warning` | `#fbbf24` | Warnings / back-glass accents |

**Gradients:** `--grad-accent` (purple→cyan brand gradient). `--grad-wa` is now a
**solid** action green (`#34d399`) — one unified conversion colour, no cyan bleed.
New on-fill tokens (`--color-on-success/-danger/-warning`) are pure black/white per WCAG;
`--color-save`/`--color-was` carry the transparent-pricing signature.

### Scales — TELUS/UDS (Allium) foundation

| Group | Tokens |
|---|---|
| **Spacing** (Allium 4px) | `--space-1` 4 · `-2` 8 · `-3` 16 · `-4` 24 · `-5` 32 · `-6` 40 · `-7` 48 · `-8` 56 · `-9` 64 · `-10` 72 · `-11` 88 · `-12` 128 · `-13` 160 (px) · `--space-section` `clamp(48px,9vw,128px)` |
| **Radius** (Allium) | `--radius-4` 4 · `-6` 6 · `-8` 8 · `-12` 12 · `-16` 16 · `-24` 24 · `-32` 32 · `--radius-pill` 99 · `--radius-circle` 50% · `--radius-card` = 24. Legacy `--radius-xs/sm/md/lg` alias to 12/16/24/32. |
| **Elevation** | `--shadow-1/2/3` (deep, soft, dark) · glow: `--glow-accent`, `--glow-accent-strong`, `--glow-success` — the signature; glow > hard shadow |
| **Type weight** | four weights only: `--fw-display` 300 · `--fw-regular` 400 · `--fw-medium` 500 · `--fw-bold` 700 (no 800) |
| **Type size** (Allium px) | `--fs-12`…`--fs-64` (12·14·16·20·24·28·32·36·40·48·56·64) · `--fs-base` 16 · `--fs-h2` 32 · `--fs-h3` 28 · `--fs-lead` `clamp(1.06rem,2.6vw,1.25rem)` · `--fs-display` `clamp(2.5rem,6vw,4rem)` |
| **Line-height** | `--lh-tight` 1.125 · `--lh-headings` 1.2 · `--lh-snug` 1.33 · `--lh-normal` 1.5 · `--lh-relaxed`/`--lh-body` 1.6 |
| **Tracking** | `--ls-condensed` -.039em · `--ls-medium` -.035em · `--ls-loose` -.017em · `--track-eyebrow` .08em |
| **Motion** (TELUS) | `--dur-250` 250ms · `--dur-300` 300ms · `--ease-default` `cubic-bezier(.4,0,.2,1)`; legacy `--dur-fast/base/slow` + `--ease-out` alias these |
| **Focus** | `--focus-ring-color` `#c4b5fd` · `--focus-ring-width` 2px · `--focus-ring-offset` 2px |
| **Layout** | `--maxw` 1200px · `--header-h` 72px · `--wrap-pad` `clamp(16px,4vw,24px)` |

### Legacy alias map (don't add new ones — adopt the semantic token instead)

`--bg`→bg · `--bg2`→bg-raised · `--text`→text-primary · `--muted`→text-secondary ·
`--faint`→text-tertiary · `--purple`→accent · `--purple-lt`→accent-soft ·
`--cyan`→accent-2 · `--green`→success · `--green-lt`→success-text · `--red`→danger ·
`--amber`→warning · `--panel`→surface-1 · `--panel-2`→surface-2 · `--border`→border ·
`--border-2`→border-strong · `--radius`→radius-md · `--shadow`→shadow-2 ·
`--grad`→grad-accent. (`--radius-sm`/`--radius-lg`/`--ring` keep their original names.)

---

## Typography

Variable **Inter** (self-hosted, SIL OFL) via `--font-sans` — used on the four-weight
Allium scale (`--fw-display` 300 / `--fw-regular` 400 / `--fw-medium` 500 / `--fw-bold`
700; no 800). The hero **display is weight 300** with the brand gradient; sizes snap to
the Allium px scale, with `--fs-display`/`--fs-lead` kept fluid via `clamp()`.

| Element | Token | Notes |
|---|---|---|
| `h1` (hero display) | `--fs-display` `clamp(2.5rem, 1.6rem + 4.2vw, 4.75rem)` | line-height `--lh-display` (1.05), tracking `--track-display`. Calmer slope than a pure-`vw` scale (respects user zoom) and a softer max so the display reads as confident, not oversized. |
| `h2` (section) | `--fs-h2` `clamp(1.6rem, 3.4vw, 2.5rem)` | line-height 1.08, tracking `--track-h2`. |
| `h3` | `--fs-h3` 1.12rem | |
| Lead paragraph | `--fs-lead` `clamp(1.05rem, 1.9vw, 1.3rem)` | |
| Body | `--fs-base` 1rem | base `line-height: --lh-body` (1.6) for comfortable long-form rhythm. |

---

## Base components

> **JS-coupled classes** (`.card`, `.pill`, `.book`, `.rt-chip`, `.opt`, `.swatch`,
> `.spot-pill`, `.bar-*`, `.rgroup*`, `.card-*`, `.from`, `.save-tag`, `.empty`,
> `.errorbox`, `.reveal`/`.in`, …) are selected by name in `assets/js/app.js`.
> **Re-style their values freely; never rename them.**

### Button — `.btn` + variant

`.btn` is the base (inline-flex, pill radius, 700 weight, **min-height 48px** touch
target, hover lift + `:active` press). Pair with exactly one variant:

| Variant | Class | Look | Use for |
|---|---|---|---|
| Primary | `.btn-primary` | Purple→cyan gradient, accent glow | The main call-to-action |
| Secondary | `.btn-secondary` | Solid surface + strong border, accent-tinted hover | A real but quieter action |
| Ghost | `.btn-ghost` | Subtle translucent panel | Tertiary / "barely there" action |
| WhatsApp | `.btn-wa` | Green→cyan gradient | Booking on WhatsApp |

```html
<a class="btn btn-primary" href="#finder">Find your repair</a>
<button class="btn btn-secondary" type="button">Compare prices</button>
<a class="btn btn-ghost" href="#contact">Message us</a>
<a class="btn btn-wa" href="…">Book on WhatsApp</a>
```

`.book` is a compact WhatsApp button used inside the detail modal (JS-generated); it
shares `--grad-wa` and the pill radius.

### Badge / Pill

- **`.badge`** — static status pill (icon dot + label), e.g. the hero trust strip.
- **`.pill`** — interactive filter chip; toggle with `aria-pressed="true"` for the
  active gradient state. Add `.rt` for the repair-type row. *(JS-coupled.)*

```html
<span class="badge"><span class="dot"></span> Same-day repairs · 90-day warranty</span>
<button class="pill" aria-pressed="true">iPhone</button>
```

### Card — `.card`

Container primitive: column flex, gradient surface, hairline border, `--radius-md`,
hover lift + accent border glow. Child classes (`.card-top`, `.card-model`,
`.card-foot`, …) are rendered by `app.js`. *(JS-coupled — container styled here,
content owned by the section layer.)*

### Section wrapper

- **`.wrap`** — the canonical width container: `max-width: --maxw`, centered,
  horizontal padding `--wrap-pad`. Wrap every section's content in it.
- **`.section`** — an **opt-in vertical-rhythm** hook: `padding-block: --space-section`.
  Defined but **not yet applied** — adopt it on `<section>` elements to replace the
  current ad-hoc `style="padding-top:…"` / per-section margins (section-layer change).

### Interactive states — gradient border + pointer spotlight

`.card` and `.search` share a two-layer hover/focus treatment driven by CSS only:

- **`::after` animated gradient border** — a masked ring (`mask-composite: exclude`)
  filled with `conic-gradient(from var(--angle) …)`. The `@property --angle` custom
  property animates via `@keyframes border-spin` so the border *flows*. Where `@property`
  is unsupported the ring is a static gradient (graceful). Hidden (`opacity:0`) until
  `:hover`/`:focus-visible`.
- **`::before` pointer spotlight** — a radial-gradient centred on `--mx`/`--my`, set by
  `initCardSpotlight()` in `app.js` (rAF-throttled `pointermove`, gated on
  `(hover:hover)` + motion). Defaults to centre when unset.
- Card content sits above both layers via `.card{isolation:isolate}` + `.card>*{z-index:1}`.
- `:focus-visible` gets **full parity** with `:hover` (keyboard users get the same state),
  on top of the global focus ring. The search field opts out of the default outline and
  uses the gradient ring as its (clearly visible) focus indicator — like `.swatch`.

### Motion & animation layer (vanilla — no third-party JS)

Premium motion is **hand-rolled in vanilla JS** — no animation library, no third-party script.
All JS is self-hosted and the CSP stays `script-src 'self'`. Everything is gated on
`reduceMotion()` (reduced-motion users get instant, layout-correct updates):

- **Grid filtering** (`applyFilter()` in `app.js`): visibility is toggled **synchronously**
  (non-matching → `display:none` immediately) so the grid is layout-correct on the next tick —
  the driver counts `.card:visible` 150 ms after a filter change and Playwright ignores opacity.
  The matching set then fades + subtly scales into its **final** layout via the **Web Animations
  API** (`el.animate(...)`, staggered by per-element `delay`, `fill:'backwards'` so it leaves no
  inline styles and `:hover`/`:active` keep working). The in-flight Animations are tracked and
  `.cancel()`-ed on the next filter so they never stack. **Card positions are never animated** —
  that made cards fly across the grid and overlap/ghost on big set changes. Touch this path carefully.
- **Savings count-up** (`countUp()`) is a `requestAnimationFrame` easeOutCubic tween; it must never
  sit in an `aria-live` region and always commits the true final value.
- **Spotlight CLS**: the `.spotlight` section ships with a `reserving` class (responsive
  `min-height`) so the runtime-populated card doesn't shove the finder down; `buildSpotlight()`
  removes the class once populated.
- The global reduced-motion CSS net can't stop JS-driven animation — the **`reduceMotion()` guard
  is mandatory**, not decorative.

### New section components

- **`.actionbar`** — mobile-only (`≤559px`) sticky bottom bar holding the primary
  *Book on WhatsApp* CTA (a `data-wa="general"` link, so `initWhatsAppDefaults()` fills it)
  + a *Find* shortcut to `#finder`. `z-index:75` (above `.fab` 70, below the chat panel 80).
  On mobile it hides `.fab-wa`, lifts the `.fab` stack by `var(--actionbar-h)`, and pads
  `body` so the footer isn't occluded.
- **`.wa-cue`** — a small "Opens WhatsApp with a pre-filled message" line placed beside
  WhatsApp CTAs (hero, CTA banner, modal foot) to reduce app-switch drop-off.
- **`.trust-strip`** — reassurance row (90-day warranty · same-day · OEM-grade parts) in the
  device-detail `.sheet-foot`, directly above the booking CTA.

---

## Accessibility

- **Focus ring** — `:focus-visible` draws `2px solid var(--focus-ring-color)` with
  `outline-offset: 2px`. Using `outline` (not the previous `box-shadow`) means the
  ring follows each element's own `border-radius` — no more forced 10px corners on
  pills and cards. Components that need a bespoke indicator (e.g. `.swatch`) opt out
  with `outline:none` and provide their own.
- **Reduced motion** — targeted `@media (prefers-reduced-motion: reduce)` rules plus
  a global catch-all that near-zeroes all animation/transition durations. It uses
  `.001ms` (not `0`) so `transitionend`/`animationend` listeners in `app.js` still
  fire (reveal-on-scroll and the savings bars settle to their final state).
- **Touch targets** — interactive controls meet a **48px** minimum (`--touch-min`) for
  "broken-screen" tapping: buttons, filter `.pill`s, `.spot-pill`, `.opt`, `.book`, the
  action-bar CTAs (52px), and the search field (52px). Colour swatches keep a 40px visual
  but extend to ~50px via the `::after` box; smaller secondary controls (close, hamburger,
  back-to-top) are 44px.
- **High contrast (automatic, OS-driven)** — conversion-critical text (prices, savings,
  "Same-day", "90-day warranty") carries a subtle dark halo for legibility on bright/failing
  displays. `@media (prefers-contrast: more)` opaques glass surfaces, strengthens borders,
  and brightens secondary text; `@media (forced-colors: active)` forces gradient/clipped text
  (`.grad-text`, the savings figure) to a solid system colour so it never vanishes, and keeps
  the comparison bars meaningful (`forced-color-adjust:none`). No in-page toggle.

### Contrast (WCAG 2.1, computed sRGB; AA normal ≥ 4.5, large ≥ 3.0)

| Foreground | On background | Ratio | AA |
|---|---|---|---|
| `--color-text-primary` #f4f6ff | `--color-bg` | 18.6:1 | ✓✓ |
| `--color-text-secondary` #9fa9bd | `--color-bg` | 8.5:1 | ✓ |
| `--color-text-tertiary` #8794ab | `--color-bg` | 6.6:1 | ✓ |
| `--color-text-tertiary` #8794ab | `--color-bg-raised` | 6.3:1 | ✓ |
| `.btn-primary` text #0a0a12 | accent #8b5cf6 (darkest gradient stop) | 4.7:1 | ✓ |
| `.btn-wa` text #04130c | success #34d399 | 9.9:1 | ✓ |
| focus ring #c4b5fd | `--color-bg` | 10.9:1 | ✓ |

`--color-text-tertiary` was nudged from `#73809a` (which passed on the base
background at ~5.1:1 but thinned to ~4.5–4.9:1 over the raised/translucent input
surface used for placeholder text) to `#8794ab`, giving comfortable headroom
everywhere with no perceptible visual change.

**Out of this layer's scope:** text on *tinted translucent* feature surfaces —
`.rt-chip.*`, `.rgroup-ic.*`, `.opt-flag`, `.spot-*`, `.bar-fill` — depends on the
layer beneath and is owned by the section/feature layer. Re-verify those after
section changes; the token swaps here preserve their values.

---

## Conventions

- **Reference tokens, don't hard-code.** Prefer `--color-*` / `--space-*` / `--fs-*`
  / `--radius-*` / `--shadow-*` over raw values.
- **Re-style values, never rename JS-coupled classes** (see list above).
- **Ownership boundary** — this layer owns: the `:root` tokens, base element type
  (`body`, `h1`, `h2`), the shared primitives (`.btn*`, `.badge`, `.pill`, `.card`
  container, `.wrap`/`.section`), and global a11y (`:focus-visible`,
  reduced-motion). Section/feature layout (`.hero`, `.stats`, `.spotlight`,
  `.finder`, `.cta`, `footer`, `dialog`/`.sheet`, `.rgroup` internals) is owned by
  the section layer — adopt these tokens/classes there.
- **CSS stays inline** in `index.html` (CSP + no render-blocking).

## Verification

The SessionStart hook validates JS/JSON but **not** CSS. Before shipping CSS changes:

1. Serve locally — `npx serve .` (or `python3 -m http.server 8000`) — and eyeball at
   320 / 768 / 1024 / 1440px: hero headline clearance, all four button variants,
   pill/card focus rings (correct radius, single ring), placeholder legibility.
2. Toggle OS "reduce motion" → aurora/reveal/bar animations stop, but cards still
   reveal and savings bars still fill.
3. Re-run the headless axe-core/puppeteer audit — **WCAG 2.1 A/AA must stay at 0
   violations.**
