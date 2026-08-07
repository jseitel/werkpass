"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@lingl-docs/auth/client";
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

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
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
    const { error: signUpError } = await signUp.email({ name, email, password });
    if (signUpError) {
      setError(signUpError.message ?? "Registrierung fehlgeschlagen");
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
            Starte mit Kunden, Maschinen und revisionssicherer Dokumentation.
          </h1>
          <p className="mt-4 text-sm text-primary-foreground/75">
            Öffentliche Betriebsanleitungen und PIN-geschützte Pläne sauber
            trennen.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Konto erstellen</CardTitle>
            <CardDescription>
              Danach legst du Organisation, Kunden und Maschinen an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
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
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit">Registrieren</Button>
            </form>
            <p className="mt-4 text-sm text-muted-foreground">
              Schon ein Konto?{" "}
              <Link
                className="underline"
                href={`/sign-in?redirect=${encodeURIComponent(redirectPath)}&email=${encodeURIComponent(email)}`}
              >
                Anmelden
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
