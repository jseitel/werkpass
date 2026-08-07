"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Label } from "@werkpass/ui";
import {
  deleteEntraSsoAction,
  requestSsoVerificationTokenAction,
  saveEntraSsoAction,
  saveSsoPolicyAction,
  testEntraConnectionAction,
  verifySsoDomainAction,
  type SsoActionResult,
} from "./actions";

export type EntraProviderView = {
  providerId: string;
  issuer: string;
  domain: string;
  domainVerified: boolean;
  clientIdLastFour?: string;
};

function tenantIdFromIssuer(issuer?: string): string {
  return issuer?.match(/login\.microsoftonline\.com\/([^/]+)\/v2\.0/i)?.[1] ?? "";
}

function MicrosoftLogo() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
      <path fill="#f25022" d="M0 0h7.5v7.5H0z" />
      <path fill="#7fba00" d="M8.5 0H16v7.5H8.5z" />
      <path fill="#00a4ef" d="M0 8.5h7.5V16H0z" />
      <path fill="#ffb900" d="M8.5 8.5H16V16H8.5z" />
    </svg>
  );
}

export function EntraSsoForm({
  initialProvider,
  callbackUrl,
  initialSsoMode,
  isBreakGlassUser,
}: {
  initialProvider: EntraProviderView | null;
  callbackUrl: string;
  initialSsoMode: "optional" | "required";
  isBreakGlassUser: boolean;
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [result, setResult] = useState<SsoActionResult | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ssoMode, setSsoMode] = useState(initialSsoMode);

  function run(
    action: () => Promise<SsoActionResult>,
    onSuccess?: (next: SsoActionResult) => void,
    options: { reloadOnSuccess?: boolean } = {},
  ) {
    setResult(null);
    startTransition(async () => {
      const next = await action();
      setResult(next);
      if (next.verificationToken) setVerificationToken(next.verificationToken);
      if (next.status === "success") {
        onSuccess?.(next);
        if (next.message.includes("getrennt")) setProvider(null);
        else if (!next.verificationToken && options.reloadOnSuccess !== false) {
          window.location.reload();
        }
      }
    });
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => saveEntraSsoAction(formData), (next) => {
      if (!next.verificationToken || provider) return;
      const tenantId = String(formData.get("tenantId") ?? "");
      const domain = String(formData.get("domain") ?? "");
      setProvider({
        providerId: callbackUrl.split("/").at(-1) ?? "",
        issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
        domain,
        domainVerified: false,
      });
    });
  }

  function handleTest() {
    if (!provider) return;
    run(testEntraConnectionAction, undefined, { reloadOnSuccess: false });
  }

  const dnsHost = provider ? `_better-auth-token-${provider.providerId}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-background">
            <MicrosoftLogo />
          </div>
          <div>
            <div className="font-medium">Microsoft Entra ID</div>
            <p className="text-sm text-muted-foreground">OpenID Connect pro Organisation</p>
          </div>
        </div>
        <Badge variant={provider?.domainVerified ? "default" : "secondary"}>
          {provider?.domainVerified
            ? "Aktiv"
            : provider
              ? "Domain nicht bestätigt"
              : "Nicht eingerichtet"}
        </Badge>
      </div>

      <form className="grid gap-5" onSubmit={handleSave}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="tenantId">Microsoft-Tenant-ID</Label>
            <Input
              id="tenantId"
              name="tenantId"
              defaultValue={tenantIdFromIssuer(provider?.issuer)}
              placeholder="00000000-0000-0000-0000-000000000000"
              autoComplete="off"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="domain">Unternehmensdomain</Label>
            <Input
              id="domain"
              name="domain"
              defaultValue={provider?.domain ?? ""}
              placeholder="firma.de"
              autoCapitalize="none"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clientId">
              {provider ? "Neue Client-ID (optional)" : "Client-ID"}
            </Label>
            <Input
              id="clientId"
              name="clientId"
              placeholder={
                provider?.clientIdLastFour
                  ? `Aktuell endet sie auf ${provider.clientIdLastFour}`
                  : "Anwendungs-ID aus Entra"
              }
              autoComplete="off"
              required={!provider}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clientSecret">
              {provider ? "Neues Client-Secret (optional)" : "Client-Secret"}
            </Label>
            <Input
              id="clientSecret"
              name="clientSecret"
              type="password"
              placeholder={provider ? "Unverändert lassen" : "Secret-Wert aus Entra"}
              autoComplete="new-password"
              required={!provider}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="callbackUrl">Redirect-URI für Microsoft Entra</Label>
          <div className="flex gap-2">
            <Input id="callbackUrl" value={callbackUrl} readOnly />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(callbackUrl)}
            >
              Kopieren
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Diese URI in der Entra-App als Web-Redirect-URI eintragen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Wird gespeichert..." : provider ? "Änderungen speichern" : "Verbindung anlegen"}
          </Button>
          {provider?.domainVerified && (
            <Button type="button" variant="outline" disabled={pending} onClick={handleTest}>
              {pending ? "Test wird gestartet …" : "Verbindung testen"}
            </Button>
          )}
        </div>
      </form>

      {provider && !provider.domainVerified && (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <h3 className="font-medium">Domain bestätigen</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege bei deinem DNS-Anbieter einen TXT-Eintrag an. Erst danach können sich
              Mitarbeiter über diese Domain anmelden.
            </p>
          </div>
          {!verificationToken ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(requestSsoVerificationTokenAction)}
            >
              DNS-Prüfeintrag anzeigen
            </Button>
          ) : (
            <div className="grid gap-3 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Host</div>
                <code className="break-all">{dnsHost}</code>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">TXT-Wert</div>
                <code className="break-all">{verificationToken}</code>
              </div>
            </div>
          )}
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(verifySsoDomainAction)}
          >
            DNS-Eintrag prüfen
          </Button>
        </div>
      )}

      {result && (
        <p
          className={result.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600"}
          role="status"
        >
          {result.message}
        </p>
      )}

      {provider && (
        <div className="space-y-4 border-t pt-5">
          <div>
            <h3 className="font-medium">Anmelderichtlinie</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bei „Verpflichtend“ werden Passwort-Anmeldungen für Mitglieder dieser
              Organisation blockiert. Der Admin, der den Modus aktiviert, bleibt als
              protokollierter Notfallzugang erhalten.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-64 gap-2">
              <Label htmlFor="ssoMode">Anmeldung</Label>
              <select
                id="ssoMode"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={ssoMode}
                onChange={(event) => setSsoMode(event.target.value as "optional" | "required")}
              >
                <option value="optional">Microsoft oder Passwort</option>
                <option value="required" disabled={!provider.domainVerified}>
                  Microsoft verpflichtend
                </option>
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || ssoMode === initialSsoMode}
              onClick={() => run(() => saveSsoPolicyAction(ssoMode))}
            >
              Richtlinie speichern
            </Button>
          </div>
          {initialSsoMode === "required" && isBreakGlassUser && (
            <p className="text-xs text-amber-600">
              Dein Konto ist der aktuelle Notfallzugang und darf sich weiterhin mit Passwort anmelden.
            </p>
          )}
        </div>
      )}

      {provider && (
        <div className="border-t pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (window.confirm("SSO wirklich trennen? Zugehörige SSO-Anmeldekonten werden entfernt.")) {
                run(deleteEntraSsoAction);
              }
            }}
          >
            Microsoft Entra ID trennen
          </Button>
        </div>
      )}
    </div>
  );
}
