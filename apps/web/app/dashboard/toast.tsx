"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, variant = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, onClose]);

  const success = variant === "success";

  return (
    <div
      className={`fixed right-4 top-20 z-50 flex min-h-14 w-[min(24rem,calc(100vw-2rem))] items-center gap-3 rounded-md border px-4 py-3 shadow-lg ${
        success
          ? "border-emerald-800 bg-emerald-950 text-emerald-300"
          : "border-red-800 bg-red-950 text-red-300"
      }`}
      role={success ? "status" : "alert"}
      aria-live={success ? "polite" : "assertive"}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          success ? "border-emerald-400" : "border-red-400"
        }`}
        aria-hidden="true"
      >
        {success ? "✓" : "!"}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{message}</span>
      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center rounded-md text-current opacity-70 hover:bg-white/10 hover:opacity-100"
        onClick={onClose}
        aria-label="Meldung schließen"
      >
        ×
      </button>
    </div>
  );
}
