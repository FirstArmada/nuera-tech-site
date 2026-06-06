/* GitHub delivery: open a PR that updates pricing-data.json on the default branch.
 * Keeping the file in-repo preserves Rule 1 and reuses the existing deploy pipeline.
 * The token is a fine-grained PAT (or App token) scoped to this repo only
 * (contents:write + pull_requests:write), loaded from Secret Manager at runtime.
 */
import { Octokit } from '@octokit/rest';

export const OWNER = process.env.GITHUB_OWNER || 'FirstArmada';
export const REPO = process.env.GITHUB_REPO || 'nuera-tech-site';
export const BASE = process.env.GITHUB_BASE || 'main';
export const PATH = 'pricing-data.json';

export function makeClient(token) {
  return new Octokit({ auth: token });
}

export async function getCurrentPricing(octokit) {
  try {
    const res = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path: PATH, ref: BASE });
    const raw = Buffer.from(res.data.content, 'base64').toString('utf8');
    return { json: JSON.parse(raw), sha: res.data.sha, raw };
  } catch (e) {
    if (e.status === 404) return { json: null, sha: null, raw: null };
    throw e;
  }
}

// Create a branch off BASE, commit the new file, open a PR. Returns the PR URL.
export async function openPricingPr(octokit, { newContent, currentSha, summary, date }) {
  const branch = `pricing-sync/${date}-${Date.now().toString(36)}`;
  const baseRef = await octokit.git.getRef({ owner: OWNER, repo: REPO, ref: `heads/${BASE}` });
  await octokit.git.createRef({ owner: OWNER, repo: REPO, ref: `refs/heads/${branch}`, sha: baseRef.data.object.sha });

  await octokit.repos.createOrUpdateFileContents({
    owner: OWNER, repo: REPO, path: PATH, branch,
    message: `chore: pricing sync ${date}`,
    content: Buffer.from(newContent, 'utf8').toString('base64'),
    sha: currentSha || undefined,
  });

  const pr = await octokit.pulls.create({
    owner: OWNER, repo: REPO, base: BASE, head: branch,
    title: `chore: pricing sync ${date}`,
    body: summary,
  });
  return pr.data.html_url;
}
