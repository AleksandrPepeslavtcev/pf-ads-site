// Cloudflare Pages Function: GitHub API proxy via PAT
// Маршрут: /api/github/*  →  https://api.github.com/*

export async function onRequest({ request, env, params }) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "https://www.pf-ads.com",
        "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,content-type,if-none-match",
        "access-control-max-age": "600",
      },
    });
  }

  const url = new URL(request.url);
  // Для splat-маршрута [[path]] параметр называется "path" и приходит одной строкой
  const restPath = params?.path ? `/${params.path}` : "";
  const target = `https://api.github.com${restPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.set("authorization", `token ${env.GITHUB_TOKEN}`);
  headers.set("accept", "application/vnd.github+json");
  headers.set("user-agent", "pf-ads-cms-proxy/1.0");
  headers.delete("cookie");
  headers.delete("host");

  const method = request.method.toUpperCase();
  const body = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();

  const gh = await fetch(target, { method, headers, body, redirect: "follow" });

  const out = new Headers(gh.headers);
  out.set("access-control-allow-origin", "https://www.pf-ads.com");
  out.set("access-control-allow-credentials", "true");
  out.set("access-control-expose-headers", "etag, link, location, x-github-request-id, x-ratelimit-remaining, x-ratelimit-limit");
  out.delete("content-security-policy");

  return new Response(gh.body, { status: gh.status, headers: out });
}
