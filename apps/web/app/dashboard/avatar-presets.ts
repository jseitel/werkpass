import type { CSSProperties } from "react";

export const avatarPresets = [
  { value: "avatar:portrait-1", label: "Portrait 1", position: "0% 0%" },
  { value: "avatar:portrait-2", label: "Portrait 2", position: "50% 0%" },
  { value: "avatar:portrait-3", label: "Portrait 3", position: "100% 0%" },
  { value: "avatar:portrait-4", label: "Portrait 4", position: "0% 100%" },
  { value: "avatar:portrait-5", label: "Portrait 5", position: "50% 100%" },
  { value: "avatar:portrait-6", label: "Portrait 6", position: "100% 100%" },
] as const;

export function avatarPresetStyle(value?: string | null): CSSProperties | null {
  const preset = avatarPresets.find((entry) => entry.value === value);
  if (!preset) return null;
  return {
    backgroundImage: "url('/avatars/profile-sprite.webp')",
    backgroundPosition: preset.position,
    backgroundRepeat: "no-repeat",
    backgroundSize: "300% 200%",
  };
}

export function userInitials(name?: string | null): string {
  const parts = (name ?? "Account").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
