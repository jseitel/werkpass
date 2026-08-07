import { randomBytes } from "node:crypto";
import { prisma, type Invitation, type Member } from "@lingl-docs/db";

export type OrganizationRole = "admin" | "editor" | "viewer";

export type InviteOrganizationMemberResult =
  | { status: "already-member" }
  | { status: "invitation-created"; invitationId: string };

export function isOrganizationRole(value: string): value is OrganizationRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

export function listOrganizationMembers(organizationId: string) {
  return prisma.member.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

export function listOrganizationInvitations(
  organizationId: string,
): Promise<Invitation[]> {
  return prisma.invitation.findMany({
    where: { organizationId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function getOrganizationMember(
  organizationId: string,
  userId: string,
): Promise<Member | null> {
  return prisma.member.findFirst({
    where: { organizationId, userId },
  });
}

export async function inviteOrganizationMember(input: {
  organizationId: string;
  inviterId: string;
  email: string;
  role: OrganizationRole;
}): Promise<InviteOrganizationMemberResult> {
  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: input.organizationId,
      user: { email: input.email },
    },
  });
  if (existingMember) {
    return { status: "already-member" };
  }

  await prisma.invitation.updateMany({
    where: {
      organizationId: input.organizationId,
      email: input.email,
      status: "pending",
    },
    data: { status: "canceled" },
  });

  const invitation = await prisma.invitation.create({
    data: {
      id: `inv_${randomBytes(16).toString("hex")}`,
      organizationId: input.organizationId,
      email: input.email,
      role: input.role,
      status: "pending",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      inviterId: input.inviterId,
    },
  });
  return { status: "invitation-created", invitationId: invitation.id };
}

export function getOrganizationInvitationById(id: string) {
  return prisma.invitation.findUnique({
    where: { id },
    include: { organization: true },
  });
}

export function updateOrganizationMemberRole(input: {
  organizationId: string;
  memberId: string;
  role: OrganizationRole;
}): Promise<Member> {
  return prisma.member.update({
    where: { id: input.memberId, organizationId: input.organizationId },
    data: { role: input.role },
  });
}

export async function removeOrganizationMember(input: {
  organizationId: string;
  memberId: string;
  currentUserId: string;
}): Promise<void> {
  const member = await prisma.member.findUnique({ where: { id: input.memberId } });
  if (!member || member.organizationId !== input.organizationId) {
    throw new Error("Mitglied nicht gefunden.");
  }
  if (member.userId === input.currentUserId) {
    throw new Error("Du kannst dich nicht selbst entfernen.");
  }

  await prisma.member.delete({ where: { id: input.memberId } });
}

export async function cancelOrganizationInvitation(input: {
  organizationId: string;
  invitationId: string;
}): Promise<void> {
  await prisma.invitation.update({
    where: { id: input.invitationId, organizationId: input.organizationId },
    data: { status: "canceled" },
  });
}
