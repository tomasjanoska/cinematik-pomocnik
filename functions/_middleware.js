export async function onRequest(context) {
  const user = context.env.BASIC_USER;
  const pass = context.env.BASIC_PASSWORD;
  if (!user || !pass) {
    return new Response("Auth not configured", { status: 500 });
  }

  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) {
    return new Response("Invalid auth", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
    });
  }

  const decoded = atob(encoded);
  const colon = decoded.indexOf(":");
  const username = colon < 0 ? decoded : decoded.slice(0, colon);
  const password = colon < 0 ? "" : decoded.slice(colon + 1);

  if (username === user && password === pass) return context.next();

  return new Response("Invalid credentials", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Secure Area"' },
  });
}
