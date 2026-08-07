"use client";

import { Input, Label } from "@werkpass/ui";
import type { CreateActionResult } from "../../actions";
import { FormDialog } from "../../form-dialog";

interface CreateMachineDialogProps {
  customerId: string;
  action: (formData: FormData) => Promise<CreateActionResult>;
}

export function CreateMachineDialog({
  customerId,
  action,
}: CreateMachineDialogProps) {
  return (
    <FormDialog
      action={action}
      triggerLabel="Maschine anlegen"
      title="Maschine anlegen"
      description="Erfasse eine Maschine mit ihrer eindeutigen Seriennummer."
      submitLabel="Maschine anlegen"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid gap-2">
        <Label htmlFor="machine-name">Maschinenname</Label>
        <Input
          id="machine-name"
          name="name"
          placeholder="Zum Beispiel Schleifmaschine"
          autoFocus
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="machine-serial-number">Seriennummer</Label>
        <Input
          id="machine-serial-number"
          name="serialNumber"
          placeholder="Seriennummer"
          required
        />
      </div>
    </FormDialog>
  );
}
