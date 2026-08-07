"use client";

import { useState } from "react";
import { Input, Label } from "@lingl-docs/ui";
import type { CreateActionResult } from "../../actions";
import { FormDialog } from "../../form-dialog";

interface CreateFolderDialogProps {
  action: (formData: FormData) => Promise<CreateActionResult>;
}

export function CreateFolderDialog({ action }: CreateFolderDialogProps) {
  const [accessLevel, setAccessLevel] = useState("public");

  return (
    <FormDialog
      action={action}
      triggerLabel="Ordner anlegen"
      title="Ordner anlegen"
      description="Erstelle einen Ordner für Dokumente und Revisionen."
      submitLabel="Ordner anlegen"
      onReset={() => setAccessLevel("public")}
    >
      <div className="grid gap-2">
        <Label htmlFor="folder-name">Ordnername</Label>
        <Input
          id="folder-name"
          name="name"
          placeholder="Zum Beispiel Betriebsanleitungen"
          autoFocus
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="folder-access">Zugriff</Label>
        <select
          id="folder-access"
          name="accessLevel"
          value={accessLevel}
          onChange={(event) => setAccessLevel(event.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        >
          <option value="public">Öffentlich</option>
          <option value="pin">PIN-geschützt</option>
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="folder-pin">PIN</Label>
        <Input
          id="folder-pin"
          name="pin"
          type="password"
          minLength={6}
          maxLength={64}
          autoComplete="new-password"
          placeholder={
            accessLevel === "pin"
              ? "Mindestens 6 Zeichen"
              : "Nur bei PIN-Schutz erforderlich"
          }
          disabled={accessLevel !== "pin"}
          required={accessLevel === "pin"}
        />
      </div>
    </FormDialog>
  );
}
