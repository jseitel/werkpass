import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@werkpass/auth";
import { generateMachineQrCodePng, getMachineById } from "@werkpass/core";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.session.activeOrganizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const machine = await getMachineById(id);
  if (
    !machine ||
    machine.organizationId !== session.session.activeOrganizationId
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `${new URL(request.url).protocol}//${new URL(request.url).host}`;
  const png = await generateMachineQrCodePng(machine.slug, baseUrl);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="${machine.slug}-qr.png"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
