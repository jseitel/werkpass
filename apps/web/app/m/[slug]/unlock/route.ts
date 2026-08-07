import { NextResponse } from "next/server";
import {
  getMachineBySlug,
  getMachineFolderById,
  verifyFolderPin,
} from "@lingl-docs/core";
import { folderPinCookieName, folderUnlockToken } from "../pin-access";

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

  const folder = await getMachineFolderById(folderId);
  const matches =
    folder?.machineId === machine.id &&
    folder.accessLevel === "pin" &&
    verifyFolderPin(pin, folder.pinSalt, folder.pinHash);

  const redirectUrl = new URL(`/m/${slug}`, request.url);
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
    maxAge: 60 * 60,
    },
  );
  return response;
}
