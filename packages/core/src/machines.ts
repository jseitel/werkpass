import { prisma, type Machine } from "@werkpass/db";

export const STANDARD_MACHINE_FOLDERS = [
  { name: "Betriebsanleitungen", systemKey: "manual", accessLevel: "public", position: 10 },
  { name: "Sicherheit", systemKey: "safety", accessLevel: "public", position: 20 },
  { name: "Wartung", systemKey: "maintenance", accessLevel: "public", position: 30 },
  { name: "Ersatzteile", systemKey: "spare-parts", accessLevel: "public", position: 40 },
  { name: "Konformität", systemKey: "declaration", accessLevel: "public", position: 50 },
  { name: "Elektropläne", systemKey: "wiring", accessLevel: "pin", position: 60 },
  { name: "CAD und Zeichnungen", systemKey: "cad", accessLevel: "pin", position: 70 },
  { name: "Service", systemKey: "service", accessLevel: "pin", position: 80 },
] as const;

export interface CreateMachineInput {
  organizationId: string;
  customerId: string;
  name: string;
  serialNumber: string;
  /** Stable slug for the permanent QR-code URL (/m/{slug}). Must stay constant for the machine's lifetime. */
  slug: string;
}

export function createMachine(input: CreateMachineInput): Promise<Machine> {
  return prisma.machine.create({
    data: {
      ...input,
      folders: {
        create: STANDARD_MACHINE_FOLDERS.map((folder) => ({ ...folder })),
      },
    },
  });
}

export function getMachineBySlug(slug: string): Promise<Machine | null> {
  return prisma.machine.findUnique({ where: { slug } });
}

export function listMachines(organizationId: string): Promise<Machine[]> {
  return prisma.machine.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export function listMachinesForCustomer(customerId: string): Promise<Machine[]> {
  return prisma.machine.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

export function getMachineById(id: string): Promise<Machine | null> {
  return prisma.machine.findUnique({ where: { id } });
}
