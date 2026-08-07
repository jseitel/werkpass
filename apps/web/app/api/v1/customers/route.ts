import { listApiCustomers } from "@werkpass/core";
import {
  apiResponse,
  authorizeApiRequest,
  unauthorizedApiResponse,
} from "../_auth";

export async function GET(request: Request) {
  const apiKey = await authorizeApiRequest(request);
  if (!apiKey) return unauthorizedApiResponse();

  return apiResponse(await listApiCustomers(apiKey.organizationId));
}
