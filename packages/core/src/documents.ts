import { prisma, type Document, type DocumentVersion } from "@lingl-docs/db";

export interface CreateDocumentInput {
  machineId: string;
  folderId: string;
  title: string;
  category?: string;
  accessLevel?: string;
  pinHash?: string;
  pinSalt?: string;
  /** BCP-47 language tag, e.g. "de-DE". */
  language: string;
}

export function createDocument(input: CreateDocumentInput): Promise<Document> {
  return prisma.document.create({ data: input });
}

export interface AddDocumentVersionInput {
  documentId: string;
  revision: string;
  changeNote?: string;
  status?: string;
  publishedAt?: Date;
  approvedById?: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksum: string;
  createdById?: string;
}

/**
 * Adds a new version and makes it the current one. Older versions are kept
 * (not deleted) to satisfy the archiving/compliance requirement.
 */
export async function addDocumentVersion(
  input: AddDocumentVersionInput,
): Promise<DocumentVersion> {
  return prisma.$transaction(async (tx) => {
    await tx.documentVersion.updateMany({
      where: { documentId: input.documentId, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.documentVersion.create({
      data: {
        ...input,
        status: input.status ?? "published",
        publishedAt: input.publishedAt ?? new Date(),
        isCurrent: true,
      },
    });
  });
}

export function getCurrentVersion(
  documentId: string,
): Promise<DocumentVersion | null> {
  return prisma.documentVersion.findFirst({
    where: { documentId, isCurrent: true },
  });
}

export function getCurrentPublishedVersion(
  documentId: string,
): Promise<DocumentVersion | null> {
  return prisma.documentVersion.findFirst({
    where: { documentId, isCurrent: true, status: "published" },
  });
}

export function listDocumentVersions(
  documentId: string,
): Promise<DocumentVersion[]> {
  return prisma.documentVersion.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
  });
}

export function listDocumentsForMachine(machineId: string) {
  return prisma.document.findMany({
    where: { machineId },
    include: { folder: true },
    orderBy: [{ folder: { position: "asc" } }, { title: "asc" }],
  });
}

export function listDocumentsForFolder(folderId: string) {
  return prisma.document.findMany({
    where: { folderId },
    orderBy: { title: "asc" },
  });
}

export function listDocumentsForOrganization(organizationId: string) {
  return prisma.document.findMany({
    where: { machine: { organizationId } },
    include: { machine: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function listDocumentVersionsForOrganization(organizationId: string) {
  return prisma.documentVersion.findMany({
    where: { document: { machine: { organizationId } } },
    include: {
      document: {
        include: {
          machine: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getDocumentById(id: string): Promise<Document | null> {
  return prisma.document.findUnique({ where: { id } });
}

export function countDocumentVersions(documentId: string): Promise<number> {
  return prisma.documentVersion.count({ where: { documentId } });
}

export function getPublishedDocumentVersionById(
  id: string,
): Promise<DocumentVersion | null> {
  return prisma.documentVersion.findFirst({
    where: { id, status: "published" },
  });
}

export function getPublishedDocumentVersionForDownload(id: string) {
  return prisma.documentVersion.findFirst({
    where: { id, status: "published" },
    include: {
      document: {
        include: {
          machine: true,
          folder: true,
        },
      },
    },
  });
}
