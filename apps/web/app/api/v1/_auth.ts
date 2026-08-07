import { authenticateApiKey } from "@werkpass/core";

export async function authorizeApiRequest(request: Request, scope = "read") {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = bearerToken ?? request.headers.get("x-api-key")?.trim();
  if (!token) return null;

  const apiKey = await authenticateApiKey(token);
  if (!apiKey) return null;

  const scopes = apiKey.scopes.split(",").map((entry) => entry.trim());
  return scopes.includes(scope) ? apiKey : null;
}

export function unauthorizedApiResponse() {
  return Response.json(
    { error: { code: "UNAUTHORIZED", message: "API key missing or invalid." } },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="werkpass-api"' },
    },
  );
}

export function apiResponse(data: unknown) {
  return Response.json(
    { data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
