// GET /oauth/auth -> редирект на GitHub OAuth с установкой state-cookie
export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  // Генерим state
  const state = crypto.randomUUID();

  // Сохраняем state в HttpOnly cookie (SameSite=Lax, Secure)
  const cookie = [
    `gh_oauth_state=${state}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    // При желании можно добавить Max-Age=600
  ].join("; ");

  const clientId = env.GITHUB_CLIENT_ID;
  const scope = env.GITHUB_SCOPE || "repo"; // или "public_repo"
  const redirectUri = `${url.origin}/oauth/callback`;

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("allow_signup", "false");

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
}
