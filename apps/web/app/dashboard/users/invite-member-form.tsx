"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@lingl-docs/ui";
import {
  inviteMemberAction,
  type InviteMemberActionState,
} from "../actions";
import { InviteLink } from "./invite-link";

const initialState: InviteMemberActionState = {
  status: "idle",
  message: "",
};

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(
    inviteMemberAction,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role">Rolle</Label>
        <select
          id="role"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          name="role"
          defaultValue="editor"
        >
          <option value="admin">Admin</option>
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird verarbeitet..." : "Einladung erstellen"}
      </Button>
      {state.message && (
        <p
          className={
            state.status === "error"
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}
      {state.invitePath && <InviteLink path={state.invitePath} />}
    </form>
  );
}
