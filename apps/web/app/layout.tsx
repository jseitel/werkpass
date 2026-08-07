import type { Metadata } from "next";
import { ThemeScript } from "./theme-script";
import "./globals.css";

export const metadata: Metadata = {
  title: "werkpass",
  description: "Digitale Maschinendokumentation per QR-Code",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      {/* suppressHydrationWarning: some browser extensions (e.g. ColorZilla)
          inject attributes like cz-shortcut-listen onto <body> before React
          hydrates, which would otherwise log a false-positive mismatch. */}
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
