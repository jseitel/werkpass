import { randomBytes } from "node:crypto";
import { prisma, type Invitation, type Member } from "@werkpass/db";

export type OrganizationRole = "admin" | "editor" | "viewer";

export type InviteOrganizationMemberResult =
  | { status: "already-member" }
  | { status: "invitation-created"; invitationId: string };

export function isOrganizationRole(value: string): value is OrganizationRole {
  return value === "admin" || value === "editor" || value === "viewer";
}

/** Membership roles are stored as a comma-separated list. */
export function organizationRoleList(role: string): string[] {
  return role
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isOrganizationOwnerRole(role: string): boolean {
  return organizationRoleList(role).includes("owner");
}

export function listOrganizationMembers(organizationId: string) {
  return prisma.member.findMany({
    where: { organizationId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
}

export function listUserOrganizations(userId: string) {
  return prisma.member.findMany({
    where: { userId },
    select: {
      role: true,
      organization: {
        select: { id: true, name: true, slug: true, logo: true },
      },
    },
    orderBy: { organization: { name: "asc" } },
  });
}

export async function getDefaultOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultOrganizationId: true },
  });
  return user?.defaultOrganizationId ?? null;
}

export async function setDefaultOrganization(input: {
  userId: string;
  organizationId: string;
}): Promise<void> {
  const membership = await prisma.member.findFirst({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
    },
    select: { id: true },
  });
  if (!membership) throw new Error("Du bist kein Mitglied dieser Organisation.");

  await prisma.user.update({
    where: { id: input.userId },
    data: { defaultOrganizationId: input.organizationId },
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

/**
 * Loads the member a mutation targets and refuses when an admin reaches for an
 * owner. Admins may manage the rest of the organization, but ownership has to
 * stay out of their reach - otherwise an admin can demote or delete the owner
 * and take sole control of the organization, its documents and its SSO setup.
 * The Entra role sync guards ownership the same way.
 */
async function requireManageableMember(input: {
  organizationId: string;
  memberId: string;
  actorIsOwner: boolean;
}): Promise<Member> {
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
  });
  if (!member || member.organizationId !== input.organizationId) {
    throw new Error("Mitglied nicht gefunden.");
  }
  if (isOrganizationOwnerRole(member.role) && !input.actorIsOwner) {
    throw new Error("Nur Owner können die Inhaberrolle ändern.");
  }
  return member;
}

export async function updateOrganizationMemberRole(input: {
  organizationId: string;
  memberId: string;
  role: OrganizationRole;
  actorIsOwner: boolean;
}): Promise<Member> {
  await requireManageableMember(input);

  return prisma.member.update({
    where: { id: input.memberId, organizationId: input.organizationId },
    data: { role: input.role },
  });
}

export async function removeOrganizationMember(input: {
  organizationId: string;
  memberId: string;
  currentUserId: string;
  actorIsOwner: boolean;
}): Promise<void> {
  const member = await requireManageableMember(input);
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
