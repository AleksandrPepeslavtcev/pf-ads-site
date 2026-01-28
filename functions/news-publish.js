// Cloudflare Pages Function: /functions/news-publish
// Publishes a news post (usually mirrored from LinkedIn) into the repo:
// - Creates /news/{yyyy-mm-dd}-{slug}.html
// - Updates /news/index.json with metadata
// Requires env: GITHUB_TOKEN (fine-grained, repo write), optional GITHUB_REPO, GITHUB_BRANCH

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    if (!env.GITHUB_TOKEN) {
      return json({ success: false, error: 'GITHUB_TOKEN not configured' }, 500);
    }

    const body = await request.json();
    const { title, content, date, linkedin_url, source = 'LinkedIn', image_base64, image_mime, image_alt } = body || {};
    if (!title || !content) {
      return json({ success: false, error: 'title and content are required' }, 400);
    }

    const d = date ? new Date(date) : new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const slug = (title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\-\s]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80) || `${dateStr}`;

    const filename = `${dateStr}-${slug}.html`;
    const pagePath = `news/${filename}`;
    const pageUrl = `/news/${filename}`;

    const repo = env.GITHUB_REPO || 'AleksandrPepeslavtcev/pf-ads-site';
    const branch = env.GITHUB_BRANCH || 'main';

    // Optional: upload image if provided as base64
    let uploadedImageUrl = '';
    if (image_base64 && typeof image_base64 === 'string') {
      const ext = extFromMime(image_mime);
      const imgName = `${dateStr}-${slug}.${ext}`;
      const imgPath = `assets/images/uploads/news/${imgName}`;
      await githubPutFile({
        repo,
        branch,
        path: imgPath,
        content: image_base64,
        token: env.GITHUB_TOKEN,
        message: `Image for news: ${title}`,
        isBase64: true,
      });
      uploadedImageUrl = `/${imgPath}`;
    }

    const contentHtml = renderContent(content);
    const pageHtml = buildNewsHtml({ title, content: contentHtml, date: d.toISOString(), linkedin_url, image_url: uploadedImageUrl, image_alt, page_url: pageUrl });

    // 1) Create/replace the news HTML page
    await githubPutFile({
      repo,
      branch,
      path: pagePath,
      content: pageHtml,
      token: env.GITHUB_TOKEN,
      message: `News: ${title}`,
    });

    // 2) Update index.json (append entry, sorted by date desc)
    const indexPath = 'news/index.json';
    let entries = [];
    try {
      const current = await githubGetFile({ repo, path: indexPath, token: env.GITHUB_TOKEN, branch });
      if (current && current.content) {
        const decoded = JSON.parse(fromBase64Utf8(current.content));
        if (Array.isArray(decoded)) entries = decoded;
      }
    } catch (_) { /* ignore if index.json not found yet */ }

    const excerpt = (content || '').replace(/<[^>]*>/g, '').split('\n').slice(0, 3).join(' ').slice(0, 200);
    const newEntry = { title, url: pageUrl, date: d.toISOString(), source, linkedin_url: linkedin_url || '', excerpt };

    // De-duplicate by url
    const filtered = entries.filter(e => e.url !== pageUrl);
    filtered.push(newEntry);
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    await githubPutFile({
      repo,
      branch,
      path: indexPath,
      content: JSON.stringify(filtered, null, 2) + '\n',
      token: env.GITHUB_TOKEN,
      message: `Update news index for: ${title}`,
    });

    // 3) Update sitemap.xml to include all news entries
    await updateSitemap({ repo, branch, token: env.GITHUB_TOKEN, entries: filtered });

    return json({ success: true, url: pageUrl });
  } catch (err) {
    return json({ success: false, error: err.message, stack: err.stack }, 500);
  }
}

// --- Web base64 helpers (no Node Buffer required) ---
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

function buildNewsHtml({ title, content, date, linkedin_url, image_url, image_alt, page_url }) {
  const safeTitle = escapeHtml(title || '');
  const byline = [new Date(date || Date.now()).toLocaleDateString('en-US'), linkedin_url ? `<a href="${escapeAttr(linkedin_url)}" target="_blank" rel="noopener">LinkedIn</a>` : '']
    .filter(Boolean)
    .join(' | ');

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle} | PF ADS</title>
<meta name="description" content="${safeTitle}">
<link rel="icon" type="image/png" href="/assets/favicon-32.png" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-48.png" sizes="48x48">
<link rel="apple-touch-icon" href="/assets/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta property="og:type" content="article">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeTitle}">
<meta property="og:image" content="${image_url ? escapeAttr(image_url) : '/images/banner.png'}">
<link rel="stylesheet" href="/styles.css">
<link rel="canonical" href="https://www.pf-ads.com${escapeAttr(page_url || '')}">
<meta property="og:url" content="https://www.pf-ads.com${escapeAttr(page_url || '')}">
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: safeTitle,
    datePublished: date || new Date().toISOString(),
    author: { '@type': 'Organization', name: 'PF Automation & Digital Solutions' },
    publisher: { '@type': 'Organization', name: 'PF Automation & Digital Solutions', logo: { '@type': 'ImageObject', url: 'https://www.pf-ads.com/assets/icon-192.png' } },
    image: image_url || '/images/banner.png',
    mainEntityOfPage: `https://www.pf-ads.com${page_url || ''}`
  })}</script>
</head><body>
  <div class="nav container">
    <div class="brand">
      <img src="/images/logo.png" alt="PF ADS logo"><div></div>
    </div>
    <div style="display:flex;gap:16px">
      <a href="/index.html">Home</a>
      <a href="/news.html">News</a>
      <a href="/matrix.html">Evaluation Matrix</a>
      <a href="/contact.html">Contact</a>
      
  </div>
  <div class='container'>
    <div class="hero"><img src="/images/banner.png" alt="News"><div class="hero-content">
      <span class="badge">Update</span>
      <h1>${safeTitle}</h1>
      <p>${byline}</p>
    </div></div>
    <section class="section">
      ${image_url ? `<figure><img src="${escapeAttr(image_url)}" alt="${escapeAttr(image_alt || safeTitle)}" class="post-image"></figure>` : ''}
      ${content}
    </section>
    <p><a href="/news.html">&larr; Back to News</a></p>
  </div>
  <div class='footer container'>&copy; 2025 PF Automation & Digital Solutions &middot; <a href='mailto:info@pf-ads.com'>info@pf-ads.com</a> &middot; <a href='https://www.linkedin.com/company/pf-ads/' target='_blank' rel='noopener'>LinkedIn</a> &middot; <a href='https://wa.me/358504301138' target='_blank' rel='noopener'>WhatsApp</a> &middot; +358-50-430-1138</div>
</body></html>`;
}

// Render plain text/Markdown-ish into HTML paragraphs if no HTML tags present
function renderContent(raw){
  const s = String(raw || '').trim();
  // If it already looks like HTML (has a tag), return as is
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  // Escape and convert blank-line separated paragraphs
  const esc = s.replace(/[&<>]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c]));
  const paras = esc.split(/\r?\n\s*\r?\n/g).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`);
  return paras.join('\n');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

async function githubPutFile({ repo, branch, path, content, token, message, isBase64 }) {
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
      content: isBase64 ? content : toBase64Utf8(typeof content === 'string' ? content : String(content)),
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

async function updateSitemap({ repo, branch, token, entries }) {
  const site = 'https://www.pf-ads.com';
  const staticPages = ["/","/package1","/package2","/package3","/package4","/news","/matrix","/contact","/about"];
  const urls = [
    ...staticPages.map(p => `${site}${p}`),
    ...entries.map(e => `${site}${e.url}`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`;
  await githubPutFile({ repo, branch, path: 'sitemap.xml', content: xml, token, message: 'Update sitemap.xml with news entries' });
}

function extFromMime(m) {
  switch (String(m||'').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
  }
}

function json(obj, status=200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
