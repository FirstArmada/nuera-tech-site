# `cloud/` — Google Cloud server code

The website at the repo root stays **build-less and static**. Everything in this
directory is **server-side** code that runs on **Google Cloud Run** and is *never*
served as part of the site. It is excluded from the static deploys
(`.assetsignore`, `.vercelignore`) and deployed only by
`.github/workflows/deploy-cloud.yml`.

| Path | What it is | Trigger |
|------|------------|---------|
| `chat-proxy/` | Cloud Run **service** — the on-site AI assistant. Calls Vertex AI (Gemini) and resolves prices from `pricing-data.json` via function calling. The browser talks to it (whitelisted in the site CSP). | always-on HTTP |
| `pricing-sync/` | Cloud Run **job** — regenerates `pricing-data.json` from the Google Sheets master list (+ authorized Mobile Klinik overlay) and opens a GitHub PR. | Cloud Scheduler (daily) |
| `infra/` | `gcloud` runbook to provision the project, service accounts, IAM, Workload Identity Federation, secrets, scheduler, and domain. Docs only. |

## Key principles

- **No secrets in the repo.** Auth is **ADC** (runtime service accounts). The only
  other secret — a GitHub token for the sync PR — lives in **Secret Manager**.
- **`pricing-data.json` stays in the repo** and same-origin (Rule 1). The sync job
  proposes changes via PR; merging it triggers the normal Vercel/Cloudflare/OpenResty
  deploys. We never serve pricing from a GCS bucket (see README.md troubleshooting).
- **The WhatsApp number stays defined once** in `assets/js/app.js` (Rule 2). The
  proxy mirrors it (overridable via `WHATSAPP_NUMBER`); the widget reads it from the DOM.

## Local development

```bash
# one-time: ADC for your user account (no key files)
gcloud auth application-default login

# chat proxy
cd cloud/chat-proxy && npm install
GOOGLE_CLOUD_PROJECT=<project> VERTEX_LOCATION=northamerica-northeast1 npm start
curl -sN -X POST localhost:8080/chat -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"How much is an iPhone 12 Mini screen?"}]}'

# pricing sync (dry run — reads the Sheet, validates, prints the PR diff, opens nothing)
cd cloud/pricing-sync && npm install
MASTER_SHEET_ID=<id> MASTER_SHEET_RANGE='Master!A1:Z10000' node job.js --dry-run
```

See `infra/README.md` for full provisioning and the required env/vars.
