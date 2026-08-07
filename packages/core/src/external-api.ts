import { prisma } from "@lingl-docs/db";

export function listApiCustomers(organizationId: string) {
  return prisma.customer.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      customerNumber: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  });
}

export function listApiMachines(organizationId: string, customerId?: string) {
  return prisma.machine.findMany({
    where: { organizationId, ...(customerId ? { customerId } : {}) },
    select: {
      id: true,
      customerId: true,
      name: true,
      serialNumber: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { name: true, customerNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function listApiDocuments(organizationId: string, machineId?: string) {
  return prisma.document.findMany({
    where: {
      machine: { organizationId },
      ...(machineId ? { machineId } : {}),
    },
    select: {
      id: true,
      machineId: true,
      folderId: true,
      title: true,
      category: true,
      accessLevel: true,
      language: true,
      createdAt: true,
      updatedAt: true,
      folder: { select: { name: true } },
      versions: {
        where: { isCurrent: true, status: "published" },
        select: {
          id: true,
          revision: true,
          changeNote: true,
          publishedAt: true,
          fileName: true,
          mimeType: true,
          fileSizeBytes: true,
          checksum: true,
        },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}
