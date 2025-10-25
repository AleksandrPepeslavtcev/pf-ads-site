// Cloudflare Pages Function: /functions/linkedin-org-posts
// Fetch recent LinkedIn organization posts (requires a valid user access token with r_organization_social)

export async function onRequestPost(context) {
  try {
    const { request } = context;
    const body = await request.json();
    const { action, access_token, org_id } = body || {};

    if (action !== 'get_posts') {
      return json({ success: false, error: 'Invalid action' }, 400);
    }
    if (!access_token || !org_id) {
      return json({ success: false, error: 'access_token and org_id required' }, 400);
    }

    // Fetch last posts from organization
    const authors = `urn:li:organization:${encodeURIComponent(org_id)}`;
    const url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${authors})&sortBy=LAST_MODIFIED&count=10`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202304',
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LinkedIn org posts error: ${res.status} ${text}`);
    }
    const data = await res.json();

    const posts = [];
    if (Array.isArray(data.elements)) {
      for (const post of data.elements) {
        const details = post; // already detailed enough for basic content
        const title = extractTitle(details);
        const content = extractContent(details);
        const created = details.created && details.created.time ? new Date(details.created.time).toISOString() : new Date().toISOString();
        const linkedin_url = `https://www.linkedin.com/feed/update/${post.id}`;
        posts.push({ id: post.id, title, content, date: created, linkedin_url, raw: details });
      }
    }

    return json({ success: true, posts });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

function extractTitle(post) {
  const sc = post?.specificContent?.['com.linkedin.ugc.ShareContent'];
  const text = sc?.shareCommentary?.text || 'LinkedIn Post';
  const first = text.split('\n')[0].trim();
  return first.length > 80 ? first.slice(0, 80) + '…' : (first || 'LinkedIn Post');
}

function extractContent(post) {
  const sc = post?.specificContent?.['com.linkedin.ugc.ShareContent'];
  let out = '';
  if (sc?.shareCommentary?.text) out += `<p>${escapeHtml(sc.shareCommentary.text).replace(/\n/g,'<br>')}</p>`;
  if (Array.isArray(sc?.media) && sc.media.length > 0) {
    out += '<hr><p><em>Post contains media (images/video).</em></p>';
  }
  out += '<p><em>Mirrored from LinkedIn</em></p>';
  return out;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

function json(obj, status=200) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }

