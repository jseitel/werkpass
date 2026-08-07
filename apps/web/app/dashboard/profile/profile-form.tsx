"use client";

import { useState } from "react";
import { authClient } from "@werkpass/auth/client";
import { Button, Input, Label } from "@werkpass/ui";
import { avatarPresets, avatarPresetStyle } from "../avatar-presets";
import { Toast } from "../toast";

interface ProfileFormProps {
  initialName: string;
  email: string;
  initialImage?: string | null;
}

export function ProfileForm({ initialName, email, initialImage }: ProfileFormProps) {
  const [name, setName] = useState(initialName);
  const initialPreset = avatarPresets.some((preset) => preset.value === initialImage)
    ? initialImage!
    : avatarPresets[0].value;
  const [image, setImage] = useState(initialPreset);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Name fehlt.");

      if (currentPassword || newPassword) {
        if (!currentPassword || !newPassword) {
          throw new Error("Für die Passwortänderung werden beide Passwortfelder benötigt.");
        }
        if (newPassword.length < 8) {
          throw new Error("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
        }

        const passwordResult = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: true,
        });
        if (passwordResult.error) {
          throw new Error(passwordResult.error.message ?? "Passwort konnte nicht geändert werden.");
        }
        setCurrentPassword("");
        setNewPassword("");
      }

      const profileResult = await authClient.updateUser({
        name: trimmedName,
        image,
      });
      if (profileResult.error) {
        throw new Error(profileResult.error.message ?? "Profil konnte nicht gespeichert werden.");
      }

      setMessage("Account gespeichert.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-3 rounded-md border bg-muted/20 p-4">
          <div
            className="aspect-square w-full max-w-36 rounded-full border bg-muted shadow-sm"
            style={avatarPresetStyle(image) ?? undefined}
            role="img"
            aria-label="Ausgewählter Avatar"
          />
          <div className="text-center">
            <div className="text-sm font-medium">{name || "Account"}</div>
            <div className="max-w-36 truncate text-xs text-muted-foreground">{email}</div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-email">E-Mail</Label>
            <Input id="profile-email" value={email} readOnly disabled />
          </div>
          <div className="grid gap-3">
            <Label>Avatar</Label>
            <div className="flex flex-wrap gap-3">
              {avatarPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  aria-label={preset.label}
                  aria-pressed={image === preset.value}
                  className={`h-12 w-12 rounded-full border-2 bg-muted shadow-sm transition-transform hover:scale-105 ${image === preset.value ? "border-foreground" : "border-transparent"}`}
                  style={avatarPresetStyle(preset.value) ?? undefined}
                  onClick={() => setImage(preset.value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t pt-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="current-password">Aktuelles Passwort</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-password">Neues Passwort</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Wird gespeichert..." : "Speichern"}
        </Button>
      </div>
      {message && (
        <Toast message={message} onClose={() => setMessage(null)} />
      )}
      {error && (
        <Toast
          message={error}
          variant="error"
          onClose={() => setError(null)}
        />
      )}
    </form>
  );
}
