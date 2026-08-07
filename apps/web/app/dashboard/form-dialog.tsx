"use client";

import { type ReactNode, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@werkpass/ui";
import type { CreateActionResult } from "./actions";

interface FormDialogProps {
  action: (formData: FormData) => Promise<CreateActionResult>;
  triggerLabel: string;
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
  onReset?: () => void;
}

export function FormDialog({
  action,
  triggerLabel,
  title,
  description,
  submitLabel,
  children,
  onReset,
}: FormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<CreateActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    formRef.current?.reset();
    setResult(null);
    onReset?.();
  }

  function open() {
    reset();
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
    reset();
  }

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const nextResult = await action(formData);
      if (nextResult.status === "success") {
        close();
        return;
      }
      setResult(nextResult);
    });
  }

  return (
    <>
      <Button type="button" onClick={open}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        {triggerLabel}
      </Button>

      <dialog
        ref={dialogRef}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border bg-card p-0 text-card-foreground shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        aria-labelledby="form-dialog-title"
        aria-describedby="form-dialog-description"
        onClick={(event) => {
          if (event.target === event.currentTarget && !pending) close();
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="form-dialog-title" className="text-xl font-semibold">
                {title}
              </h2>
              <p
                id="form-dialog-description"
                className="mt-1 text-sm text-muted-foreground"
              >
                {description}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              onClick={close}
              disabled={pending}
              aria-label="Dialog schließen"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <form ref={formRef} action={submit} className="mt-6 space-y-5">
            {children}

            {result?.status === "error" && (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {result.message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={pending}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Wird gespeichert..." : submitLabel}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
