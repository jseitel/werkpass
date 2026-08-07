import { prisma, type MachineFolder } from "@werkpass/db";

export interface CreateMachineFolderInput {
  machineId: string;
  name: string;
  accessLevel: "public" | "pin";
  pinHash?: string;
  pinSalt?: string;
  pinChangedAt?: Date;
  pinChangedById?: string;
}

export function createMachineFolder(
  input: CreateMachineFolderInput,
): Promise<MachineFolder> {
  return prisma.machineFolder.create({
    data: {
      ...input,
      position: 100,
    },
  });
}

export function listMachineFolders(machineId: string) {
  return prisma.machineFolder.findMany({
    where: { machineId },
    include: { documents: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
}

export function getMachineFolderById(id: string): Promise<MachineFolder | null> {
  return prisma.machineFolder.findUnique({ where: { id } });
}

export async function getPinChangedByName(userId: string | null) {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return user?.name ?? null;
}

export function setMachineFolderPin(input: {
  id: string;
  pinHash: string;
  pinSalt: string;
  changedById: string;
}): Promise<MachineFolder> {
  return prisma.$transaction(async (tx) => {
    const folder = await tx.machineFolder.update({
      where: { id: input.id },
      data: {
        pinHash: input.pinHash,
        pinSalt: input.pinSalt,
        pinChangedAt: new Date(),
        pinChangedById: input.changedById,
      },
    });

    // Keep legacy document fields synchronized while all access checks move to
    // the folder itself. They can be removed in a later cleanup migration.
    await tx.document.updateMany({
      where: { folderId: input.id, accessLevel: "pin" },
      data: { pinHash: input.pinHash, pinSalt: input.pinSalt },
    });

    return folder;
  });
}
