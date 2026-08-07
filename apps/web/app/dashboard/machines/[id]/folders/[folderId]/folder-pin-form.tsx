"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, RotateCcw } from "lucide-react";
import { Button, Input, Label } from "@lingl-docs/ui";
import {
  changeMachineFolderPinAction,
  type FolderPinActionState,
} from "../../../../actions";
import { Toast } from "../../../../toast";

const initialState: FolderPinActionState = { status: "idle", message: "" };

interface FolderPinFormProps {
  machineId: string;
  folderId: string;
  hasPin: boolean;
  changedAt: string | null;
  changedByName: string | null;
}

export function FolderPinForm({
  machineId,
  folderId,
  hasPin,
  changedAt,
  changedByName,
}: FolderPinFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(!hasPin);
  const [showPin, setShowPin] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const action = changeMachineFolderPinAction.bind(null, machineId, folderId);
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "idle") return;
    setToast({ message: state.message, error: state.status === "error" });
    if (state.status === "success") {
      formRef.current?.reset();
      setEditing(false);
      setShowPin(false);
    }
  }, [state]);

  const auditText = changedAt
    ? `Geändert am ${new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(changedAt))}${changedByName ? ` durch ${changedByName}` : ""}`
    : "Noch keine PIN gesetzt";

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 gap-3">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <div className="font-medium">{hasPin ? "PIN gesetzt" : "PIN nicht gesetzt"}</div>
            <div className="mt-1 text-sm text-muted-foreground">{auditText}</div>
          </div>
        </div>
        {!editing && (
          <Button type="button" variant="outline" className="gap-2" onClick={() => setEditing(true)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            PIN ändern
          </Button>
        )}
      </div>

      {editing && (
        <form
          ref={formRef}
          action={formAction}
          className="mt-4 grid gap-3 border-t pt-4 lg:grid-cols-[minmax(12rem,20rem)_minmax(12rem,20rem)_auto] lg:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor="folder-pin">Neue PIN</Label>
            <div className="relative">
              <Input
                id="folder-pin"
                name="pin"
                type={showPin ? "text" : "password"}
                minLength={6}
                maxLength={64}
                autoComplete="new-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPin((visible) => !visible)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={showPin ? "PIN ausblenden" : "PIN anzeigen"}
                title={showPin ? "PIN ausblenden" : "PIN anzeigen"}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="folder-pin-confirmation">PIN bestätigen</Label>
            <Input
              id="folder-pin-confirmation"
              name="pinConfirmation"
              type={showPin ? "text" : "password"}
              minLength={6}
              maxLength={64}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Wird gespeichert..." : hasPin ? "PIN ersetzen" : "PIN setzen"}
            </Button>
            {hasPin && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Abbrechen
              </Button>
            )}
          </div>
        </form>
      )}

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.error ? "error" : "success"}
          onClose={() => setToast(null)}
        />
      )}
    </section>
  );
}
