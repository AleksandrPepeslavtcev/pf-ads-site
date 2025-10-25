// Cloudflare Pages Function: /news-delete
// Deletes a news page under /news/ and removes it from /news/index.json
// Security: if env.NEWS_ADMIN_TOKEN is set, require header Authorization: Bearer <token>

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.GITHUB_TOKEN) {
      return json({ success: false, error: 'GITHUB_TOKEN not configured' }, 500);
    }

    // Optional simple auth
    const required = env.NEWS_ADMIN_TOKEN;
    if (required) {
      const auth = request.headers.get('authorization') || '';
      const token = auth.startsWith('Bearer ')? auth.slice(7): '';
      if (token !== required) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
    }

    const body = await request.json().catch(() => ({}));
    let { url, path } = body || {};
    if (!url && !path) {
      return json({ success: false, error: 'Provide url or path of the news page' }, 400);
    }

    // Normalize to repo path under news/
    let pagePath = normalizeNewsPath(url || path);
    if (!pagePath) {
      return json({ success: false, error: 'Invalid path. Must point into /news/' }, 400);
    }

    const repo = env.GITHUB_REPO || 'AleksandrPepeslavtcev/pf-ads-site';
    const branch = env.GITHUB_BRANCH || 'main';

    // 1) Delete the page (requires current sha)
    let sha;
    try {
      const fileResp = await githubGetFile({ repo, path: pagePath, token: env.GITHUB_TOKEN, branch });
      sha = fileResp && fileResp.sha;
    } catch (_) { /* ignore */ }

    if (!sha) {
      // If file already gone, proceed to cleanup index
    } else {
      await githubDeleteFile({ repo, branch, path: pagePath, sha, token: env.GITHUB_TOKEN, message: `Delete ${pagePath}` });
    }

    // 2) Update index.json (remove the entry)
    const indexPath = 'news/index.json';
    try {
      const current = await githubGetFile({ repo, path: indexPath, token: env.GITHUB_TOKEN, branch });
      if (current && current.content) {
        const list = JSON.parse(fromBase64Utf8(current.content));
        const urlToDrop = '/' + pagePath.replace(/\\+/g,'/');
        const filtered = Array.isArray(list) ? list.filter(e => e && e.url !== urlToDrop) : [];
        await githubPutFile({ repo, branch, path: indexPath, content: JSON.stringify(filtered, null, 2) + '\n', token: env.GITHUB_TOKEN, message: `Remove from news index: ${urlToDrop}` });
      }
    } catch (_) { /* ignore if index.json missing */ }

    return json({ success: true, deleted: '/' + pagePath });
  } catch (err) {
    return json({ success: false, error: err.message, stack: err.stack }, 500);
  }
}

function normalizeNewsPath(input) {
  if (!input) return '';
  let s = String(input).trim();
  try {
    if (s.startsWith('http')) {
      const u = new URL(s);
      s = u.pathname;
    }
  } catch (_) {}
  // Ensure leading slash
  if (!s.startsWith('/')) s = '/' + s;
  // Accept /news/<file>
  if (s.startsWith('/news/')) {
    s = s.replace(/^\/+/, '');
    return s;
  }
  // Accept bare filename like 2025-10-25-test.html
  if (/^\/?\d{4}-\d{2}-\d{2}-/.test(s)) {
    s = s.replace(/^\/+/, '');
    return 'news/' + s;
  }
  return '';
}

// --- Web base64 helpers (no Node Buffer) ---
function toBase64Utf8(input){
  const bytes = new TextEncoder().encode(String(input));
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, sub);
  }
  return btoa(binary);
}
function fromBase64Utf8(b64){
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function githubPutFile({ repo, branch, path, content, token, message }) {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
  // Fetch existing sha if present
  let sha;
  const headRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'PF-ADS-Site' }
  });
  if (headRes.ok) {
    const js = await headRes.json();
    sha = js.sha;
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PF-ADS-Site'
    },
    body: JSON.stringify({
      message: message || `update ${path}`,
      content: toBase64Utf8(typeof content === 'string' ? content : String(content)),
      branch,
      ...(sha ? { sha } : {})
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${txt}`);
  }
}

async function githubGetFile({ repo, path, token, branch }) {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}${branch?`?ref=${encodeURIComponent(branch)}`:''}`;
  const res = await fetch(url, { headers: { 'Authorization': `token ${token}`, 'User-Agent': 'PF-ADS-Site' } });
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  return res.json();
}

async function githubDeleteFile({ repo, branch, path, sha, token, message }) {
  const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PF-ADS-Site'
    },
    body: JSON.stringify({ message: message || `delete ${path}`, sha, branch })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub DELETE ${path} failed: ${res.status} ${txt}`);
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

