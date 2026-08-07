# Microsoft-Entra-App-Rollen

Werkpass kann die anwendungsspezifische Entra-Rolle `Werkpass.Admin`
beim ersten SSO-Beitritt einer Organisation automatisch auf die
Werkpass-Rolle `admin` abbilden. Ohne diesen exakten Rollenwert wird
`member` vergeben. Die Rolle `owner` wird nie aus Microsoft übernommen.

## App-Rolle anlegen

Im Microsoft Entra Admin Center:

1. **Identität > Anwendungen > App-Registrierungen > Werkpass** öffnen.
2. **App-Rollen > App-Rolle erstellen** auswählen.
3. Folgende Werte eintragen:

   - Anzeigename: `Werkpass Administrator`
   - Zulässige Mitgliedstypen: `Benutzer/Gruppen`
   - Wert: `Werkpass.Admin`
   - Beschreibung: `Administriert Benutzer, SSO und Einstellungen in Werkpass.`
   - Aktiviert: `Ja`

Alternativ kann der folgende Eintrag im App-Manifest unter `appRoles`
verwendet werden:

```json
{
  "allowedMemberTypes": ["User"],
  "description": "Administriert Benutzer, SSO und Einstellungen in Werkpass.",
  "displayName": "Werkpass Administrator",
  "id": "537cfd84-0fb5-4d1e-8e19-567748ed6520",
  "isEnabled": true,
  "value": "Werkpass.Admin"
}
```

Bestehende Einträge im Array `appRoles` dürfen dabei nicht gelöscht werden.

## Benutzer zuweisen

Unter **Unternehmensanwendungen > Werkpass > Benutzer und Gruppen**:

1. **Benutzer/Gruppe hinzufügen** öffnen.
2. Einen Benutzer auswählen.
3. Unter **Rolle auswählen** `Werkpass Administrator` auswählen.
4. Die Zuweisung bestätigen.

Wenn der Entra-Tarif keine Gruppenzuweisungen unterstützt, können Benutzer
weiterhin einzeln zugewiesen werden. Nach einer neuen Rollenzuweisung muss
sich der Benutzer vollständig ab- und erneut anmelden, damit Microsoft einen
neuen ID-Token mit dem `roles`-Claim ausstellt.

## Verhalten und Grenzen

- Die automatische Rolle wird nur beim erstmaligen Beitritt zur Organisation
  gesetzt. Bestehende Mitgliedschaften werden nicht ungefragt überschrieben.
- Manuell in Werkpass vergebene Rollen bleiben dadurch erhalten.
- Für eine spätere vollständige Rollen-Synchronisation einschließlich Entzug
  ist eine eigene, revisionssichere Synchronisationsrichtlinie erforderlich.
- Die App-Rolle erfordert keine Berechtigung zum Lesen von Microsoft Graph,
  E-Mails, Dateien oder Verzeichnisdaten.
