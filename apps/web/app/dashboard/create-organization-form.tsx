"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@werkpass/auth/client";
import { Button, Input, Label } from "@werkpass/ui";
import { setDefaultOrganizationAction } from "./organization-actions";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const { data, error: createError } = await authClient.organization.create({
      name,
      slug: slugify(name),
    });
    if (createError || !data) {
      setError(createError?.message ?? "Anlegen fehlgeschlagen");
      return;
    }

    const { error: activateError } = await authClient.organization.setActive({
      organizationId: data.id,
    });
    if (activateError) {
      setError(activateError.message ?? "Aktivieren fehlgeschlagen");
      return;
    }

    const defaultResult = await setDefaultOrganizationAction(data.id);
    if (defaultResult.status === "error") {
      setError(defaultResult.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="organization-name">Organisationsname</Label>
        <Input
          id="organization-name"
          type="text"
          placeholder="Muster Maschinenbau"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit">Organisation anlegen</Button>
    </form>
  );
}
