"use client";

import { Input, Label } from "@werkpass/ui";
import type { CreateActionResult } from "../actions";
import { FormDialog } from "../form-dialog";

interface CreateCustomerDialogProps {
  action: (formData: FormData) => Promise<CreateActionResult>;
}

export function CreateCustomerDialog({ action }: CreateCustomerDialogProps) {
  return (
    <FormDialog
      action={action}
      triggerLabel="Kunde anlegen"
      title="Kunde anlegen"
      description="Lege einen neuen Kunden für Maschinen und Dokumentationen an."
      submitLabel="Kunde anlegen"
    >
      <div className="grid gap-2">
        <Label htmlFor="customer-name">Kundenname</Label>
        <Input
          id="customer-name"
          name="name"
          placeholder="Zum Beispiel Muster GmbH"
          autoFocus
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="customer-number">Kundennummer</Label>
        <Input
          id="customer-number"
          name="customerNumber"
          placeholder="Optional"
        />
      </div>
    </FormDialog>
  );
}
