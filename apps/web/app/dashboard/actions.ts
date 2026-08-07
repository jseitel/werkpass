"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@lingl-docs/auth";
import {
  createCustomer,
  createMachine,
  createDocument,
  createMachineFolder,
  addDocumentVersion,
  getUploadUrl,
  getMachineById,
  getMachineFolderById,
  getDocumentById,
  getCustomerById,
  countDocumentVersions,
  cancelOrganizationInvitation,
  getOrganizationMember,
  inviteOrganizationMember,
  isOrganizationRole,
  removeOrganizationMember,
  setMachineFolderPin,
  updateOrganizationMemberRole,
  createOrganizationApiKey,
  revokeOrganizationApiKey,
  hashFolderPin,
} from "@lingl-docs/core";

function hasOrganizationRole(
  member: { role: string } | null,
  allowedRoles: string[],
): boolean {
  if (!member) return false;
  const roles = member.role
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  return allowedRoles.some((role) => roles.includes(role));
}

async function requireOrganizationId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/dashboard");
  return session.session.activeOrganizationId;
}

async function requireSessionAndOrganization() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  if (!session.session.activeOrganizationId) redirect("/dashboard");
  return {
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId,
  };
}

async function requireOrganizationAdmin() {
  const { userId, organizationId } = await requireSessionAndOrganization();
  const member = await getOrganizationMember(organizationId, userId);
  if (!hasOrganizationRole(member, ["owner", "admin"])) {
    throw new Error("Nur Admins können Nutzer verwalten.");
  }
  return { userId, organizationId };
}

async function requireDocumentEditor() {
  const { userId, organizationId } = await requireSessionAndOrganization();
  const member = await getOrganizationMember(organizationId, userId);
  if (!hasOrganizationRole(member, ["owner", "admin", "editor"])) {
    throw new Error("Nur Admins und Editoren können Dokumente bearbeiten.");
  }
  return { userId, organizationId };
}

/** Verifies the machine belongs to the caller's organization before any mutation touches it. */
async function requireMachineInOwnOrg(machineId: string) {
  const { userId, organizationId } = await requireDocumentEditor();
  const machine = await getMachineById(machineId);
  if (!machine || machine.organizationId !== organizationId) {
    throw new Error("Maschine nicht gefunden");
  }
  return { machine, userId, organizationId };
}

async function requireCustomerInOwnOrg(customerId: string) {
  const organizationId = await requireOrganizationId();
  const customer = await getCustomerById(customerId);
  if (!customer || customer.organizationId !== organizationId) {
    throw new Error("Kunde nicht gefunden");
  }
  return customer;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createMachineAction(formData: FormData) {
  const { organizationId } = await requireOrganizationAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  await requireCustomerInOwnOrg(customerId);
  const name = String(formData.get("name") ?? "");
  const serialNumber = String(formData.get("serialNumber") ?? "");
  const slug = `${slugify(name)}-${randomBytes(3).toString("hex")}`;

  await createMachine({ organizationId, customerId, name, serialNumber, slug });
  revalidatePath("/dashboard");
}

export async function createCustomerAction(formData: FormData) {
  const { organizationId } = await requireOrganizationAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const customerNumber = String(formData.get("customerNumber") ?? "").trim();

  if (!name) throw new Error("Kundenname fehlt");

  await createCustomer({
    organizationId,
    name,
    customerNumber: customerNumber || undefined,
  });
  revalidatePath("/dashboard");
}

export async function createDocumentAction(machineId: string, formData: FormData) {
  await requireMachineInOwnOrg(machineId);
  const title = String(formData.get("title") ?? "");
  const folderId = String(formData.get("folderId") ?? "");
  const language = String(formData.get("language") ?? "");

  const folder = await getMachineFolderById(folderId);
  if (!folder || folder.machineId !== machineId) {
    throw new Error("Ordner nicht gefunden");
  }

  if (folder.accessLevel === "pin" && !folder.pinHash) {
    throw new Error("Für diesen Ordner muss zuerst eine PIN gesetzt werden");
  }

  await createDocument({
    machineId,
    folderId,
    title,
    category: folder.systemKey ?? "custom",
    accessLevel: folder.accessLevel,
    pinHash: folder.pinHash ?? undefined,
    pinSalt: folder.pinSalt ?? undefined,
    language,
  });
  revalidatePath(`/dashboard/machines/${machineId}`);
  revalidatePath(`/dashboard/machines/${machineId}/folders/${folderId}`);
}

export async function createMachineFolderAction(
  machineId: string,
  formData: FormData,
) {
  const { userId } = await requireMachineInOwnOrg(machineId);
  const name = String(formData.get("name") ?? "").trim();
  const accessLevel = String(formData.get("accessLevel") ?? "public");
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) throw new Error("Ordnername fehlt");
  if (accessLevel !== "public" && accessLevel !== "pin") {
    throw new Error("Ungültige Zugriffsebene");
  }
  if (accessLevel === "pin" && (pin.length < 6 || pin.length > 64)) {
    throw new Error("Die PIN muss 6 bis 64 Zeichen lang sein");
  }

  const pinData = accessLevel === "pin" ? hashFolderPin(pin) : undefined;

  await createMachineFolder({
    machineId,
    name,
    accessLevel,
    pinHash: pinData?.pinHash,
    pinSalt: pinData?.pinSalt,
    pinChangedAt: pinData ? new Date() : undefined,
    pinChangedById: pinData ? userId : undefined,
  });
  revalidatePath(`/dashboard/machines/${machineId}`);
}

export type FolderPinActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function changeMachineFolderPinAction(
  machineId: string,
  folderId: string,
  _previousState: FolderPinActionState,
  formData: FormData,
): Promise<FolderPinActionState> {
  try {
    const { machine, userId } = await requireMachineInOwnOrg(machineId);
    const folder = await getMachineFolderById(folderId);
    if (!folder || folder.machineId !== machine.id) {
      return { status: "error", message: "Ordner nicht gefunden." };
    }
    if (folder.accessLevel !== "pin") {
      return { status: "error", message: "Dieser Ordner ist nicht PIN-geschützt." };
    }

    const pin = String(formData.get("pin") ?? "");
    const confirmation = String(formData.get("pinConfirmation") ?? "");
    if (pin.length < 6 || pin.length > 64) {
      return { status: "error", message: "Die PIN muss 6 bis 64 Zeichen lang sein." };
    }
    if (pin !== confirmation) {
      return { status: "error", message: "Die PIN-Bestätigung stimmt nicht überein." };
    }

    const { pinHash, pinSalt } = hashFolderPin(pin);
    await setMachineFolderPin({
      id: folder.id,
      pinHash,
      pinSalt,
      changedById: userId,
    });
    revalidatePath(`/dashboard/machines/${machine.id}`);
    revalidatePath(`/dashboard/machines/${machine.id}/folders/${folder.id}`);
    revalidatePath(`/m/${machine.slug}`);
    return {
      status: "success",
      message: folder.pinHash ? "PIN geändert." : "PIN gesetzt.",
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "PIN konnte nicht gespeichert werden.",
    };
  }
}

export async function requestUploadUrlAction(
  documentId: string,
  fileName: string,
  contentType: string,
) {
  const document = await getDocumentById(documentId);
  if (!document) throw new Error("Dokument nicht gefunden");
  await requireMachineInOwnOrg(document.machineId);

  const storageKey = `documents/${documentId}/${Date.now()}-${fileName}`;
  const uploadUrl = await getUploadUrl(storageKey, contentType);
  return { uploadUrl, storageKey };
}

export async function addDocumentVersionAction(input: {
  documentId: string;
  changeNote?: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksum: string;
}) {
  const document = await getDocumentById(input.documentId);
  if (!document) throw new Error("Dokument nicht gefunden");
  await requireMachineInOwnOrg(document.machineId);

  const existingCount = await countDocumentVersions(input.documentId);

  await addDocumentVersion({
    ...input,
    revision: `Rev. ${String(existingCount + 1).padStart(2, "0")}`,
    changeNote: input.changeNote?.trim() || undefined,
  });
  revalidatePath(`/dashboard/machines/${document.machineId}`);
}

export type InviteMemberActionState = {
  status: "idle" | "success" | "info" | "error";
  message: string;
  invitePath?: string;
};

export async function inviteMemberAction(
  _previousState: InviteMemberActionState,
  formData: FormData,
): Promise<InviteMemberActionState> {
  try {
    const { userId, organizationId } = await requireOrganizationAdmin();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const role = String(formData.get("role") ?? "viewer");

    if (!email) return { status: "error", message: "E-Mail fehlt." };
    if (!isOrganizationRole(role)) {
      return { status: "error", message: "Ungültige Rolle." };
    }

    const result = await inviteOrganizationMember({
      organizationId,
      inviterId: userId,
      email,
      role,
    });
    revalidatePath("/dashboard/users");

    if (result.status === "already-member") {
      return { status: "info", message: "Dieser Nutzer ist bereits Mitglied." };
    }
    return {
      status: "success",
      message: "Einladungslink erstellt. Es wurde keine E-Mail versendet.",
      invitePath: `/accept-invitation/${result.invitationId}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Einladung fehlgeschlagen.",
    };
  }
}

export async function updateMemberRoleAction(formData: FormData) {
  const { organizationId } = await requireOrganizationAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "viewer");

  if (!memberId) throw new Error("Mitglied fehlt");
  if (!isOrganizationRole(role)) throw new Error("Ungültige Rolle");

  await updateOrganizationMemberRole({ organizationId, memberId, role });
  revalidatePath("/dashboard/users");
}

export async function removeMemberAction(formData: FormData) {
  const { userId, organizationId } = await requireOrganizationAdmin();
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) throw new Error("Mitglied fehlt");

  await removeOrganizationMember({ organizationId, memberId, currentUserId: userId });
  revalidatePath("/dashboard/users");
}

export async function cancelInvitationAction(formData: FormData) {
  const { organizationId } = await requireOrganizationAdmin();
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) throw new Error("Einladung fehlt");

  await cancelOrganizationInvitation({ organizationId, invitationId });
  revalidatePath("/dashboard/users");
}

export type ApiKeyActionResult =
  | {
      status: "success";
      message: string;
      token?: string;
    }
  | { status: "error"; message: string };

export async function createApiKeyAction(name: string): Promise<ApiKeyActionResult> {
  try {
    const { userId, organizationId } = await requireOrganizationAdmin();
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return { status: "error", message: "Der Name muss 2 bis 80 Zeichen lang sein." };
    }

    const result = await createOrganizationApiKey({
      organizationId,
      createdById: userId,
      name: trimmedName,
    });
    revalidatePath("/dashboard/profile");
    return {
      status: "success",
      message: "API-Schlüssel erstellt.",
      token: result.token,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "API-Schlüssel konnte nicht erstellt werden.",
    };
  }
}

export async function revokeApiKeyAction(apiKeyId: string): Promise<ApiKeyActionResult> {
  try {
    const { organizationId } = await requireOrganizationAdmin();
    await revokeOrganizationApiKey({ organizationId, apiKeyId });
    revalidatePath("/dashboard/profile");
    return { status: "success", message: "API-Schlüssel widerrufen." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Widerrufen fehlgeschlagen.",
    };
  }
}
