// Cloudflare Pages Function: /oauth/callback
// Обрабатывает redirect от GitHub, меняет code -> access_token
// и отправляет токен в окно CMS через postMessage('*').

// NB: Требуются переменные окружения в Pages:
// - GITHUB_CLIENT_ID
// - GITHUB_CLIENT_SECRET

const STATE_COOKIE = "gh_oauth_state";

/**
 * Достаём cookie по имени
 */
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp("(?:^|;\\s*)" + name.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Возвращает небольшую HTML-страницу, которая шлёт результат обратно в opener.
 * type: "success" | "failure"
 * payload: строка (токен или текст ошибки)
 */
function buildPostMessageHtml(type, payload) {
  const msgPrefix =
    type === "success" ? "authorization:github:success:" : "authorization:github:failure:";
  const body = payload ?? "";

  return `<!doctype html>
<html>
  <body>
    <script>
      (function () {
        var message = ${JSON.stringify(msgPrefix)} + ${JSON.stringify(body)};
        try {
          var target = (window.opener && !window.opener.closed) ? window.opener
                     : (window.parent && window.parent !== window ? window.parent : null);
          if (target) {
            // Отправляем всем, чтобы не промахнуться с www / без www / pages.dev
            target.postMessage(message, '*');
            // Закрываем попап, если мы его открывали
            if (window.opener) window.close();
            return;
          }
        } catch (e) { /* игнор */ }
        // fallback — просто покажем результат
        document.write(${JSON.stringify(type.toUpperCase() + ": ")} + ${JSON.stringify(body)});
      })();
    </script>
  </body>
</html>`;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");

  // Читаем сохранённый state из cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const savedState = getCookieValue(cookieHeader, STATE_COOKIE);

  // Заготовка заголовка для очистки state-cookie
  const clearStateCookie =
    `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

  // Базовые проверки
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    const html = buildPostMessageHtml("failure", "invalid_state");
    return new Response(html, {
      status: 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": clearStateCookie,
      },
    });
  }

  // Обмен code -> token у GitHub
  const body = {
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: `${url.origin}/oauth/callback`,
    state: returnedState,
  };

  let tokenJson;
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "pf-ads-cms-oauth",
      },
      body: JSON.stringify(body),
    });

    tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson || !tokenJson.access_token) {
      const reason =
        (tokenJson && (tokenJson.error_description || tokenJson.error)) ||
        "oauth_exchange_failed";
      const html = buildPostMessageHtml("failure", reason);
      return new Response(html, {
        status: 400,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Set-Cookie": clearStateCookie,
        },
      });
    }
  } catch (e) {
    const html = buildPostMessageHtml("failure", "network_error");
    return new Response(html, {
      status: 502,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": clearStateCookie,
      },
    });
  }

  const token = tokenJson.access_token;

  // Успех: отправляем токен в opener
  const successHtml = buildPostMessageHtml("success", token);
  return new Response(successHtml, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": clearStateCookie,
    },
  });
}
