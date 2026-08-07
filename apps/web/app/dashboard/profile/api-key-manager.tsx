"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  buttonVariants,
  cn,
} from "@lingl-docs/ui";
import { createApiKeyAction, revokeApiKeyAction } from "../actions";
import { Toast } from "../toast";

interface ApiKeySummary {
  id: string;
  name: string;
  tokenPrefix: string;
  tokenLastFour: string;
  scopes: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: { name: string } | null;
}

interface ApiKeyManagerProps {
  hasOrganization: boolean;
  canManage: boolean;
  apiKeys: ApiKeySummary[];
}

function formatDate(value: string | null) {
  if (!value) return "Noch nie";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ApiKeyManager({ hasOrganization, canManage, apiKeys }: ApiKeyManagerProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createApiKeyAction(name);
    setBusy(false);
    if (result.status === "error") {
      setError(result.message);
      return;
    }
    setSecret(result.token ?? null);
    setName("");
    setShowCreate(false);
    setMessage(result.message);
    router.refresh();
  }

  async function revokeKey(apiKeyId: string) {
    if (!window.confirm("Diesen API-Schlüssel unwiderruflich sperren?")) return;
    setBusy(true);
    setError(null);
    const result = await revokeApiKeyAction(apiKeyId);
    setBusy(false);
    if (result.status === "error") setError(result.message);
    else {
      setMessage(result.message);
      router.refresh();
    }
  }

  const activeKeys = apiKeys.filter((apiKey) => !apiKey.revokedAt);

  return (
    <Card className="w-full max-w-6xl">
      <CardHeader className="border-b">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex gap-3">
            <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <CardTitle>API/CLI Keys</CardTitle>
              <CardDescription>
                Read-only-Zugriff auf Daten der aktiven Organisation
              </CardDescription>
            </div>
          </div>
          <Link
            href="/swagger"
            target="_blank"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}
          >
            Swagger API <span className="font-medium">Ansehen</span>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!hasOrganization ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Für API-Schlüssel muss zuerst eine Organisation aktiv sein.
          </div>
        ) : activeKeys.length === 0 && !showCreate && !secret ? (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center">
            <KeyRound className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <div>
              <div className="font-medium">Keine API-Schlüssel vorhanden</div>
              <div className="text-sm text-muted-foreground">
                Schlüssel gelten für die gesamte aktive Organisation.
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {activeKeys.map((apiKey) => (
              <div key={apiKey.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{apiKey.name}</span>
                    <Badge variant="secondary">Lesen</Badge>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {apiKey.tokenPrefix}...{apiKey.tokenLastFour}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground md:text-right">
                  <div>Zuletzt genutzt: {formatDate(apiKey.lastUsedAt)}</div>
                  <div>Erstellt: {formatDate(apiKey.createdAt)}</div>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title="API-Schlüssel widerrufen"
                    aria-label={`${apiKey.name} widerrufen`}
                    disabled={busy}
                    onClick={() => revokeKey(apiKey.id)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {secret && (
          <div className="mt-5 border-l-2 border-amber-500 bg-amber-500/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Schlüssel jetzt sichern</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Dieser Wert wird nur einmal angezeigt und kann später nicht wiederhergestellt werden.
                </p>
                <div className="mt-3 flex gap-2">
                  <Input value={secret} readOnly className="font-mono text-xs" aria-label="Neuer API-Schlüssel" />
                  <Button type="button" variant="outline" onClick={copySecret} title="Kopieren">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showCreate && (
          <form className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-end" onSubmit={createKey}>
            <div className="grid gap-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="z. B. ERP Produktion"
                minLength={2}
                maxLength={80}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>{busy ? "Wird erstellt..." : "Erstellen"}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
            </div>
          </form>
        )}

        {hasOrganization && canManage && !showCreate && (
          <div className="mt-5 flex justify-end border-t pt-5">
            <Button type="button" onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Neuen Schlüssel erstellen
            </Button>
          </div>
        )}
        {hasOrganization && !canManage && (
          <p className="mt-5 border-t pt-5 text-sm text-muted-foreground">
            Nur Owner und Admins können API-Schlüssel verwalten.
          </p>
        )}
      </CardContent>
      {message && <Toast message={message} onClose={() => setMessage(null)} />}
      {error && <Toast message={error} variant="error" onClose={() => setError(null)} />}
    </Card>
  );
}
