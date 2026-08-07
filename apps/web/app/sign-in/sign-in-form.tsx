"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@werkpass/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@werkpass/ui";
import { ThemeToggle } from "../theme-toggle";

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

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const [ssoPending, setSsoPending] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const redirect = search.get("redirect");
    const invitedEmail = search.get("email");
    const oauthError = search.get("error");
    if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
      const target = new URL(redirect, window.location.origin);
      target.searchParams.delete("error");
      target.searchParams.delete("error_description");
      setRedirectPath(`${target.pathname}${target.search}${target.hash}`);
    }
    if (invitedEmail) setEmail(invitedEmail);
    if (oauthError) {
      setError("Firmenanmeldung fehlgeschlagen. Bitte versuche es erneut.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message ?? "Anmeldung fehlgeschlagen");
      return;
    }
    router.push(redirectPath);
  }

  async function handleSsoSignIn() {
    setError(null);
    if (!email.trim()) {
      setError("Gib zuerst deine Firmen-E-Mail-Adresse ein.");
      return;
    }
    setSsoPending(true);

    const { error: signInError } = await signIn.sso({
      email: email.trim().toLowerCase(),
      callbackURL: redirectPath,
      // Better Auth appends its own query string. Keeping this URL query-free
      // prevents repeated failures from nesting ?error inside the redirect.
      errorCallbackURL: "/sign-in",
    });

    if (signInError) {
      setError(signInError.message ?? "Für diese E-Mail ist keine Firmenanmeldung eingerichtet.");
      setSsoPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-muted/30 lg:grid-cols-[1fr_28rem]">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link href="/" className="text-sm font-semibold">
          werkpass
        </Link>
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-normal">
            Maschinenakten, Revisionen und QR-Zugriff in einem System.
          </h1>
          <p className="mt-4 text-sm text-primary-foreground/75">
            Verwaltung für Hersteller, Kunden und geschützte technische
            Unterlagen.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Zugriff auf Dashboard und Doku-Ersteller Board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={ssoPending}
                onClick={handleSsoSignIn}
              >
                <MicrosoftLogo />
                {ssoPending ? "Weiterleitung..." : "Mit Firmenkonto anmelden"}
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase text-muted-foreground">oder mit Passwort</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={ssoPending}>
                Anmelden
              </Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Noch kein Konto?{" "}
              <Link
                className="underline"
                href={`/sign-up?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(email)}`}
              >
                Registrieren
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
