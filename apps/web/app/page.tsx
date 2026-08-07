import Link from "next/link";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lingl-docs/ui";
import { ThemeToggle } from "./theme-toggle";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-muted/30">
      <section className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_30rem] lg:items-center">
        <div className="flex flex-col gap-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                LD
              </div>
              <span className="font-semibold">lingl-docs</span>
            </div>
            <ThemeToggle />
          </nav>
          <div className="max-w-3xl">
            <Badge variant="secondary">Maschinenverordnung-ready</Badge>
            <h1 className="mt-6 text-4xl font-semibold tracking-normal lg:text-6xl">
              Digitale Maschinenakte per QR-Code.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-muted-foreground">
              Kunden, Maschinen, Betriebsanleitungen, Revisionen und
              PIN-geschützte Pläne in einer strukturierten Herstelleransicht.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className={buttonVariants({ size: "lg" })} href="/dashboard">
                Loslegen
              </Link>
              <Link
                className={buttonVariants({ variant: "outline", size: "lg" })}
                href="/sign-up"
              >
                Konto erstellen
              </Link>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Doku-Ersteller Board</CardTitle>
            <CardDescription>
              Vom Kunden zur Maschine bis zur aktuellen Revision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Kunde", "Betreiber oder Abnehmer anlegen"],
              ["Maschine", "Seriennummer und QR-Slug erzeugen"],
              ["Dokument", "Kategorie und Zugriffsebene definieren"],
              ["Revision", "Aktuelle und alte Versionen bereitstellen"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-md border p-4">
                <div className="font-medium">{title}</div>
                <div className="text-sm text-muted-foreground">{text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
