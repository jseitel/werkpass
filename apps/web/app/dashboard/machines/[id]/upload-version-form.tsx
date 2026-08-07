"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestUploadUrlAction, addDocumentVersionAction } from "../../actions";
import { Button, Input } from "@werkpass/ui";

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function UploadVersionForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [changeNote, setChangeNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const [upload, checksum] = await Promise.all([
        requestUploadUrlAction(
          documentId,
          file.name,
          file.type || "application/octet-stream",
        ),
        sha256Hex(file),
      ]);

      // The server decides the key and the content type; both are part of the
      // signature, so the PUT has to echo what it was given.
      const putRes = await fetch(upload.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": upload.contentType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload fehlgeschlagen (${putRes.status})`);
      }

      await addDocumentVersionAction({
        documentId,
        changeNote,
        storageKey: upload.storageKey,
        fileName: file.name,
        mimeType: upload.contentType,
        fileSizeBytes: file.size,
        checksum,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        onChange={handleChange}
        disabled={busy}
      />
      <Input
        type="text"
        value={changeNote}
        onChange={(event) => setChangeNote(event.target.value)}
        placeholder="Notiz"
        disabled={busy}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Lädt hoch..." : "Datei wählen"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
