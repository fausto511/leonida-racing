# Datenbank-Migrationen — Regeln und Sonderfälle

Stand: 2026-10-17 (RS-0075, DEC-0133). Live-Projekt: `leonida-racing` (Supabase).

## Regel (gilt für Claude, Codex und jede Änderung)

1. Strukturänderungen an der Datenbank nur als Migration anwenden (Supabase
   `apply_migration`), nie im SQL-Editor. Notfall-Ausnahme: sofort danach
   eine Datei nachziehen und Fausto Bescheid geben.
2. Direkt danach die Version lesen, die die Datenbank vergeben hat
   (`select version, name from supabase_migrations.schema_migrations order by version desc limit 1`).
3. Im selben Arbeitsschritt die Datei `supabase/migrations/<version>_<name>.sql`
   auf `public-mirror` anlegen, mit genau dem angewendeten SQL, und committen.
   Keine selbst gewählten Zeitstempel, keine Ablage in `Claude outputs/`.
4. Wöchentliche Kontrolle (geplante Aufgabe „Migrations-Abgleich“) vergleicht
   Live-Liste und Repo und meldet nur Abweichungen.

## Sonderfälle: Dateien ohne Eintrag in der Live-Historie

Diese Dateien sind live angewendet (Objekte am 17.10.2026 geprüft), stehen
aber nicht in `supabase_migrations.schema_migrations`, weil sie vor Beginn der
Historie oder über den SQL-Editor eingespielt wurden. Sie bleiben als Teil des
Bauplans im Ordner. Die wöchentliche Kontrolle kennt sie und meldet sie nicht.

Vor Beginn der Historie (Einrichtung September 2026):
- 20260912000000_init_schema.sql
- 20260912000001_auth_bridge.sql
- 20260912000002_storage_evidence_bucket.sql
- 20260913000000_security_lint_hardening.sql
- 20260921000000_moderator_direct_edit_audit.sql
- 20260923000000_leaderboard_dedup.sql

Über den SQL-Editor eingespielt (Oktober 2026):
- 20261002180000_crews_up_to_five_moderation_notes.sql
- 20261002200000_crew_invites.sql
- 20261004180000_hub_events_locations.sql
- 20261006120000_discord_privacy_cleanup.sql
- 20261008120000_discord_role_sync.sql
- 20261008150000_driver_psn_name.sql
- 20261014120000_redesign_phase0.sql
- 20261014170000_crew_sort_order_default.sql

Achtung: `supabase db push` mit der Supabase-CLI würde diese Dateien für
„ausstehend“ halten und erneut ausführen wollen. Die CLI wird für dieses
Projekt nicht zum Einspielen benutzt. Falls doch einmal nötig: vorher
`supabase migration repair --status applied <version>` für jede dieser Dateien.

## Abgleich 17.10.2026 (RS-0075)

- 9 Dateien auf die Live-Version umbenannt (Inhalt bis auf Kommentare gleich).
- 4 Dateien durch den exakten Live-Inhalt ersetzt: Sie hatten mehrere
  Live-Migrationen zu einer zusammengefasst (z. B. `discord_feeds` enthielt
  auch `discord_bot_state`). Die Einzelteile liegen jetzt als eigene Dateien vor.
- 14 fehlende Dateien aus dem gespeicherten Live-SQL wiederhergestellt
  (byte-genau, per MD5 geprüft).
