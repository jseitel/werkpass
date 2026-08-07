"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@werkpass/auth";
import {
  getOrganizationMember,
  setDefaultOrganization,
} from "@werkpass/core";

export type OrganizationActionResult = {
  status: "success" | "error";
  message: string;
};

async function requireMembership(organizationId: string) {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) throw new Error("Bitte erneut anmelden.");
  const membership = await getOrganizationMember(organizationId, session.user.id);
  if (!membership) throw new Error("Du bist kein Mitglied dieser Organisation.");
  return { requestHeaders, userId: session.user.id };
}

export async function switchOrganizationAction(
  organizationId: string,
): Promise<OrganizationActionResult> {
  try {
    const { requestHeaders } = await requireMembership(organizationId);
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId },
    });
    revalidatePath("/dashboard", "layout");
    return { status: "success", message: "Organisation gewechselt." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Wechsel fehlgeschlagen.",
    };
  }
}

export async function setDefaultOrganizationAction(
  organizationId: string,
): Promise<OrganizationActionResult> {
  try {
    const { userId } = await requireMembership(organizationId);
    await setDefaultOrganization({ userId, organizationId });
    revalidatePath("/dashboard", "layout");
    return { status: "success", message: "Standardorganisation gespeichert." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Favorit konnte nicht gespeichert werden.",
    };
  }
}
