import { listApiMachines } from "@lingl-docs/core";
import {
  apiResponse,
  authorizeApiRequest,
  unauthorizedApiResponse,
} from "../_auth";

export async function GET(request: Request) {
  const apiKey = await authorizeApiRequest(request);
  if (!apiKey) return unauthorizedApiResponse();

  const customerId = new URL(request.url).searchParams.get("customerId") ?? undefined;
  return apiResponse(await listApiMachines(apiKey.organizationId, customerId));
}
