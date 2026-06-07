# Image optimization

The raster icons under `assets/icons/` are **off the page's first-paint render path** — the
page itself loads zero content images. So this is a **total-weight / PWA-install / social-share**
improvement, not a Core Web Vitals (LCP/CLS/INP) one. It's documented here rather than applied in
the repo because the build-less web/CI environment has no image tooling
(`cwebp`/`pngquant`/`oxipng`/`sharp` are all absent). Run these **offline** (or wire them into the
`cloud/pricing-sync` style pipeline) and commit the re-encoded files.

## Current sizes (baseline)

| File | Bytes | Dims | Role | Loaded on first paint? |
|---|---|---|---|---|
| `assets/icons/og-image.png` | ~100 KB | 1200×630 | OG/Twitter share image | No (crawlers only) |
| `assets/icons/icon-512.png` | ~69 KB | 512×512 | PWA install icon (`manifest`) | No (install) |
| `assets/icons/maskable-512.png` | ~48 KB | 512×512 | PWA maskable icon | No (install) |
| `assets/icons/icon-192.png` | ~19 KB | 192×192 | PWA install icon | No (install) |
| `assets/icons/apple-touch-icon.png` | ~15 KB | 180×180 | iOS home screen | No (add-to-home) |
| `assets/icons/favicon-32.png` | ~1.4 KB | 32×32 | favicon | tab (tiny) |
| `assets/icons/favicon-16.png` | ~0.6 KB | 16×16 | favicon | tab (tiny) |

## Constraints (read before re-encoding)

- **PWA + Apple icons must stay PNG.** `manifest.webmanifest` declares `type: image/png` for
  `icon-192`, `icon-512`, `maskable-512`, and `apple-touch-icon` is PNG by convention. Keep the
  **same filenames, dimensions, and PNG format** — only shrink the bytes. Don't strip the
  `maskable` safe-zone padding.
- **Don't touch `favicon-16/32`** — already tiny; re-encoding saves nothing meaningful.
- The OG image URL is absolute in the meta tags (`index.html` `og:image` / `twitter:image`); if
  you change its format/extension you must update those tags too (see below).

## Recommended: lossless / near-lossless PNG recompress (safe, no format change)

Keeps every filename, format, and dimension — just smaller bytes. Expect ~40–60% reduction.

```bash
# oxipng (lossless, recompresses zlib + drops noncritical chunks)
oxipng -o max --strip safe assets/icons/icon-512.png assets/icons/maskable-512.png \
       assets/icons/icon-192.png assets/icons/apple-touch-icon.png assets/icons/og-image.png

# OR pngquant (near-lossless palette quantization — bigger wins, verify visually)
pngquant --quality=80-95 --skip-if-larger --strip --force --ext .png \
         assets/icons/icon-512.png assets/icons/maskable-512.png \
         assets/icons/icon-192.png assets/icons/apple-touch-icon.png assets/icons/og-image.png
```

## Optional: a modern OG-image variant (extra win, needs a meta-tag change)

The OG image is the single biggest file and is consumed by link-preview crawlers, most of which
accept JPEG/WebP. A JPEG at q80 is typically ~40–55 KB vs the ~100 KB PNG.

```bash
# JPEG (widest crawler support) — then point og:image/twitter:image at og-image.jpg
cwebp -q 80 assets/icons/og-image.png -o assets/icons/og-image.webp   # WebP, if you prefer
# or: magick assets/icons/og-image.png -quality 82 assets/icons/og-image.jpg
```

If you switch the OG file's extension, update both meta tags in `index.html` (the `og:image`
and `twitter:image` URLs) and re-validate with the Facebook Sharing Debugger / Twitter Card
Validator. Otherwise keep the lossless-PNG path above (no markup change).

## Verify after re-encoding

- Icons still render: `node .claude/skills/run-nuera-tech-site/driver.cjs` (PASS) and check the
  PWA install prompt / `manifest` icons resolve.
- No dimension/format drift: `file assets/icons/*.png` should report unchanged sizes & PNG.
- Commit the re-encoded files in their own commit so the byte diff is reviewable.
