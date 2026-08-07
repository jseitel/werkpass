const dateTime = { type: "string", format: "date-time" } as const;

const errorResponse = {
  description: "API key missing, invalid, expired, or revoked",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "UNAUTHORIZED" },
              message: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function listResponse(itemRef: string) {
  return {
    description: "Successful response",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["data"],
          properties: {
            data: { type: "array", items: { $ref: itemRef } },
          },
        },
      },
    },
  };
}

export function createOpenApiDocument(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "lingl-docs API",
      version: "1.0.0",
      description:
        "Read-only access to customers, machines, and document metadata of one organization.",
    },
    servers: [{ url: `${origin}/api/v1`, description: "Current installation" }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "Customers", description: "Organization customers" },
      { name: "Machines", description: "Customer machines" },
      { name: "Documents", description: "Machine document metadata" },
    ],
    paths: {
      "/customers": {
        get: {
          tags: ["Customers"],
          summary: "List customers",
          operationId: "listCustomers",
          responses: { "200": listResponse("#/components/schemas/Customer"), "401": errorResponse },
        },
      },
      "/machines": {
        get: {
          tags: ["Machines"],
          summary: "List machines",
          operationId: "listMachines",
          parameters: [
            {
              name: "customerId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Only machines assigned to this customer",
            },
          ],
          responses: { "200": listResponse("#/components/schemas/Machine"), "401": errorResponse },
        },
      },
      "/documents": {
        get: {
          tags: ["Documents"],
          summary: "List document metadata",
          description: "Returns metadata only. Protected files and storage keys are never exposed.",
          operationId: "listDocuments",
          parameters: [
            {
              name: "machineId",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Only documents assigned to this machine",
            },
          ],
          responses: { "200": listResponse("#/components/schemas/Document"), "401": errorResponse },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API key",
          description: "Use an organization API key beginning with ld_live_",
        },
      },
      schemas: {
        Customer: {
          type: "object",
          required: ["id", "name", "createdAt", "updatedAt"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            customerNumber: { type: ["string", "null"] },
            createdAt: dateTime,
            updatedAt: dateTime,
          },
        },
        Machine: {
          type: "object",
          required: ["id", "customerId", "name", "serialNumber", "slug"],
          properties: {
            id: { type: "string" },
            customerId: { type: "string" },
            name: { type: "string" },
            serialNumber: { type: "string" },
            slug: { type: "string" },
            createdAt: dateTime,
            updatedAt: dateTime,
            customer: {
              type: "object",
              properties: {
                name: { type: "string" },
                customerNumber: { type: ["string", "null"] },
              },
            },
          },
        },
        DocumentVersion: {
          type: "object",
          properties: {
            id: { type: "string" },
            revision: { type: "string" },
            changeNote: { type: ["string", "null"] },
            publishedAt: { oneOf: [dateTime, { type: "null" }] },
            fileName: { type: "string" },
            mimeType: { type: "string" },
            fileSizeBytes: { type: "integer" },
            checksum: { type: "string" },
          },
        },
        Document: {
          type: "object",
          required: ["id", "machineId", "folderId", "title", "accessLevel", "language"],
          properties: {
            id: { type: "string" },
            machineId: { type: "string" },
            folderId: { type: "string" },
            title: { type: "string" },
            category: { type: "string" },
            accessLevel: { type: "string", enum: ["public", "pin"] },
            language: { type: "string" },
            createdAt: dateTime,
            updatedAt: dateTime,
            folder: {
              type: "object",
              properties: { name: { type: "string" } },
            },
            versions: {
              type: "array",
              maxItems: 1,
              items: { $ref: "#/components/schemas/DocumentVersion" },
            },
          },
        },
      },
    },
  };
}
