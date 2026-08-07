"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@lingl-docs/auth";
import { getOrganizationInvitationById } from "@lingl-docs/core";

export async function acceptInvitationAction(formData: FormData) {
  const invitationId = String(formData.get("invitationId") ?? "");
  const invitation = await getOrganizationInvitationById(invitationId);
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`);
  }
  if (
    !invitation ||
    invitation.status !== "pending" ||
    invitation.expiresAt <= new Date() ||
    invitation.email.toLowerCase() !== session.user.email.toLowerCase()
  ) {
    redirect(`/accept-invitation/${invitationId}?error=invalid`);
  }

  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: requestHeaders,
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: invitation.organizationId },
      headers: requestHeaders,
    });
  } catch {
    redirect(`/accept-invitation/${invitationId}?error=failed`);
  }

  redirect("/dashboard");
}
