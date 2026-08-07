# SharePoint-, Nextcloud- und Netzlaufwerk-Integrationen

Status: Konzeptentwurf  
Stand: 2026-08-07

## Ziel

lingl-docs ersetzt nicht die bestehende Dokumentenverwaltung eines Kunden. SharePoint, Nextcloud oder ein internes Netzlaufwerk bleibt die führende Quelle. lingl-docs übernimmt die kontrollierte, maschinenbezogene Bereitstellung für Kunden und Service.

Der gewünschte Ablauf lautet:

1. Ein Dokument wird in der bestehenden Quelle bearbeitet und freigegeben.
2. lingl-docs erkennt die Änderung.
3. Die Datei wird einer Maschine, einem Ordner und einem Dokument zugeordnet.
4. Nur eine tatsächlich neue Datei wird als neue Revision übernommen.
5. Die vorherige Revision bleibt archiviert.
6. Der permanente QR-Code der Maschine bleibt unverändert und zeigt auf die aktuelle freigegebene Revision.

## Produktversprechen

> lingl-docs ersetzt nicht Ihre Dokumentenverwaltung. SharePoint, Nextcloud oder Ihr Netzlaufwerk bleibt die zentrale Quelle. Sobald Sie ein Dokument freigeben, synchronisiert lingl-docs die neue Revision in die zugehörige Maschinenakte. Kunden und Service greifen weiterhin über denselben QR-Code auf die aktuelle Dokumentation zu. Frühere Revisionen bleiben nachvollziehbar archiviert.

Kurzform:

> Dokumente dort verwalten, wo sie bereits liegen – mit lingl-docs sicher und maschinenbezogen bereitstellen.

## Bereits vorhandene Grundlage

Das Projekt besitzt bereits wesentliche Bausteine für Integrationen:

- `Machine.slug` bildet eine stabile öffentliche Maschinen-URL unter `/m/{slug}`.
- `DocumentVersion` speichert unveränderliche Revisionen, Prüfsumme, Dateigröße, MIME-Type und S3-Schlüssel.
- `addDocumentVersion` archiviert die bisher aktuelle Version und markiert die neue Version als aktuell.
- Dateien liegen in einem S3-kompatiblen Object Storage.
- Downloads erfolgen über zeitlich begrenzte signierte URLs.
- Der manuelle Upload berechnet bereits eine SHA-256-Prüfsumme.
- Organisationen trennen die Daten mandantenfähig.

Relevante Dateien:

- `packages/db/prisma/schema.prisma`
- `packages/core/src/documents.ts`
- `packages/core/src/storage.ts`
- `apps/web/app/dashboard/actions.ts`
- `apps/web/app/dashboard/machines/[id]/upload-version-form.tsx`

## Zielarchitektur

```text
SharePoint / Nextcloud / lokaler Connector
                    │
             Änderung erkannt
                    │
        Synchronisationsauftrag erzeugen
                    │
        Datei und Metadaten herunterladen
                    │
       Zuordnung und Freigaberegel prüfen
                    │
          SHA-256-Prüfsumme bilden
                    │
      unverändert ──┴── geändert
          │                 │
      nichts tun       Datei in S3 speichern
                            │
                  DocumentVersion anlegen
                            │
                bisherige Version archivieren
                            │
                 Maschinenakte aktualisieren
```

Ein Connector darf nicht direkt Prisma-Operationen ausführen. Er liefert ein normalisiertes externes Dokument an einen gemeinsamen Import-Service in `packages/core`. Manueller Upload und automatische Synchronisation verwenden anschließend dieselbe Versionslogik.

## Gemeinsames Connector-Modell

Alle Anbieter sollten dieselbe interne Schnittstelle erfüllen:

```ts
interface DocumentConnector {
  testConnection(): Promise<ConnectionTestResult>;
  listChanges(cursor?: string): Promise<ChangeBatch>;
  getFile(itemId: string, versionId?: string): Promise<FileStream>;
  getVersions?(itemId: string): Promise<ExternalVersion[]>;
}
```

Ein normalisiertes externes Dokument benötigt mindestens:

```ts
interface ExternalDocument {
  itemId: string;
  versionId?: string;
  path: string;
  fileName: string;
  mimeType: string;
  size: number;
  etag?: string;
  modifiedAt: Date;
  revisionLabel?: string;
  releaseStatus?: string;
}
```

## Vorgeschlagenes Datenmodell

### IntegrationConnection

Eine Verbindung zu einem externen System.

- `id`
- `organizationId`
- `provider`: `sharepoint`, `nextcloud` oder `filesystem`
- `name`
- `status`: `active`, `paused`, `error` oder `disconnected`
- `secretRef` oder verschlüsselte Zugangsdaten
- `config` als providerabhängige JSON-Konfiguration
- `cursor`: Delta-Link, ETag-Cursor oder letzter Scan-Zeitpunkt
- `lastSyncAt`
- `lastSuccessAt`
- `lastError`
- `createdById`
- `createdAt`
- `updatedAt`

### SyncMapping

Ordnet einen externen Bereich einer Maschinenakte zu.

- `connectionId`
- `externalRootId` oder `externalPath`
- `customerId`
- `machineId`
- `folderId`
- `mappingStrategy`
- `releaseRule`
- `enabled`

Eine Zuordnung kann entweder einen kompletten Quellordner auf einen Maschinenordner abbilden oder Metadaten verwenden.

### ExternalDocumentBinding

Verbindet eine externe Datei dauerhaft mit einem lokalen Dokument.

- `connectionId`
- `externalItemId`
- `documentId`
- `externalPath`
- `lastVersionId`
- `lastEtag`
- `lastChecksum`
- `lastSeenAt`
- `status`

Empfohlene Eindeutigkeit:

```text
unique(connectionId, externalItemId)
```

### SyncRun

Protokolliert einen Synchronisationslauf.

- `connectionId`
- `status`: `queued`, `running`, `success`, `partial` oder `failed`
- `startedAt`
- `finishedAt`
- `filesDiscovered`
- `filesImported`
- `filesUnchanged`
- `filesRejected`
- `errorSummary`

Optional kann eine zusätzliche `SyncRunItem`-Tabelle jede einzelne Datei und ihren Status protokollieren.

### Erweiterungen an DocumentVersion

- `sequence`: interne fortlaufende Nummer
- `revision`: fachliche Revision, beispielsweise `V4` oder `Rev. 04`
- `sourceType`: `manual`, `sharepoint`, `nextcloud` oder `filesystem`
- `sourceConnectionId`
- `sourceItemId`
- `sourceVersionId`
- `sourceModifiedAt`

Sinnvolle Eindeutigkeitsregeln:

```text
unique(documentId, sequence)
unique(sourceConnectionId, sourceItemId, sourceVersionId)
```

Die zweite Regel muss mit nullable Feldern und den Eigenschaften von PostgreSQL abgestimmt werden. Alternativ kann ein stabiler `sourceFingerprint` gespeichert und eindeutig gemacht werden.

## Versions- und Revisionslogik

Es müssen drei unterschiedliche Begriffe getrennt werden:

| Begriff | Beispiel | Zweck |
|---|---|---|
| Interne Sequenz | `1` | Reihenfolge der Importe in lingl-docs |
| Fachliche Revision | `V4` | Für Kunden und Service sichtbare Dokumentrevision |
| Externe Versions-ID | SharePoint-Version oder Nextcloud-Zeitstempel | Idempotenz und Nachvollziehbarkeit der Quelle |

Beispiel:

```text
doku v4.pdf → interne Sequenz 1 → sichtbare Revision V4
doku v5.pdf → interne Sequenz 2 → sichtbare Revision V5
```

Die fachliche Revision wird in dieser Priorität bestimmt:

1. explizites Metadatenfeld aus der Quelle
2. konfiguriertes Muster im Dateinamen
3. manuelle Eingabe oder Bestätigung
4. automatisch erzeugte Revision als Rückfalllösung

Ein mögliches Dateinamensmuster erkennt zum Beispiel `V4`, `v04`, `Rev. 4` oder `Revision-4`. Automatische Erkennung muss in einer Vorschau bestätigt werden können, da Ziffern im Dateinamen auch Zeichnungsnummern oder Maschinennummern sein können.

Beim ersten Import von `doku v4.pdf` werden V1 bis V3 nicht künstlich erzeugt. Es gibt zwei mögliche Importmodi:

- **Nur aktueller Stand:** V4 wird als erste in lingl-docs vorhandene Revision importiert.
- **Historischer Erstimport:** vorhandene Quellversionen werden von alt nach neu übernommen.

Vor einer Connector-Integration sollte die aktuelle Revisionsvergabe verbessert werden. Derzeit zählt die Server Action bestehende Versionen und erzeugt anschließend `Rev. XX`. Bei parallelem manuellem und automatischem Upload kann dadurch dieselbe Nummer entstehen. Die Sequenzvergabe gehört zusammen mit dem Anlegen der Version in eine Datenbanktransaktion und sollte durch einen Unique Constraint geschützt werden.

## Freigabemodell

Nicht jede gespeicherte Änderung darf automatisch für Kunden sichtbar werden. Entwürfe müssen von freigegebenen Dokumenten getrennt bleiben.

Mögliche Regeln:

- SharePoint-Metadatenfeld, beispielsweise `docksStatus = Freigegeben`
- dedizierter Quellordner `Freigegeben`
- Nextcloud- oder Dateisystem-Unterordner `Freigegeben`
- jede Änderung synchronisieren, nur wenn der Kunde dies ausdrücklich konfiguriert

Empfehlung:

- SharePoint: Freigabe über ein Metadatenfeld
- Nextcloud und Netzlaufwerk im MVP: dedizierter Freigabeordner
- Vorschau vor Aktivierung jeder Zuordnung

## SharePoint-Integration

### Authentifizierung

Für einen Hintergrunddienst eignet sich Microsoft Graph mit einer eigenen Anwendungsidentität. Der Microsoft-365-Administrator muss die benötigten Berechtigungen genehmigen. Zugangsdaten dürfen nicht als Klartext in der normalen Konfiguration gespeichert werden.

Für eine SaaS-Integration wird ein Einrichtungsablauf benötigt:

1. Microsoft-365-Mandant verbinden
2. Administratorzustimmung einholen
3. Site auswählen
4. Dokumentbibliothek auswählen
5. Quellordner und Freigabefeld konfigurieren

### Änderungserkennung

Microsoft Graph Webhooks dienen nur als Signal, dass sich etwas geändert hat. Nach einer Benachrichtigung liest der Worker den Delta-Feed der betroffenen Drive-Struktur.

Der Delta-Ablauf:

1. initialen Delta-Lauf starten
2. alle Seiten über `@odata.nextLink` abarbeiten
3. `@odata.deltaLink` speichern
4. bei späteren Läufen den gespeicherten Delta-Link verwenden
5. neue und geänderte Elemente importieren
6. gelöschte Elemente nur als extern fehlend markieren

Der Delta-Feed beschreibt den neuesten bekannten Zustand. Wenn jede einzelne SharePoint-Zwischenversion übernommen werden soll, muss zusätzlich die Versionsliste der Datei gelesen werden.

Webhook-Subscriptions laufen ab und müssen rechtzeitig erneuert werden. Der Webhook-Endpunkt muss öffentlich über HTTPS erreichbar sein und den geheimen `clientState` prüfen.

### Dateidownload

Dateien werden über den Microsoft-Graph-Content-Endpunkt heruntergeladen. Graph antwortet dabei mit einer kurzlebigen, vorautorisierten Download-URL. Der Worker muss diese URL unmittelbar verwenden und darf sie nicht dauerhaft speichern.

### Zuordnungsmöglichkeiten

Bevorzugt über SharePoint-Spalten:

- `MachineSerialNumber`
- `DocumentType`
- `Revision`
- `ReleaseStatus`
- optional `Language`

Alternativ über eine definierte Ordnerstruktur:

```text
/Kunden/{Kundennummer}/Maschinen/{Seriennummer}/{Dokumentordner}/Datei.pdf
```

Metadaten sind stabiler als Pfade, weil Benutzer Ordner umbenennen oder verschieben können.

## Nextcloud-Integration

### Authentifizierung

Nextcloud stellt Dateien über WebDAV unter `/remote.php/dav` bereit. Für Dateien eines Benutzers liegt der Pfad üblicherweise unter:

```text
/remote.php/dav/files/{user}/...
```

Die Verbindung verwendet HTTPS sowie einen technischen Benutzer oder ein App-Passwort. Ein App-Passwort ist insbesondere bei aktivierter Zwei-Faktor-Authentifizierung sinnvoll.

### Änderungserkennung

Für den MVP wird regelmäßig synchronisiert:

1. Quellordner mit `PROPFIND` auflisten
2. Datei-ID, ETag, Größe und Änderungsdatum lesen
3. mit `ExternalDocumentBinding` vergleichen
4. nur neue oder geänderte Dateien mit `GET` herunterladen
5. SHA-256 bilden und nur bei abweichender Prüfsumme importieren

Empfohlenes Intervall für den MVP: zwei bis fünf Minuten. Ein eigener Nextcloud-Webhook beziehungsweise eine Nextcloud-App kann später ergänzt werden.

Nextcloud stellt auch vorherige Dateiversionen über einen speziellen WebDAV-Versionsendpunkt bereit. Dadurch ist ein historischer Erstimport grundsätzlich möglich. Er sollte jedoch optional sein, weil er Zeit und Speicher benötigt.

### Zuordnungsmöglichkeiten

Für den MVP empfiehlt sich eine definierte Struktur:

```text
/Freigegeben/{Kundennummer}/{Seriennummer}/{Dokumentordner}/Datei.pdf
```

Später können Nextcloud-Systemtags oder eigene Metadaten als alternative Zuordnungsstrategie ergänzt werden.

## Netzlaufwerk-Integration

Ein gehostetes lingl-docs kann nicht direkt auf ein internes SMB-Netzlaufwerk zugreifen. Ein eingehend erreichbarer SMB-Port wäre außerdem ein erhebliches Sicherheitsrisiko.

Benötigt wird ein kleiner lokaler Connector:

- läuft als Windows-Dienst im Kundennetz
- beobachtet einen oder mehrere freigegebene Ordner
- speichert einen lokalen Synchronisationscursor
- bildet Prüfsummen lokal
- baut ausschließlich ausgehende HTTPS-Verbindungen auf
- lädt nur freigegebene und geänderte Dateien hoch
- identifiziert sich mit einem widerrufbaren Geräte-Token
- puffert Änderungen bei einer unterbrochenen Internetverbindung

Der lokale Connector sollte dieselbe normalisierte Import-API verwenden wie SharePoint und Nextcloud.

## Hintergrundjobs

Das Repository enthält aktuell nur `apps/web`. Für zuverlässige Synchronisationen sollte ein separates `apps/worker` ergänzt werden.

Aufgaben des Workers:

- geplante Synchronisationsläufe starten
- Webhook-Ereignisse verarbeiten
- Dateien herunterladen und streamen
- SHA-256 bilden
- Datei in S3 speichern
- Revision transaktional anlegen
- Synchronisationsstatus aktualisieren
- Webhook-Subscriptions verlängern
- fehlgeschlagene Jobs mit Backoff erneut versuchen

Wie im ADR vorgesehen, eignet sich eine PostgreSQL-basierte Queue wie `graphile-worker` oder `pg-boss`. Dadurch ist kein zusätzlicher Redis-Dienst erforderlich.

Der aktuelle S3-Layer besitzt nur signierte Browser-Uploads. Für Connectoren wird zusätzlich eine serverseitige Streaming-Funktion benötigt, beispielsweise `putObject(storageKey, stream, contentType)`. Große Dateien dürfen nicht vollständig in den Arbeitsspeicher geladen werden.

## Idempotenz und Synchronisationsregeln

Eine Synchronisation muss beliebig oft wiederholbar sein, ohne doppelte Revisionen zu erzeugen.

Prüfreihenfolge:

1. Verbindung und Organisation prüfen
2. externe Datei-ID suchen
3. externe Versions-ID oder ETag vergleichen
4. Datei nur bei möglicher Änderung herunterladen
5. SHA-256 berechnen
6. mit letzter importierter Prüfsumme vergleichen
7. bei identischer Prüfsumme keine Revision erzeugen
8. bei neuer Prüfsumme eine neue Revision anlegen
9. Binding und Cursor erst nach erfolgreichem Import aktualisieren

Ein verschobenes oder umbenanntes Dokument bleibt über seine externe Datei-ID mit demselben lokalen Dokument verbunden.

Eine externe Löschung löscht niemals historische Revisionen in lingl-docs. Stattdessen wird das Binding beispielsweise als `missing` oder `removed_at_source` markiert. Ein Administrator entscheidet, ob die aktuelle Veröffentlichung zurückgezogen wird.

## Betriebsarten der Quellstruktur

Beim Verbinden einer Quelle darf lingl-docs nicht ungefragt alle Kunden und Maschinen in SharePoint oder Nextcloud anlegen. Der Administrator wählt eine von zwei Betriebsarten.

### Variante 1: Struktur durch lingl-docs verwalten

Diese Variante eignet sich für neue oder noch nicht einheitlich organisierte Ablagen.

Beim Einrichten wählt der Administrator zunächst einen Stammordner, beispielsweise:

```text
/lingl-docs-Freigaben
```

Anschließend wählt er aus, welche Kunden und Maschinen synchronisiert werden sollen. Vor dem Anlegen zeigt lingl-docs eine Vorschau der geplanten Struktur:

```text
/lingl-docs-Freigaben
  /10023 - Muster GmbH
    /SN-4711 - Schleifmaschine
      /Betriebsanleitungen
      /Sicherheit
      /Schaltpläne
      /Zeichnungen
    /SN-4712 - Fräsmaschine
      /Betriebsanleitungen
      /Sicherheit
      /Schaltpläne
      /Zeichnungen
```

Wird später eine neue Maschine in lingl-docs angelegt, kann der Dialog folgende Option anbieten:

```text
☑ Ordner in SharePoint oder Nextcloud erstellen
```

Die automatische Ordneranlage muss immer bewusst bestätigt werden. Sie wird nicht standardmäßig für alle vorhandenen Kunden und Maschinen ausgeführt.

lingl-docs speichert zu jedem erzeugten Ordner die externe SharePoint- oder Nextcloud-ID. Die Zuordnung darf nicht ausschließlich vom sichtbaren Pfad abhängen. Dadurch bleibt sie auch erhalten, wenn ein Benutzer einen Kunden-, Maschinen- oder Dokumentordner umbenennt oder verschiebt.

Erforderliche Berechtigungen:

- Ordner auflisten
- Ordner erstellen
- externe Ordner-ID und Pfad lesen
- Dateien lesen
- optional Metadaten lesen

Die verwaltete Struktur erfordert damit Schreibzugriff auf den ausgewählten Stammordner. Sie sollte nicht automatisch breitere Schreibrechte auf die gesamte SharePoint-Site oder den gesamten Nextcloud-Account erhalten.

### Variante 2: Bestehende Struktur zuordnen

Diese Variante eignet sich für Unternehmen mit einer bereits etablierten Dokumentenablage. lingl-docs erstellt keine Ordner, sondern verbindet vorhandene Quellordner mit Maschinenakten.

Beispiel:

```text
SharePoint: /Technik/Aufträge/4711/Enddokumentation
                            ↓
lingl-docs: Muster GmbH / Schleifmaschine / Betriebsanleitungen
```

Der Administrator wählt dabei:

1. vorhandenen Quellordner
2. Kunden in lingl-docs
3. Maschine in lingl-docs
4. Zielordner der Maschinenakte
5. Freigaberegel

Die Zuordnung wird als `SyncMapping` gespeichert. Auch hier wird bevorzugt die externe Ordner-ID statt nur des Pfades verwendet.

In dieser Betriebsart genügt im einfachsten Fall lesender Zugriff. Sie ist daher für bestehende oder besonders restriktive Dokumentenverwaltungen geeignet.

### Empfehlung für den MVP

Langfristig sollten beide Varianten angeboten werden:

- **Neue Struktur durch lingl-docs erstellen**
- **Vorhandenen Ordner zuordnen**

Für einen ersten internen MVP ist die verwaltete Struktur einfacher, weil Ordnernamen und Zuordnungsregeln kontrolliert werden können. Der gemeinsame Datenkern muss trotzdem beide Varianten unterstützen, damit Kunden später nicht zur Migration ihrer bestehenden Ablage gezwungen werden.

### Einrichtungsablauf für eine verwaltete Struktur

1. SharePoint oder Nextcloud verbinden.
2. Stammordner auswählen oder neu erstellen.
3. gewünschte Kunden auswählen.
4. gewünschte Maschinen auswählen.
5. zu erzeugende Ordnerstruktur als Vorschau anzeigen.
6. Schreibzugriff und Umfang bestätigen.
7. Ordner erstellen und externe IDs speichern.
8. erste Synchronisation als Vorschau ausführen.
9. Synchronisation aktivieren.

### Ablage und Erkennung eines Dokuments

Beispiel für eine Datei in einer verwalteten Struktur:

```text
/10023 - Muster GmbH
  /SN-4711 - Schleifmaschine
    /Betriebsanleitungen
      /Betriebsanleitung.pdf
```

Aus der gespeicherten Ordnerzuordnung kennt lingl-docs:

- Kunde: Muster GmbH
- Maschine: Schleifmaschine
- Maschinenordner: Betriebsanleitungen
- Quelle: SharePoint oder Nextcloud

Beim ersten Import wird ein lokales Dokument angelegt und die Datei als erste in lingl-docs vorhandene Version gespeichert. Wird dieselbe externe Datei später aktualisiert, entsteht eine neue `DocumentVersion`. Die vorherige Version bleibt archiviert und der QR-Code der Maschine unverändert.

### Stabiler Dokumentname und fachliche Revision

Am zuverlässigsten bleibt der eigentliche Dateiname stabil:

```text
Betriebsanleitung.pdf
```

Die fachliche Revision wird getrennt gespeichert:

```text
Revision: V4
Status: Freigegeben
```

Für SharePoint sollte diese Information bevorzugt aus Spalten der Dokumentbibliothek gelesen werden.

Für Nextcloud oder ein Netzlaufwerk kann die Revision alternativ aus dem Dateinamen erkannt werden:

```text
Betriebsanleitung_V4.pdf
Betriebsanleitung_V5.pdf
```

In diesem Fall benötigt lingl-docs zusätzlich einen stabilen Dokumentschlüssel, damit V4 und V5 als Revisionen desselben Dokuments erkannt werden. Der Schlüssel kann durch ein konfiguriertes Dateinamensmuster bestimmt werden:

```text
Dokumentschlüssel: Betriebsanleitung
Revision: V5
```

Ohne Metadaten oder ein bestätigtes Dateinamensmuster darf eine neu benannte Datei nicht automatisch mit einem bestehenden Dokument zusammengeführt werden. Sie landet zunächst in der Prüfliste.

### Auswirkungen von Änderungen in der Quelle

| Änderung in SharePoint oder Nextcloud | Verhalten in lingl-docs |
|---|---|
| Inhalt derselben Datei geändert | Neue Revision anlegen, sofern die Prüfsumme neu ist |
| Datei umbenannt | Binding über externe Datei-ID behalten und Anzeigename aktualisieren |
| Datei verschoben | Binding behalten, Zuordnung prüfen und Pfad aktualisieren |
| neue Datei mit erkennbarem Dokumentschlüssel | Als neue Revision des bestehenden Dokuments prüfen |
| neue Datei ohne eindeutige Zuordnung | In die Prüfliste aufnehmen |
| Datei gelöscht | Historie nicht löschen; Binding als extern entfernt markieren |
| Ordner umbenannt | Mapping über externe Ordner-ID behalten |
| Maschine in lingl-docs umbenannt | optional sichtbaren Quellordner umbenennen, Mapping bleibt stabil |

Die automatische Umbenennung externer Ordner sollte eine separate Einstellung sein. Standardmäßig aktualisiert lingl-docs nur seine Anzeige und behält die bestehende externe Ordnerstruktur bei.

## Benutzeroberfläche

### Integrationsübersicht

Neuer Navigationspunkt `Integrationen`:

```text
Integrationen                                      [Quelle verbinden]

SharePoint Produktion
Verbunden · letzte Synchronisation vor 2 Minuten
12 Zuordnungen · 48 Dokumente                      [Öffnen]

Nextcloud Service
Fehler · Anmeldung abgelaufen                      [Erneut verbinden]
```

### Einrichtungsassistent

1. Anbieter auswählen
2. Zugang verbinden
3. Site, Bibliothek oder Quellordner auswählen
4. Zuordnungs- und Freigaberegel festlegen
5. Vorschau kontrollieren
6. Synchronisation aktivieren

### Zuordnungsvorschau

```text
Externe Datei              Ziel                            Ergebnis
BA-10042-DE.pdf            Maschine 10042 / Anleitung     Bereit
Schaltplan-4711.pdf        Maschine 4711 / Schaltplan     Bereit
unknown.pdf                –                               Nicht zugeordnet
```

Nicht zuordenbare Dateien werden nicht stillschweigend ignoriert, sondern erscheinen in einer Prüfliste.

### Maschinenakte

Bei synchronisierten Dokumenten wird die Herkunft angezeigt:

```text
Betriebsanleitung.pdf
V4 · Aktuell
Quelle: SharePoint · synchronisiert vor 2 Minuten
```

Zusätzliche Aktionen:

- Quelldokument öffnen
- jetzt synchronisieren
- Synchronisationsverlauf anzeigen
- Zuordnung bearbeiten
- automatische Synchronisation pausieren

Manuelle Uploads bleiben möglich und werden mit `Quelle: Manueller Upload` gekennzeichnet.

## Sicherheit

- OAuth-Tokens und App-Passwörter verschlüsselt oder in einem Secret Store speichern.
- Berechtigungen pro Organisation und Verbindung prüfen.
- Für externe URLs SSRF-Schutz und kontrollierten ausgehenden Netzwerkzugriff vorsehen.
- Nextcloud-Verbindungen ausschließlich über HTTPS zulassen, außer in explizit kontrollierten Entwicklungsumgebungen.
- Webhook-Signale beziehungsweise `clientState` validieren.
- Download-URLs niemals dauerhaft speichern oder protokollieren.
- Dateigröße und erlaubte MIME-Types vor dem Import prüfen.
- Optional Virenscan vor Veröffentlichung einbauen.
- Jede automatische Veröffentlichung auditierbar protokollieren.
- Geräte-Tokens des lokalen Connectors rotierbar und widerrufbar machen.
- Externe Löschungen niemals ungeprüft in historische Daten spiegeln.

## Fehlerbehandlung

Mögliche Zustände einer Verbindung:

- `active`: Synchronisation funktioniert
- `paused`: bewusst pausiert
- `reauth_required`: Zugang muss erneuert werden
- `degraded`: einzelne Dateien schlagen fehl
- `error`: Verbindung oder Konfiguration ist nicht verwendbar

Ein Fehlerprotokoll muss verständliche Meldungen liefern, beispielsweise:

- Zugang abgelaufen
- Quellordner nicht mehr vorhanden
- Maschine anhand der Seriennummer nicht gefunden
- Revision konnte nicht bestimmt werden
- Dateityp nicht erlaubt
- Datei überschreitet die Größenbegrenzung
- S3-Upload fehlgeschlagen
- doppelte Zuordnung erkannt

Fehlerhafte Dateien dürfen den restlichen Synchronisationslauf nicht vollständig blockieren.

## Empfohlene Umsetzungsschritte

### Phase 1: Gemeinsamer Importkern

1. Revisionssequenz transaktionssicher machen.
2. fachliche Revision und interne Sequenz trennen.
3. Herkunftsfelder an `DocumentVersion` ergänzen.
4. `IntegrationConnection`, `SyncMapping`, `ExternalDocumentBinding` und `SyncRun` modellieren.
5. serverseitigen Streaming-Upload nach S3 ergänzen.
6. gemeinsamen idempotenten Import-Service implementieren.

### Phase 2: Oberfläche und Test-Connector

1. Integrationsübersicht erstellen.
2. Einrichtungsassistent und Zuordnungsvorschau erstellen.
3. lokalen Test-Connector für Beispieldateien implementieren.
4. Synchronisationsprotokoll und Fehlerliste ergänzen.

### Phase 3: Nextcloud-MVP

1. WebDAV-Verbindung testen.
2. Ordnerauswahl implementieren.
3. regelmäßigen `PROPFIND`-Scan implementieren.
4. Datei-Download und Prüfsummenvergleich implementieren.
5. Freigabeordner und Pfadzuordnung unterstützen.
6. optional historischen Erstimport ergänzen.

### Phase 4: SharePoint

1. Microsoft-Entra-App und Admin-Consent-Ablauf implementieren.
2. Site- und Bibliotheksauswahl implementieren.
3. Delta-Synchronisation implementieren.
4. Webhook-Endpunkt und Subscription-Verlängerung implementieren.
5. SharePoint-Metadaten auf Maschinen und Revisionen abbilden.
6. optional SharePoint-Versionshistorie importieren.

### Phase 5: Netzlaufwerk-Connector

1. Geräte-Registrierung und Tokenmodell implementieren.
2. Windows-Dienst entwickeln.
3. Dateisystemüberwachung und lokalen Puffer implementieren.
4. gesicherte Upload-API implementieren.
5. Update- und Diagnosemechanismus für den Connector ergänzen.

## Empfohlener MVP

Der kleinste fachlich sinnvolle MVP ist:

- eine Nextcloud-Verbindung pro Organisation
- ein konfigurierbarer Freigabeordner
- Pfadzuordnung über Kundennummer, Seriennummer und Dokumentordner
- Synchronisation alle zwei bis fünf Minuten
- SHA-256-basierte Duplikaterkennung
- nur aktueller Stand beim Erstimport
- Synchronisationsstatus und Fehlerliste
- keine automatische Löschung
- manuelle Uploads bleiben parallel verfügbar

Nextcloud eignet sich als erster echter Connector, weil WebDAV vergleichsweise geradlinig ist. Der gemeinsame Importkern muss trotzdem providerneutral sein, damit SharePoint anschließend ohne Umbau des Versionsmodells ergänzt werden kann.

## Offene Entscheidungen

- Welche Quelle soll zuerst produktiv unterstützt werden?
- Erfolgt die Freigabe über Metadaten oder einen Freigabeordner?
- Soll der historische Erstimport im MVP enthalten sein?
- Dürfen externe Änderungen sofort veröffentlicht werden oder ist eine Bestätigung in lingl-docs erforderlich?
- Welche maximalen Dateigrößen und MIME-Types gelten pro Organisation?
- Wie werden Konflikte zwischen manuellem Upload und Connector behandelt?
- Wird eine extern gelöschte aktuelle Datei weiterhin veröffentlicht oder zurückgezogen?
- Welche SharePoint-Berechtigungen werden für den konkreten Mandanten minimal benötigt?
- Wo werden Connector-Secrets produktiv gespeichert?

## Offizielle Quellen

### Microsoft SharePoint und Graph

- [Microsoft Graph: Zugriff ohne Benutzer (Client Credentials)](https://learn.microsoft.com/en-us/graph/auth-v2-service)
- [Microsoft Graph: DriveItem Delta](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0)
- [Microsoft Graph: Webhook-Benachrichtigungen empfangen](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Microsoft Graph: Subscription-Ressource](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
- [Microsoft Graph: Dateiinhalt herunterladen](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Microsoft Graph: Inhalt einer bestimmten DriveItem-Version herunterladen](https://learn.microsoft.com/en-us/graph/api/driveitemversion-get-contents?view=graph-rest-1.0)
- [SharePoint-Webhooks – Überblick](https://learn.microsoft.com/en-us/sharepoint/dev/apis/webhooks/overview-sharepoint-webhooks)

### Nextcloud

- [Nextcloud Developer Manual: WebDAV](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/index.html)
- [Nextcloud Developer Manual: grundlegende Datei- und Ordneroperationen](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/basic.html)
- [Nextcloud Developer Manual: Dateiversionen über WebDAV](https://docs.nextcloud.com/server/stable/developer_manual/client_apis/WebDAV/versions.html)
- [Nextcloud User Manual: Zugriff über WebDAV](https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html)
