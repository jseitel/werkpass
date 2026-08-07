"use client";

import { useState } from "react";
import { Button, Input } from "@lingl-docs/ui";

export function InviteLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
  }

  return (
    <div className="flex gap-2">
      <Input value={path} readOnly aria-label="Einladungslink" />
      <Button type="button" variant="outline" onClick={copyLink}>
        {copied ? "Kopiert" : "Link kopieren"}
      </Button>
    </div>
  );
}
