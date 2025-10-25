# pf-ads-site
PF Automation and Digital Solutions – Independent Automation &amp; Digitalization Consulting website
## Decap CMS (token-based)

- Platform: Cloudflare Pages
- CMS: Decap (self-hosted UI)
- Auth: GitHub Personal Access Token (fine-grained, repo-scoped)

### Setup
1. Create a fine-grained PAT:
   - Repo access: `pf-ads/website`
   - Permissions → `Contents: Read and write`
2. Cloudflare Pages → Settings → Environment variables:
   - Add `GITHUB_TOKEN` (Secret) with the PAT value.
3. Put CMS files:
   - `/admin/index.html` (loads decap-cms.js)
   - `/admin/config.yml` (uses `auth_type: token`, `token: GITHUB_TOKEN`)
   - `_headers` in repo root:
     ```
     /admin/config.yml
       Cache-Control: no-store
     ```
4. Primary domain: `https://www.pf-ads.com`
5. Open CMS: `https://www.pf-ads.com/admin/` — no login popup, collections appear.

### Troubleshooting
- CMS shows login screen:
  - Hard reload, purge CF cache, ensure `_headers` is deployed.
  - Verify `GITHUB_TOKEN` exists (Secret) and redeploy was done.
  - Check repo/branch in `config.yml`.
- 404 on uploads: ensure `media_folder` exists in repo and `public_folder` is correct.
- Commit authorship: Decap commits via the token identity; adjust commit_messages in `config.yml` if needed.

## News import (LinkedIn → Site)

This repo now includes a lightweight flow to mirror LinkedIn posts to a public `News` section without requiring a full static site generator:

- News list page: `news.html` renders items from `news/index.json`.
- Per‑post pages: HTML files under `news/YYYY-MM-DD-slug.html`.
- Admin helper: `admin/news-import.html` to create or import posts.
- Cloudflare Function: `functions/news-publish.js` writes files to the repo via GitHub API.

### Cloudflare setup
1. Cloudflare Pages → your project → Settings → Environment variables:
   - `GITHUB_TOKEN` (Secret): Fine‑grained Personal Access Token with Contents: Read and write on this repository.
   - Optional: `GITHUB_REPO` (default `AleksandrPepeslavtcev/pf-ads-site`), `GITHUB_BRANCH` (default `main`).
2. Redeploy the site so Pages Functions pick up the env vars.

### Usage
- Open `/admin/news-import.html` on your deployed site.
- Enter Title, optional LinkedIn URL, optional ISO date, and the content (HTML/Markdown accepted).
- Click Publish → a new page is created under `/news/` and the index is updated.

### Advanced: LinkedIn organization import
- Endpoint: `functions/linkedin-org-posts.js` (POST `{ action: 'get_posts', access_token, org_id }`).
- Requirements: A valid LinkedIn user access token with `r_organization_social` for your organization.
- In `admin/news-import.html`, use the “Advanced” section to load recent org posts, then click Publish on selected items.

Notes:
- `functions/linkedin-posts.js` no longer hard‑codes LinkedIn credentials; it expects `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, and optional `LINKEDIN_REDIRECT_URI` via environment if you use the OAuth demos under `/admin/`.
- The site navigation now includes a `News` link.
