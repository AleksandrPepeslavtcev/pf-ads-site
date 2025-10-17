// GET /oauth/callback -> обмен code на access_token и postMessage в окно CMS
export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // читаем state-cookie
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)gh_oauth_state=([^;]+)/);
  const savedState = match ? decodeURIComponent(match[1]) : null;

  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return new Response("Invalid state", { status: 400 });
  }

  // Обмениваем code -> token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "pf-ads-cms-oauth",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/oauth/callback`,
      state: returnedState,
    }),
  });

  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    return new Response(
      `OAuth failed: ${tokenJson.error || "unknown error"}`,
      { status: 400 }
    );
  }

  const token = tokenJson.access_token;

  // Разрешённый origin (куда вернём токен)
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://www.pf-ads.com";

  // Маленькая страница, которая отправит токен обратно в окно CMS
  const html = `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        const data = {
          token: ${JSON.stringify(token)},
          provider: "github"
        };
        // Формат, который ждёт Decap: "authorization:github:success:<token>"
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            'authorization:github:success:' + data.token,
            ${JSON.stringify(allowedOrigin)}
          );
          window.close();
        } else {
          document.write('OK');
        }
      })();
    </script>
  </body>
</html>`;

  // Чистим state-cookie
  const clearCookie = [
    "gh_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  ].join("; ");

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": clearCookie,
      "Cache-Control": "no-store",
    },
  });
}
