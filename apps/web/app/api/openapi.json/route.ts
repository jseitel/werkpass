import { createOpenApiDocument } from "../openapi";

export async function GET(request: Request) {
  return Response.json(createOpenApiDocument(new URL(request.url).origin), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
