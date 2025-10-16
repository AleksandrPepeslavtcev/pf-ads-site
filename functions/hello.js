export async function onRequest() {
  return new Response("hello from pages functions", {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
