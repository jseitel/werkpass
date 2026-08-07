"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@lingl-docs/auth/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@lingl-docs/ui";
import { ThemeToggle } from "../theme-toggle";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redirectPath, setRedirectPath] = useState("/dashboard");

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const redirect = search.get("redirect");
    const invitedEmail = search.get("email");
    if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
      setRedirectPath(redirect);
    }
    if (invitedEmail) setEmail(invitedEmail);
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

  return (
    <main className="grid min-h-screen bg-muted/30 lg:grid-cols-[1fr_28rem]">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link href="/" className="text-sm font-semibold">
          lingl-docs
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
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit">Anmelden</Button>
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
