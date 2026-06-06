# Provisioning runbook — Google Cloud for Nuera Tech

Copy-paste `gcloud` setup for the `cloud/` services. Run top-to-bottom once.
Nothing here stores a key in the repo: services authenticate via **ADC** (runtime
service accounts), CI authenticates via **Workload Identity Federation**, and the
only secret (a GitHub token) lives in **Secret Manager**.

> **Phase 0, step 1 — do this first:** in the Google Cloud / "Agent Platform"
> console, **disable then delete the leaked API key**. This design needs no API
> key, so there is nothing to replace. Optionally enforce
> `gcloud resource-manager org-policies enable-enforce constraints/iam.disableServiceAccountKeyCreation`.

```bash
# ---- 0. Variables -----------------------------------------------------------
export PROJECT_ID="your-project-id"
export REGION="northamerica-northeast1"          # Montréal (Canada residency). us-central1 also fine.
export GH_OWNER="FirstArmada"                      # GitHub org/user
export REPO="nuera-tech-site"
gcloud config set project "$PROJECT_ID"

# ---- 1. Enable APIs ---------------------------------------------------------
gcloud services enable \
  aiplatform.googleapis.com run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com sheets.googleapis.com \
  cloudscheduler.googleapis.com secretmanager.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

# ---- 2. Runtime service accounts (least privilege) --------------------------
gcloud iam service-accounts create nuera-chat-proxy   --display-name "Nuera chat proxy (Vertex)"
gcloud iam service-accounts create nuera-pricing-sync --display-name "Nuera pricing sync"
gcloud iam service-accounts create gh-deployer        --display-name "GitHub Actions deployer"

export CHAT_SA="nuera-chat-proxy@$PROJECT_ID.iam.gserviceaccount.com"
export SYNC_SA="nuera-pricing-sync@$PROJECT_ID.iam.gserviceaccount.com"
export DEPLOYER_SA="gh-deployer@$PROJECT_ID.iam.gserviceaccount.com"

# chat proxy → call Vertex
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$CHAT_SA" --role roles/aiplatform.user
# pricing sync → read its GitHub token from Secret Manager (Sheets uses sharing, not IAM)
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SYNC_SA" --role roles/secretmanager.secretAccessor
# deployer → build & deploy, acting AS the runtime SAs
for R in roles/run.admin roles/artifactregistry.writer roles/cloudbuild.builds.editor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOYER_SA" --role "$R"
done

# ---- 3. Workload Identity Federation (CI, no keys) --------------------------
gcloud iam workload-identity-pools create github --location global --display-name "GitHub"
gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location global --workload-identity-pool github \
  --display-name "GitHub OIDC" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository=='$GH_OWNER/$REPO'" \
  --issuer-uri "https://token.actions.githubusercontent.com"
export POOL_ID=$(gcloud iam workload-identity-pools describe github --location global --format='value(name)')
# Let the GitHub repo impersonate the deployer SA
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/$POOL_ID/attribute.repository/$GH_OWNER/$REPO"
# The value for the GCP_WIF_PROVIDER GitHub variable:
gcloud iam workload-identity-pools providers describe github-oidc \
  --location global --workload-identity-pool github --format='value(name)'

# ---- 4. Secret: GitHub token for the sync PR --------------------------------
# Create a fine-grained PAT (or GitHub App token) scoped to THIS repo only:
#   Contents: Read & write, Pull requests: Read & write.
printf '%s' "ghp_xxx_your_fine_grained_token" | \
  gcloud secrets create gh-pricing-sync --data-file=- --replication-policy automatic
gcloud secrets add-iam-policy-binding gh-pricing-sync \
  --member "serviceAccount:$SYNC_SA" --role roles/secretmanager.secretAccessor
# GITHUB_TOKEN_SECRET value:
echo "projects/$PROJECT_ID/secrets/gh-pricing-sync/versions/latest"

# ---- 5. Share the Sheet -----------------------------------------------------
# In Google Sheets, share the Master Price List (Viewer) with: $SYNC_SA
# (and the MK sheet too, if separate).

# ---- 6. First deploy (or let GitHub Actions do it on push to main) ----------
gcloud run deploy nuera-chat-proxy --source ../chat-proxy \
  --region "$REGION" --service-account "$CHAT_SA" --allow-unauthenticated \
  --max-instances 3 --concurrency 20 --memory 512Mi \
  --set-env-vars "VERTEX_LOCATION=$REGION,GEMINI_MODEL=gemini-2.5-flash,ALLOWED_ORIGINS=https://nuera.talha-k.com"

gcloud run jobs deploy nuera-pricing-sync --source ../pricing-sync \
  --region "$REGION" --service-account "$SYNC_SA" \
  --set-env-vars "MASTER_SHEET_ID=YOUR_SHEET_ID,MASTER_SHEET_RANGE=Master!A1:Z10000,GITHUB_TOKEN_SECRET=projects/$PROJECT_ID/secrets/gh-pricing-sync/versions/latest,GITHUB_OWNER=$GH_OWNER,GITHUB_REPO=$REPO"

# ---- 7. Custom domain for stable CSP ----------------------------------------
# Map chat.nuera.talha-k.com → the chat proxy, then it matches the site CSP
# (connect-src already lists https://chat.nuera.talha-k.com in vercel.json/_headers).
gcloud run domain-mappings create --service nuera-chat-proxy --domain chat.nuera.talha-k.com --region "$REGION"
# Add the CNAME it prints in Cloudflare DNS (DNS-only / grey-cloud for this subdomain).

# ---- 8. Schedule the daily sync ---------------------------------------------
gcloud scheduler jobs create http nuera-pricing-sync-daily \
  --location "$REGION" --schedule "0 6 * * *" --time-zone "America/Toronto" \
  --uri "https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT_ID/jobs/nuera-pricing-sync:run" \
  --http-method POST --oauth-service-account-email "$DEPLOYER_SA"
```

## GitHub repo variables for CI (`.github/workflows/deploy-cloud.yml`)

Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | your project id |
| `GCP_REGION` | `northamerica-northeast1` |
| `GCP_WIF_PROVIDER` | output of step 3 (`projects/.../providers/github-oidc`) |
| `GCP_DEPLOYER_SA` | `gh-deployer@<project>.iam.gserviceaccount.com` |
| `CHAT_PROXY_SA` | `nuera-chat-proxy@<project>.iam.gserviceaccount.com` |
| `PRICING_SYNC_SA` | `nuera-pricing-sync@<project>.iam.gserviceaccount.com` |
| `ALLOWED_ORIGINS` | `https://nuera.talha-k.com` (comma-separate extra origins) |
| `GEMINI_MODEL` | `gemini-2.5-flash` (optional) |
| `MASTER_SHEET_ID` | the Master Price List spreadsheet id |
| `MASTER_SHEET_RANGE` | e.g. `Master!A1:Z10000` |
| `GITHUB_TOKEN_SECRET` | output of step 4 |

## Column mapping (pricing-sync)

`transform.js` maps sheet headers → fields. Defaults: `Model, Repair Type, Variant,
Brand, Chip, Price, MK Price, SKU`. If your headers differ, set `COL_MODEL`,
`COL_REPAIR_TYPE`, `COL_VARIANT`, `COL_BRAND`, `COL_CHIP`, `COL_PRICE`,
`COL_MK_PRICE`, `COL_SKU` env vars (Brand/Chip are derived from the model/repair
name if omitted). `brand` must resolve to one of `iphone|samsung|pixel|ipad|samsung-tab`
and `chip` to `screen|battery|backglass|chargeport`.

## Mobile Klinik overlay (authorized source only)

MK prices must come from a **sanctioned** source — never a scraper. Point the job at
an authorized MK sheet/tab with `MK_SHEET_ID` + `MK_SHEET_RANGE` (and `MK_COL_*` if
headers differ). Without these, `mk_price`/`savings` stay null (sparse coverage is
expected and the UI degrades gracefully).
