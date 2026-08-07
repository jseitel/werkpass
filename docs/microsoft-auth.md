# Organisationsbezogenes Microsoft-SSO

werkpass verwendet Microsoft Entra ID als organisationsbezogenen OIDC-Provider. Die Verbindung wird nicht global über Umgebungsvariablen konfiguriert. Stattdessen richtet ein Owner oder Admin sie unter **Organisation → Einstellungen → Single Sign-on** für die aktive Organisation ein.

## Zielbild

- Jede werkpass-Organisation kann einen eigenen Microsoft-Entra-Tenant anbinden.
- Owner und Admins dürfen die Verbindung anlegen, ändern, prüfen und entfernen.
- Die Unternehmensdomain muss per DNS-TXT-Eintrag bestätigt werden.
- Benutzer melden sich mit ihrer Firmen-E-Mail an. Better Auth ermittelt darüber den Provider.
- Beim ersten erfolgreichen Login wird der Benutzer automatisch als `member` der zugehörigen Organisation angelegt. Diese Rolle besitzt keine Bearbeitungsrechte; ein Admin kann anschließend gezielt `viewer`, `editor` oder `admin` vergeben.
- Pro Organisation kann zwischen optionalem und verpflichtendem SSO gewählt
  werden. Bei verpflichtendem SSO bleibt genau der aktivierende Admin als
  protokollierter Notfallzugang erhalten.

## Einrichtung in Microsoft Entra

1. Im Microsoft Entra Admin Center eine neue App-Registrierung anlegen.
2. Als Kontotyp **nur Konten in diesem Organisationsverzeichnis** wählen.
3. Unter **Authentifizierung → Plattform hinzufügen → Web** die in werkpass angezeigte Redirect-URI eintragen:

   ```text
   https://ihre-werkpass-domain.example/api/auth/sso/callback/entra-ORGANISATIONS-ID
   ```

4. Unter **Zertifikate & Geheimnisse** ein Client-Secret erstellen und den Secret-Wert sofort kopieren.
5. In werkpass Tenant-ID, Unternehmensdomain, Client-ID und Client-Secret eintragen.
6. Den angezeigten DNS-TXT-Eintrag erstellen und anschließend **DNS-Eintrag prüfen** auswählen.
7. Nach erfolgreicher Domainprüfung die Verbindung testen.

Microsoft verwendet für die OIDC-Erkennung den organisationsspezifischen Issuer:

```text
https://login.microsoftonline.com/{tenantId}/v2.0
```

Das Microsoft-Discovery-Dokument verweist für UserInfo zusätzlich auf
`https://graph.microsoft.com/oidc/userinfo`. Deshalb stehen ausschließlich die
beiden offiziellen Origins `login.microsoftonline.com` und
`graph.microsoft.com` in der serverseitigen OIDC-Allowlist.
Da Microsoft Graph bei verwalteten Entra-Benutzern den optionalen `email`-Claim
weglassen kann, verwendet werkpass den signierten und über Microsofts JWKS
geprüften ID-Token. Das Mapping liest daraus `sub`, `preferred_username` und
`name`. Der bei der Discovery gelieferte optionale Graph-UserInfo-Endpunkt wird
für Microsoft-Provider deshalb nicht beim Login aufgerufen.

Die allgemeinen Tenant-Werte `common`, `organizations` und `consumers` werden absichtlich nicht akzeptiert. Dadurch bleibt jede Verbindung eindeutig einem Entra-Tenant zugeordnet.

## Anmeldeablauf

1. Der Benutzer gibt auf der Login-Seite seine Firmen-E-Mail ein.
2. Er wählt **Mit Firmenkonto anmelden**.
3. Better Auth sucht einen bestätigten SSO-Provider für die E-Mail-Domain.
4. Der Browser wird zum Entra-Tenant der Organisation weitergeleitet.
5. Nach erfolgreicher Anmeldung legt Better Auth bei Bedarf Benutzer und Organisationsmitgliedschaft an.
6. Der Benutzer landet wieder im Dashboard.

## Datenmodell und Sicherheit

Das Better-Auth-SSO-Plugin speichert je Provider:

- Provider-ID
- Organisation-ID
- Issuer und Unternehmensdomain
- OIDC-Konfiguration einschließlich Client-ID und Client-Secret
- Status der Domainbestätigung

Die werkpass-Verwaltungsoberfläche liefert gespeicherte Client-Secrets nicht wieder an den Browser aus. OIDC- und SAML-Konfigurationen werden vor dem Speichern mit AES-256-GCM verschlüsselt; Datenbank und Backups sollten trotzdem zusätzlich verschlüsselt betrieben werden. Zugriffe auf die Provider-Verwaltung werden serverseitig auf die Rollen `owner` und `admin` sowie auf eine frische Sitzung begrenzt.

Die Domainbestätigung verhindert, dass ein Organisationsadmin eine fremde Domain als Login-Domain beansprucht. Eine bestätigte Domain kann nur einer Organisation gehören und muss nach 90 Tagen erneut bestätigt werden. Änderungen an Tenant, Client-ID oder Domain setzen die Bestätigung sofort zurück. Neue SSO-Benutzer erhalten niemals automatisch Adminrechte.

## Betrieb

Vor dem Deployment muss die Prisma-Migration `20260807170000_organization_sso` ausgeführt werden. Außerdem müssen gesetzt sein:

```dotenv
BETTER_AUTH_URL="https://ihre-werkpass-domain.example"
BETTER_AUTH_SECRET="mindestens-32-zeichen"
BETTER_AUTH_TRUSTED_ORIGINS="https://ihre-werkpass-domain.example"
SSO_CONFIG_ENCRYPTION_KEY="32-byte-base64-key"
TRUST_PROXY_HEADERS="true"
```

`SSO_CONFIG_ENCRYPTION_KEY` ist unabhängig vom Better-Auth-Session-Secret und
muss als Deployment-Secret gespeichert werden. Ein Verlust macht die
gespeicherten Microsoft-Client-Secrets unlesbar. Nach der Einführung der
Verschlüsselung werden vorhandene Provider einmalig migriert:

```bash
pnpm --filter @werkpass/db sso:encrypt-existing
```

Der Befehl ist wiederholbar. Neue und gelesene Alt-Konfigurationen werden
zusätzlich automatisch mit AES-256-GCM verschlüsselt. In Produktion startet
die Authentifizierung ohne HTTPS-Basis-URL oder ohne diesen Schlüssel nicht.

Die Microsoft-Zugangsdaten stehen ausdrücklich nicht in `.env`; sie unterscheiden sich pro Organisation.

## Warum Better Auth statt Auth.js/NextAuth

Das Projekt nutzt bereits Better Auth für Sessions, Organisationen, Rollen und Einladungen. Das SSO-Plugin kann Provider direkt mit `organizationId` verknüpfen, prüft Owner/Admin-Berechtigungen und übernimmt das Organisations-Provisioning. Ein Wechsel zu Auth.js würde diese Funktionen neu implementieren müssen und bietet für organisationsbezogenes SAML/OIDC keinen entsprechenden Vorteil.

## Quellen

- [Better Auth: Single Sign-on](https://better-auth.com/docs/plugins/sso)
- [Better Auth: Organization](https://better-auth.com/docs/plugins/organization)
- [Microsoft: App in Entra registrieren](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
