import { auth } from "@lingl-docs/auth";

const swaggerDocument = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <title>lingl-docs Swagger API</title>
    <link rel="stylesheet" href="/swagger-assets/swagger-ui.css" />
    <style>
      html { box-sizing: border-box; overflow-y: scroll; }
      *, *::before, *::after { box-sizing: inherit; }
      body { margin: 0; background: #0d0f12; }
      .swagger-ui .topbar { background: #111318; border-bottom: 1px solid #2a2e35; padding: 10px 0; }
      .swagger-ui .topbar-wrapper img { display: none; }
      .swagger-ui .topbar-wrapper::before { color: #f4f5f7; content: "lingl-docs API"; font: 600 16px system-ui, sans-serif; }
      .swagger-ui, .swagger-ui .info .title, .swagger-ui .info p,
      .swagger-ui .opblock-tag, .swagger-ui table thead tr th,
      .swagger-ui table tbody tr td, .swagger-ui .parameter__name,
      .swagger-ui .response-col_status, .swagger-ui .response-col_description,
      .swagger-ui .model-title, .swagger-ui .model { color: #e8eaed; }
      .swagger-ui .scheme-container, .swagger-ui section.models,
      .swagger-ui .model-container, .swagger-ui input,
      .swagger-ui textarea, .swagger-ui select {
        background: #14171c; color: #e8eaed; box-shadow: none;
      }
      .swagger-ui .opblock-tag, .swagger-ui section.models,
      .swagger-ui .model-container { border-color: #2a2e35; }
      .swagger-ui svg { fill: currentColor; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/swagger-assets/swagger-ui-bundle.js"></script>
    <script src="/swagger-assets/swagger-ui-standalone-preset.js"></script>
    <script>
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          url: "/api/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          displayRequestDuration: true,
          persistAuthorization: true,
          tryItOutEnabled: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout"
        });
      });
    </script>
  </body>
</html>`;

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.redirect(new URL("/sign-in?redirect=/swagger", request.url));
  }

  return new Response(swaggerDocument, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}
