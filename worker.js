export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/auth") {
      const auth = new URL("https://github.com/login/oauth/authorize");
      auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      auth.searchParams.set("scope", url.searchParams.get("scope") || "repo,user");
      auth.searchParams.set("state", crypto.randomUUID());
      return Response.redirect(auth.toString(), 302);
    }

    if (path === "/api/callback") {
      const code = url.searchParams.get("code");
      if (!code) return new Response('{"error":"Missing code"}', {
        status: 400, headers: { "content-type": "application/json" }
      });

      const r = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code
        }),
      });
      const data = await r.json();
      if (!data.access_token) {
        return new Response(`<pre>OAuth error: ${JSON.stringify(data)}</pre>`, {
          status: 400, headers: { "content-type": "text/html" }
        });
      }

      const html = `<!doctype html><meta charset="utf-8">
<script>
  (function(){
    var payload = { token: ${JSON.stringify(data.access_token)}, provider: "github" };
    try { window.opener && window.opener.postMessage(payload, "*"); } catch(e){}
    window.close();
  })();
</script>
<p>You can close this window.</p>`;
      return new Response(html, { headers: { "content-type": "text/html" } });
    }

    return new Response("OK", { status: 200 });
  },
};
