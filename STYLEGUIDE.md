# Nuera Tech — Design System

The shared visual foundation for the site: design tokens, typography, and the base
UI primitives (Button, Badge/Pill, Card, Section). This document is the contract
for everyone working on the front end — reference these tokens and classes in new
code instead of hard-coding values.

## Scope & architecture

The site is intentionally **build-less**: no framework, bundler, or `node_modules`.
**All CSS lives in one inline `<style>` block in [`index.html`](./index.html)**
(the `:root` token block comes first, then base elements, then primitives, then
sections). It stays inline on purpose — zero render-blocking, and it satisfies the
strict CSP (`style-src 'self' 'unsafe-inline'`). Add new global styles/tokens to
that block; do not introduce an external stylesheet without revisiting the
performance/CSP trade-off.

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
| `--color-success-text` | `#6ee7b7` | Success text on dark |
| `--color-on-success` | `#04130c` | Text on green/WhatsApp fills |
| `--color-danger` | `#fb7185` | Errors / "before" price |
| `--color-warning` | `#fbbf24` | Warnings / back-glass accents |

**Gradients:** `--grad-accent` (purple→cyan brand gradient) and `--grad-wa`
(green→cyan WhatsApp gradient).

### Scales

| Group | Tokens |
|---|---|
| **Spacing** (8px rhythm) | `--space-1` 4px · `-2` 8px · `-3` 12px · `-4` 16px · `-5` 20px · `-6` 24px · `-8` 32px · `-10` 40px · `-12` 48px · `-16` 64px · `--space-section` `clamp(48px,7vw,96px)` |
| **Radius** | `--radius-xs` 10 · `--radius-sm` 14 · `--radius-md` 22 · `--radius-lg` 30 · `--radius-pill` 999 · `--radius-circle` 50% |
| **Elevation** | `--shadow-1` (subtle) · `--shadow-2` (cards/CTA) · `--shadow-3` (modal) · glow: `--glow-accent`, `--glow-accent-strong`, `--glow-success` |
| **Type size** | `--fs-2xs` .72 · `--fs-xs` .8 · `--fs-sm` .86 · `--fs-base` 1 · `--fs-lead` (fluid) · `--fs-h3` 1.12 · `--fs-h2` (fluid) · `--fs-display` (fluid) — all `rem` |
| **Line-height** | `--lh-display` 1.05 · `--lh-heading` 1.12 · `--lh-snug` 1.2 · `--lh-body` 1.6 |
| **Tracking** | `--track-display` -.04em · `--track-h2` -.03em · `--track-tight` -.02em · `--track-eyebrow` .14em |
| **Motion** | `--dur-fast` .15s · `--dur-base` .18s · `--dur-slow` .6s · `--ease-out` `cubic-bezier(.22,1,.36,1)` · `--ease-standard` ease |
| **Focus** | `--focus-ring-color` `#c4b5fd` · `--focus-ring-width` 2px · `--focus-ring-offset` 2px |
| **Layout** | `--maxw` 1200px · `--header-h` 62px · `--wrap-pad` `clamp(16px,4vw,28px)` |

### Legacy alias map (don't add new ones — adopt the semantic token instead)

`--bg`→bg · `--bg2`→bg-raised · `--text`→text-primary · `--muted`→text-secondary ·
`--faint`→text-tertiary · `--purple`→accent · `--purple-lt`→accent-soft ·
`--cyan`→accent-2 · `--green`→success · `--green-lt`→success-text · `--red`→danger ·
`--amber`→warning · `--panel`→surface-1 · `--panel-2`→surface-2 · `--border`→border ·
`--border-2`→border-strong · `--radius`→radius-md · `--shadow`→shadow-2 ·
`--grad`→grad-accent. (`--radius-sm`/`--radius-lg`/`--ring` keep their original names.)

---

## Typography

Variable **Inter** (self-hosted, weights 100–900) via `--font-sans`. Headings use
`clamp()` for fluid, breakpoint-free scaling.

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

`.btn` is the base (inline-flex, pill radius, 700 weight, **min-height 46px** touch
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
- **Touch targets** — buttons are `min-height: 46px`.

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
