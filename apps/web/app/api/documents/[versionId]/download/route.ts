import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDownloadUrl, getPublishedDocumentVersionForDownload } from "@werkpass/core";
import {
  folderPinCookieName,
  isFolderUnlocked,
} from "@/app/m/[slug]/pin-access";

// Generates the signed URL per request instead of baking one into a cached
// page - keeps the "time-limited signed URL" guarantee meaningful.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const { versionId } = await params;
  const version = await getPublishedDocumentVersionForDownload(versionId);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const machineSlug = version.document.machine.slug;
  const folder = version.document.folder;
  // Deny by default: anything other than the explicit "public" level must
  // clear the folder-unlock check, so a future access level added without
  // updating this route fails closed instead of leaking documents.
  if (
    version.document.accessLevel !== "public" &&
    !isFolderUnlocked(
      machineSlug,
      folder.id,
      folder.pinHash,
      (await cookies()).get(folderPinCookieName(folder.id))?.value,
    )
  ) {
    return NextResponse.json({ error: "PIN required" }, { status: 403 });
  }

  const url = await getDownloadUrl(version.storageKey);
  return NextResponse.redirect(url);
}
