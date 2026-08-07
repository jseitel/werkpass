import { listApiDocuments } from "@werkpass/core";
import {
  apiResponse,
  authorizeApiRequest,
  unauthorizedApiResponse,
} from "../_auth";

export async function GET(request: Request) {
  const apiKey = await authorizeApiRequest(request);
  if (!apiKey) return unauthorizedApiResponse();

  const machineId = new URL(request.url).searchParams.get("machineId") ?? undefined;
  return apiResponse(await listApiDocuments(apiKey.organizationId, machineId));
}
