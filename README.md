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
