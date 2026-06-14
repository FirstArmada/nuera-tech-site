# CPO Ecommerce & Repair Part-Cost Tracking — Integration Options

> **Options / decision report — scoped for Nuera Tech (Guelph, Ontario)**
> Compiled June 2026. Pairs with [`repair-pricing-research-2026.md`](./repair-pricing-research-2026.md)
> (the wholesale part-cost benchmarks this report builds margin tracking on top of).

**Question:** How should Nuera Tech (a) start selling **Certified Pre-Owned (CPO) devices**
online and (b) **track repair part costs / margins** — ideally **moving off the spreadsheet**
toward inventory/cost management that can **poll live vendor pricing** or take a manually-set
price? What's actually viable given the site's build-less architecture, and what's the
recommended path?

**Confidence legend:** 🟢 High (primary source / observed / multi-source agreement) · 🟡 Medium
(single credible/secondary source, or pricing that varies by plan/region) · 🔴 Flagged (gated,
inferred, or needs first-party confirmation).

**Scope note:** This is an *exploration* — no production code ships with it. Each option lists the
concrete implementation path so a follow-up task can execute once the owner picks a lane.

---

## 1. TL;DR — the recommendation in five bullets

1. **Phase the commerce, don't big-bang it.** Start with a **CPO catalog + "reserve on
   WhatsApp / pay in-store"** flow that reuses the device-card/modal/filter UI we already have and
   the same Sheets→JSON→`fetch()` pipeline that powers repairs. Near-zero new infra, **no PCI
   surface**, and it matches how the shop already takes business. 🟢
2. **Add real online checkout only when volume justifies the fees** — and when it does,
   **Snipcart** is the best fit for a *build-less static site* (it enhances the existing page
   rather than replacing it); **Shopify** becomes the better choice *if* we adopt a POS that
   already syncs to it (see #4). 🟢
3. **Move part-cost/inventory off the spreadsheet by adopting a repair-shop POS backbone
   (RepairDesk is the front-runner).** It tracks cost + stock + margin natively, **captures
   vendor pricing through built-in supplier ordering** (MobileSentrix / Injured Gadgets / Phone
   LCD Parts), and exposes a **public API** the site's existing sync job can read from. 🟢
4. **The two asks converge on one backbone.** A single POS (RepairDesk) holds **both** repair
   parts *and* CPO device inventory, and integrates with **Shopify** (storefront) + **QuickBooks**
   (books) — so the inventory decision and the storefront decision are really one decision. 🟢
5. **"Live vendor price polling" is only *partially* viable — set expectations.** Most B2B
   distributor carts are **login-gated and 403 to crawlers** (we re-confirmed this live).
   MobileSentrix is the notable exception (an API/OrderSync program). The pragmatic answer:
   let a POS capture costs via its sanctioned supplier integrations, **always keep manual
   override**, and **don't build bespoke scrapers** (fragile + ToS-risky). 🟢

---

## 2. Constraints & non-negotiables (what the architecture allows)

These come from the repo itself and shape every option below.

- **Build-less static SPA.** Vanilla ES modules, no bundler, served straight from the repo root to
  Vercel + a self-hosted OpenResty mirror + Cloudflare Workers (`README.md`). There is **no
  request-handling backend** — but there *is* a proven async backend pattern:
  **Google Sheets → Cloud Run job → GitHub PR → static JSON → `fetch()` at runtime**
  (`cloud/pricing-sync/`). `cloud/pricing-sync/lib/mk.js` is a clean precedent for **layering a
  second data source** into the published JSON. Anything we add should ride this pattern. 🟢
- **Strict Content-Security-Policy.** `vercel.json` and `_headers` lock `script-src`,
  `connect-src`, `frame-src`, and `form-action` to `'self'` (plus a short Vercel/Pusher
  allow-list). **Any third-party cart/payment widget requires explicit CSP allow-listing** —
  a deliberate edit, not a drop-in. 🟢
- **⚠️ The whole site sits behind a Cloudflare Access auth wall** (`README.md` "Production
  topology" — login is required to view the site, "intentional"). **A public storefront or public
  CPO catalog cannot happen until that wall is removed or scoped** (e.g. public site, with Access
  reserved for an `/admin`-style path). This is a **prerequisite**, not a detail. 🟢
- **Commerce today is WhatsApp-only.** The WhatsApp number is defined once (`WA = '12269784666'`)
  and every CTA deep-links via `waLink()` in `assets/js/app.js`. There is no cart, checkout, or
  payment code anywhere. 🟢
- **🔒 Cost data is competitively sensitive and must never ship in the public JSON.** Anyone can
  `fetch('/pricing-data.json')`. Part cost, margin, and supplier prices must stay in an
  **internal-only** artifact. `cloud/pricing-sync/lib/{transform,validate}.js` is the contract
  gate that enforces the public shape today. 🟢
- **CAD margins are structurally tight.** Per `repair-pricing-research-2026.md`: parts are cheap
  (the margin is in labor/warranty/trust), and a **~37–40% USD→CAD FX premium** plus shipping/duty
  compresses sourcing margins vs. US shops. This is exactly *why* tracking real landed part cost
  is worth doing. 🟢

---

## 3. Workstream A — CPO ecommerce: options compared

| Option | Fit w/ build-less SPA | Online payments / PCI | Recurring cost | Build effort | Notes |
|---|---|---|---|---|---|
| **Catalog + WhatsApp / in-store reserve** | **Excellent** — reuses card/modal/filter UI + the Sheets→JSON pipeline | None (pay in store / e-transfer) | **~$0** | **Low** | Mirrors current model; new `inventory.json`; zero PCI. Still needs the Access wall scoped. 🟢 |
| **Snipcart** (JS cart overlay) | **Best** true-checkout fit for a static site — *enhances* the page, doesn't replace it | Yes — gateway-hosted (Stripe etc.); PCI offloaded | **~2% / txn**, **US$20/mo min**, **+ gateway fees** | Medium | Products declared via HTML data-attributes; **needs CSP allow-list**. 🟢 |
| **Stripe Payment Links / Checkout** | Good — link out per device, or a tiny Cloud Run session endpoint (infra pattern already exists) | Yes — Stripe-hosted page (PCI offloaded) | **~2.9% + C$0.30 / txn** 🟡 | Medium | Lowest platform lock-in; no cart unless we build one; CSP allow-list for `js.stripe.com`. 🟡 |
| **Shopify Buy Button / Starter** | OK — embeddable widget, but Shopify's model leans toward *replacing* the site | Yes | **~US$5–40/mo + ~2.9%+30¢** 🟡 | Medium | **Strongest if a POS already syncs inventory to Shopify** (see Workstream B). 🟡 |
| **Square Online** | Separate hosted site; weaker as an embed | Yes | Free tier + processing fees 🟡 | Med–High | Best if the shop wants **unified in-store + online retail POS**; overlaps the POS decision. 🟡 |

**Why the WhatsApp/reserve flow wins Phase 1:** the repair side already converts over WhatsApp;
CPO devices are low-volume, high-consideration purchases (buyers want to ask about battery health,
grade, warranty) — a "reserve & confirm" conversation fits the product *and* avoids PCI, chargeback,
and CSP complexity entirely. It's the same `inventory.json` + render-cards pattern we already trust.

**Why Snipcart (not Shopify) for Phase 2 checkout — *if* we stay site-first:** Snipcart is
purpose-built to bolt a cart onto an existing static site without a rebuild; Shopify's Buy Button
nudges you toward making Shopify the site. Since our whole value prop is the hand-built build-less
SPA, Snipcart preserves it. **The exception:** if we adopt RepairDesk (Workstream B) and let it
push device inventory into a Shopify storefront, Shopify's first-party POS↔store sync can outweigh
Snipcart's site-fit advantage. 🟢

**Implementation path (for the follow-up, not now):**
- *Catalog:* add `inventory.json` (shape: `model, grade, storage, color, battery_health, price,
  photos[], status, sku`); a `loadInventory()` sibling to `loadData()` in `app.js`; a new
  `#certified-pre-owned` section reusing `cardHTML()`/`openDevice()` patterns; "Reserve on
  WhatsApp" via the existing `waLink()`. Sync `inventory.json` through a Cloud Run job mirroring
  `cloud/pricing-sync/`.
- *Checkout (Snipcart):* add the Snipcart script + `data-item-*` attributes on CPO cards; extend
  CSP `script-src`/`connect-src`/`frame-src` for `*.snipcart.com` + the chosen gateway.

---

## 4. Workstream B — repair part-cost & inventory tracking (move off the spreadsheet)

### 4.1 Options compared

| Option | Off the spreadsheet? | Live vendor pricing | Cost / margin tracking | Recurring cost | Notes |
|---|---|---|---|---|---|
| **Sheet + a new `Part Cost` column** (extend current pipeline) | No (still a sheet) | Manual entry only | Computed in `transform.js`; emitted to an **internal-only** report | **$0** | Smallest possible step; keeps cost out of the public JSON. Good stopgap. 🟢 |
| **RepairDesk** (repair-shop POS/inventory SaaS) | **Yes** | **Captured via built-in supplier ordering** (MobileSentrix / Injured Gadgets / Phone LCD Parts) + manual override | **Native** (cost, stock, margin); **public API** to read out; webhooks | **~US$79 / store / mo** (billed annually) 🟢 | Also integrates **Shopify + QuickBooks** → converges with Workstream A. Front-runner. 🟢 |
| **RepairShopr / Syncro** | Yes | Purchase-order driven; less "live catalog" | Native inventory + PO module; reorder thresholds; IMEI/serial | **~US$129 / mo** (billed annually) 🟡 | Comparable feature set, pricier. Also has a public API. 🟡 |
| **Custom inventory service** (Cloud Run + small DB) | Yes | Optional **MobileSentrix API / OrderSync** poll; manual override | Full control over schema | Build + maintain | Most flexible, most ongoing maintenance + on-call surface. 🟡 |

### 4.2 Is "live vendor price polling" viable? — honest verdict 🟢

**Partially, with real caveats.** Findings:

- **Direct distributor price APIs are mostly *not* public.** B2B distributor catalogs are
  **login-gated and return HTTP 403 to crawlers** — we re-confirmed this live: both
  `mobilesentrix.com` and `repairdesk.co` returned **403 Forbidden** to an unauthenticated fetch,
  matching the same finding in `repair-pricing-research-2026.md`. 🟢
- **MobileSentrix is the exception** (and it's Canada-relevant): it runs an **API Consumer**
  program plus an **OrderSync** app that automates inventory updates — **quantity, price, and SKU**.
  This is the single most viable *direct* vendor feed. 🟡 *(Exact endpoints/fields are behind a B2B
  login → confirm with a MobileSentrix account before designing against it.)* 🔴
- **Injured Gadgets and Mobile Defenders have no public price API.** They're reachable **through a
  POS** — RepairDesk offers one-click **integrated ordering** from MobileSentrix, Injured Gadgets,
  and Phone LCD Parts — rather than via a feed we could poll ourselves. 🟢
- **Rolling our own scraper against a logged-in B2B cart is fragile and ToS-risky** (the 403s are
  the gate doing its job). Not recommended. 🟢

**Therefore:** treat "live polling" as **"a POS captures vendor costs via sanctioned supplier
integrations, with manual override always available,"** not "we hit distributor APIs directly."
The one place a *direct* poll is defensible is the **MobileSentrix API/OrderSync** with a real
account — and even then, a POS likely already wraps it.

### 4.3 Keeping cost data private (the hard rule)

Whatever the source, the published `pricing-data.json` **stays cost-free**. The sync job computes
margin internally and emits it to a **separate internal artifact** — options, cheapest first:

- write a **margin report into the sync PR body** (visible only to repo collaborators), and/or
- write a private `costs.json` that is **excluded from every deploy target** (it must be added to
  `.assetsignore` *and* left out of the OpenResty copy list in `deploy.yml` — exclusion is
  per-target, so missing one would leak it), and/or
- push margins to a **private Sheet tab / the POS's own reporting** (no new public surface at all —
  the safest).

The public `transform`/`validate` contract is unchanged; cost never enters the validated public shape.

---

## 5. Where the two workstreams converge

The important insight: **one POS/inventory backbone answers both questions.** RepairDesk (or a peer)
holds **repair parts *and* CPO device inventory**, tracks **cost + margin** on both, and integrates
with **Shopify** (a storefront for the CPO devices) and **QuickBooks** (the books). The website stays
build-less: the existing Cloud Run job evolves from "read a Google Sheet" to **"read the POS public
API,"** then publishes:

- the **cost-free public** `pricing-data.json` (repairs) and `inventory.json` (CPO devices) the SPA
  fetches, and
- a **private margin report** for the owner.

So the recommended end-state is **not** five disconnected integrations — it's **one backbone + the
existing publish pipeline**, with an optional checkout layer on top.

---

## 6. Recommended phased roadmap

| Phase | What | Unlocks | Effort | New recurring cost |
|---|---|---|---|---|
| **0 — Decide & stopgap** | Choose Access-wall posture (public site vs. gated `/admin`); add a `Part Cost` column to the existing master Sheet now so margin data starts accruing (internal-only). | Margins visible immediately; commerce decisions unblocked. | Tiny | $0 |
| **1 — CPO catalog (no payments)** | `inventory.json` synced via the existing pipeline; new CPO section reusing card/modal/filter UI; "Reserve on WhatsApp / pay in-store" CTA; scope the Access wall so the catalog is public. | Sell CPO devices the way the shop already operates; no PCI. | Low | ~$0 |
| **2 — Inventory/cost backbone** | Adopt RepairDesk (front-runner); switch the sync job to read its **public API**; capture vendor costs via its supplier integrations; emit the private margin report. | Off the spreadsheet; real cost/margin/stock; one source of truth. | Medium | ~US$79/mo |
| **3 — Online checkout (optional)** | Add real payments: **Snipcart** if staying site-first, or **Shopify** if Phase 2's POS already syncs inventory to it; allow-list CSP; Stripe as the gateway. | Card payments + cart, once volume justifies fees. | Medium | ~2–3%/txn (+ platform min) |

Each phase stands alone and ships value; later phases are opt-in.

---

## 7. Open questions for the owner (drive the next task)

1. **Access wall:** OK to make the site (or at least the CPO catalog) **publicly viewable**, with
   Cloudflare Access reserved for an admin path? *(Blocks all public-commerce phases.)*
2. **Online payments now, or reserve-and-pay-in-store first?** Sets whether we need Phase 3 at all.
3. **Budget appetite** for a POS (~US$79/mo RepairDesk) vs. staying on the extended spreadsheet.
4. **Expected CPO volume** (units/month) — low volume favors WhatsApp-reserve; higher volume
   favors real checkout + POS stock sync.
5. **Who keys data** (owner vs. staff) and **do we already hold a MobileSentrix B2B account** —
   determines whether direct API/OrderSync is even on the table.

---

## 8. Sources

- MobileSentrix — API Consumer program & B2B model: <https://www.mobilesentrix.com/api-consumer>,
  <https://www.mobilesentrix.com/about> · OrderSync / RepairDesk integration:
  <https://www.repairdesk.co/mobilesentrix-integration/> *(B2B-gated; 403 to anonymous fetch)*
- RepairDesk — features, supplier ordering & pricing (~US$79/store/mo):
  <https://www.repairdesk.co/cell-phone-repair-shop-software/>, <https://www.repairdesk.co/pricing/>,
  <https://www.repairdesk.co/integrations/> · Public API + webhooks:
  <https://api-docs.repairdesk.co/>, <https://help.repairdesk.co/portal/en/kb/articles/public-api-documentation>
- Injured Gadgets / Mobile Defenders — supplier profiles & POS-mediated ordering:
  <https://www.repairdesk.co/injured-gadgets-integration/>,
  <https://blog.repairdesk.co/2025/03/06/best-cell-phone-repair-parts-suppliers-in-united-states/>
- RepairShopr / Syncro — inventory + PO, public API (~US$129/mo):
  <https://www.repairshopr.com/cell-phone-repair>, <https://www.repairshopr.com/blog/posts/feature-friday-api-documentation>
- Snipcart vs Shopify Buy Button (static-site fit, ~2%/txn, $20/mo min):
  <https://snipcart.com/blog/snipcart-vs-shopify-buy-button-review>,
  <https://ecommerce-platforms.com/compare/snipcart-vs-shopify-lite-which-one-is-the-better-option>
- Internal: [`docs/repair-pricing-research-2026.md`](./repair-pricing-research-2026.md)
  (wholesale part-cost benchmarks, CAD FX premium, login-gated-distributor finding).

*Pricing/plan figures (🟡) vary by region, plan tier, and promotions — confirm against each vendor's
live pricing page and, for MobileSentrix's API (🔴), against a logged-in B2B account before building.*
