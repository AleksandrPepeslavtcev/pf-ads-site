// Cloudflare Pages Function: GitHub API proxy
// Маршрут: /api/github/*  →  проксируется на https://api.github.com/*
// Требуется Secret в Pages: GITHUB_TOKEN (fine-grained PAT с Contents: Read & write на нужный репозиторий)

export async function onRequest({ request, env, params }) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  const url = new URL(request.url);
  const restPath = (params?.path ? `/${params.path}` : "") + url.search;
  const target = `https://api.github.com${restPath}`;

  // Готовим заголовки для GitHub
  const headers = new Headers(request.headers);
  headers.set("authorization", `token ${env.GITHUB_TOKEN}`);
  headers.set("accept", "application/vnd.github+json");
  headers.set("user-agent", "pf-ads-cms-proxy/1.0");
  headers.delete("cookie");           // не передаём куки дальше
  headers.delete("host");

  // Тело запроса для методов с body
  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const ghResp = await fetch(target, {
    method,
    headers,
    body,
    redirect: "follow",
  });

  // Пробрасываем ответ, добавляя CORS
  const outHeaders = new Headers(ghResp.headers);
  outHeaders.set("access-control-allow-origin", allowOrigin(url));
  outHeaders.set("access-control-allow-credentials", "true");
  outHeaders.set("access-control-expose-headers", "etag, link, location, x-github-request-id, x-ratelimit-remaining, x-ratelimit-limit");
  outHeaders.delete("content-security-policy");

  return new Response(ghResp.body, {
    status: ghResp.status,
    headers: outHeaders,
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*", // preflight ок
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,if-none-match",
    "access-control-max-age": "600",
  };
}

// В проде лучше жёстко вернуть домен сайта:
function allowOrigin(url) {
  // Разрешаем только наш фронт
  return "https://www.pf-ads.com";
}
