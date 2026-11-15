# Datenbank-Sicherung und Wiederherstellung (RS-0083)

**Was:** täglich 03:23 UTC (Workflow `Database backup (daily, encrypted)`), Schemas `public`, `private`, `auth` (Logins), `storage` (nur Metadaten, nicht die Bilddateien) und `supabase_migrations`. Verschlüsselt (gpg, AES-256), 30 Tage als Artifact im jeweiligen Workflow-Lauf.

**Nicht enthalten:** Dateien im Supabase-Storage (Screenshots als Beleg; werden ohnehin nach 60 Tagen gelöscht), Edge-Function-Secrets.

## Sicherung holen
GitHub → Actions → „Database backup (daily, encrypted)“ → Lauf auswählen → unten unter „Artifacts“ herunterladen (ZIP mit `leonida-db-JJJJ-MM-TT.dump.gpg`).

## Entschlüsseln
```
gpg --decrypt -o db.dump leonida-db-JJJJ-MM-TT.dump.gpg
```
(Passphrase = Secret `BACKUP_PASSPHRASE`; Kopie liegt bei Fausto außerhalb von GitHub.)

## Wiederherstellen
Nur mit Claude zusammen und nach Rücksprache – eine Wiederherstellung überschreibt Live-Daten.
- Einzelne Tabelle (Beispiel): `pg_restore -d "$DB_URL" --data-only -t runs db.dump`
- Inhalt ansehen ohne etwas zu ändern: `pg_restore -l db.dump`
- Kompletter Neuaufbau: in ein neues, leeres Supabase-Projekt (`pg_restore -d "$NEW_DB_URL" --no-owner db.dump`), danach Edge Functions und Secrets neu setzen.
