import { NextResponse } from "next/server";
import {
  clientIpAddress,
  getMachineBySlug,
  getMachineFolderById,
  recordFolderPinAttempt,
  tooManyFailedPinAttempts,
  verifyFolderPin,
} from "@werkpass/core";
import {
  FOLDER_UNLOCK_TTL_SECONDS,
  folderPinCookieName,
  folderUnlockToken,
} from "../pin-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const formData = await request.formData();
  const pin = String(formData.get("pin") ?? "");
  const folderId = String(formData.get("folderId") ?? "");
  const machine = await getMachineBySlug(slug);

  if (!machine) {
    return NextResponse.redirect(new URL("/404", request.url));
  }

  const redirectUrl = new URL(`/m/${slug}`, request.url);
  const ipAddress = clientIpAddress(request.headers);
  const folder = await getMachineFolderById(folderId);

  if (folder?.machineId === machine.id && folder.accessLevel === "pin") {
    if (await tooManyFailedPinAttempts(folder.id, ipAddress)) {
      redirectUrl.searchParams.set("pin", "locked");
      redirectUrl.searchParams.set("folder", folderId);
      return NextResponse.redirect(redirectUrl);
    }
  }

  const matches =
    folder?.machineId === machine.id &&
    folder.accessLevel === "pin" &&
    verifyFolderPin(pin, folder.pinSalt, folder.pinHash);

  if (folder?.machineId === machine.id && folder.accessLevel === "pin") {
    await recordFolderPinAttempt({
      folderId: folder.id,
      organizationId: machine.organizationId,
      ipAddress,
      userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
      success: Boolean(matches),
    });
  }

  if (!matches) {
    redirectUrl.searchParams.set("pin", "invalid");
    if (folderId) redirectUrl.searchParams.set("folder", folderId);
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(
    folderPinCookieName(folder.id),
    folderUnlockToken(slug, folder.id, folder.pinHash!),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: FOLDER_UNLOCK_TTL_SECONDS,
    },
  );
  return response;
}
