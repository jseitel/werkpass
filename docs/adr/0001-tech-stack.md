# ADR 0001: Tech-Stack für digitale Maschinendokumentation (docks.io-artiges Produkt)

Status: Angenommen
Datum: 2026-08-07

## Kontext

docks.io liefert Maschinendokumentation per QR-Code aus (EU-Verordnung 2023/1230, Deadline 20.01.2027), gehostet in Deutschland, DSGVO-konform, ohne App/Login für Endnutzer, mit 10 Jahre garantierter URL-Stabilität und Preisstufen Starter/Professional/Enterprise (SSO, API).

Wir starten **intern** (nur eigene Maschinen, ein Mandant), bauen die Architektur aber von Anfang an **mandantenfähig**, damit ein späterer Ausbau zu einem verkaufbaren SaaS-Produkt keinen Rewrite erfordert. Zentrale Anforderung: **Migrationsfähigkeit** – kein Layer darf so gewählt werden, dass ein Anbieterwechsel (Hosting, Auth, Storage, Datenbank) einen Rewrite statt einer Config-Änderung bedeutet.

Gewählter Hosting-Standort: **Hetzner Cloud** (Deutschland) – passt zur "hosted in Germany"-Erzählung von docks.io und ist günstig sowie frei von proprietären Cloud-Diensten.

## Produktkern (aus docks.io abgeleitet)

- QR-Code pro Maschine → permanente, stabile URL (10-Jahres-Garantie)
- Öffentlicher Dokumenten-Viewer ohne Login/Cookies/Tracking (DSGVO)
- Admin-Bereich: Maschinen anlegen, Dokumente hochladen/versionieren, mehrsprachig (PDF/CAD/Bilder bis 50 MB)
- Zugriff über zeitlich begrenzte, signierte URLs statt direkter Dateilinks
- Versionierung/Archivierung als Compliance-Nachweis
- Enterprise-Stufe (später): SSO (OAuth/SAML), API-Zugriff
- Datenhaltung exklusiv in Deutschland

## Architekturprinzip: Modularer Monolith mit sauberen Grenzen

Für die interne Phase eine einzige deploybare App (geringer Betriebsaufwand), aber von Anfang an in Packages mit klaren Grenzen strukturiert, damit einzelne Teile (z. B. eine öffentliche API für Enterprise-Kunden) später herausgelöst werden können, ohne Domänenlogik neu zu schreiben.

## Entscheidung: Tech-Stack

| Layer | Wahl | Migrationsfähigkeit |
|---|---|---|
| Sprache/Runtime | TypeScript + Node.js | Ein Ökosystem für Frontend+Backend, läuft in jedem Docker-Host |
| Framework | Next.js (App Router), Deployment als eigenständiger Node-Server (`output: 'standalone'`) in Docker | Bewusst **keine** Vercel-exklusiven Features (Edge-only Functions, Vercel-KV) – Container läuft unverändert auf jedem Host |
| Datenbank | PostgreSQL + Prisma ORM | Reines Postgres ohne proprietäre Extensions, `pg_dump`-portabel; Prisma-Schema ist Provider-agnostisch, Wechsel des DB-Hosters = Connection-String-Änderung |
| Auth | Better Auth | Nutzer/Sessions liegen in eigener Postgres-DB (kein Auth0/Clerk-Lock-in); Plugins für OAuth und SAML/OIDC decken die spätere Enterprise-SSO-Anforderung ab |
| Dateispeicher | S3-kompatible Object Storage – konkret Hetzner Object Storage (Falkenstein, DE) über Standard-`@aws-sdk/client-s3` | S3-API ist offener Standard; Wechsel zu MinIO (self-hosted) oder anderem S3-Anbieter ist Config-Änderung, kein Rewrite. Serverseitig signierte, zeitlich begrenzte URLs analog docks.io |
| QR-Codes | Serverseitig generiert (`qrcode`, Open Source), stabile kurze Slugs (`/m/{machine-id}`) | Dünne, austauschbare Routing-Schicht sichert Langzeit-URL-Stabilität unabhängig vom restlichen Backend |
| Mehrsprachigkeit | next-intl/i18next, Übersetzungen in Postgres | Inhalte exportierbar, nicht hartcodiert |
| Hintergrundjobs | Postgres-basierte Queue (`graphile-worker` oder `pg-boss`) | Keine zusätzliche Redis/Kafka-Abhängigkeit, die separat migriert werden müsste |
| E-Mail | SMTP-Standard via Nodemailer, EU-Versanddienst | SMTP ist Standard, Anbieterwechsel trivial |
| Billing (spätere SaaS-Phase) | Stripe oder Mollie hinter eigener `BillingProvider`-Abstraktion im Code | Anbieterwechsel betrifft nur ein Modul |
| Hosting/Infra | Hetzner Cloud, alles containerisiert via Docker Compose; optional Coolify (Open Source Self-hosted PaaS) für Deploy-Komfort | Standard-Docker-Images laufen unverändert auf AWS/GCP/eigener Hardware |
| CDN | BunnyCDN (EU) oder Cloudflare vor Object Storage/Viewer | Origin bleibt Quelle der Wahrheit, CDN jederzeit austauschbar |
| Monorepo | pnpm Workspaces + Turborepo | Reines Build-Tool, kein Laufzeit-Lock-in |

### Vorgeschlagene Package-Struktur (für spätere Umsetzung)

- `apps/web` – Next.js App (Public Viewer + Admin Dashboard; Trennung in zwei Apps erst bei Bedarf für Multi-Tenant-SaaS)
- `packages/db` – Prisma Schema + Client (Tenant-Root-Entity `Organization` von Anfang an im Schema, auch mit nur einer Organisation)
- `packages/auth` – Better-Auth-Konfiguration inkl. Rollenmodell (Admin/Editor/Viewer)
- `packages/core` – Domänenlogik (Machines, Documents, Versioning), entkoppelt von Next.js Request/Response – konkreter Hebel, um später eine separate API (NestJS/Fastify) herauszulösen
- `packages/ui` – gemeinsame UI-Komponenten (shadcn/ui + Tailwind)

## Multi-Tenancy-Vorbereitung (jetzt anlegen, nicht aktivieren)

- `Organization` als Tenant-Root-Entity im Datenmodell, Row-Level-Trennung statt separater DB pro Kunde (einfacher zu migrieren/skalieren)
- Rollen/Permissions-Modell in Better Auth von Anfang an vorsehen

## Bewusst vermieden (Begründung: Migrationsfähigkeit)

- Vercel-exklusives Hosting oder Vendor-spezifische Edge-Funktionen
- Auth0/Clerk/Firebase Auth (Nutzerdaten läge bei Drittanbieter)
- Proprietäre BaaS als Kernabhängigkeit (z. B. Supabase-spezifische Realtime-Features, Firebase)
- Separate Datenbank pro Mandant

## Offene Punkte (nicht blockierend)

- Konkreter E-Mail-Anbieter
- Billing-Anbieter (erst bei SaaS-Öffnung relevant)
- Finaler CDN-Anbieter

## Nächste Schritte

1. Monorepo-Grundgerüst aufsetzen (pnpm + Turborepo, App-/Package-Struktur)
2. Prisma-Schema für Organization/Machine/Document/DocumentVersion entwerfen
3. Better-Auth-Setup mit Rollenmodell
4. Hetzner-Infrastruktur (Server, Object Storage, Postgres) provisionieren
