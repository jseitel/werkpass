import QRCode from "qrcode";

/**
 * Builds the permanent, short URL a machine's QR code points to. Keeping
 * this in one place is what lets the 10-year URL guarantee survive a future
 * backend or domain migration - only this function needs to change.
 */
export function buildMachineUrl(slug: string, baseUrl: string): string {
  return new URL(`/m/${slug}`, baseUrl).toString();
}

export async function generateMachineQrCodePng(
  slug: string,
  baseUrl: string,
): Promise<Buffer> {
  const url = buildMachineUrl(slug, baseUrl);
  return QRCode.toBuffer(url, { type: "png", errorCorrectionLevel: "M" });
}
