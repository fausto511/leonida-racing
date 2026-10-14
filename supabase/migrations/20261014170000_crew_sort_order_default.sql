-- Crew-Reihenfolge (Fausto 14.10.2026, DEC-0123): Crews ohne gesetzten Platz ans Ende.
-- 100 = Standard = "kein fester Platz". Gezielt gesetzte Werte (1, 2, 3 ...) stehen davor.
-- Der Schutz-Trigger erlaubt sort_order nur eingeloggten Moderatoren; der SQL Editor ist
-- kein eingeloggter Nutzer. Deshalb wird genau dieser Trigger nur innerhalb dieser
-- Transaktion aus- und wieder eingeschaltet (Fehler = alles zurück).
begin;
alter table public.crews alter column sort_order set default 100;
alter table public.crews disable trigger crews_protect_moderated_fields;
update public.crews set sort_order = 100 where sort_order = 0;
alter table public.crews enable trigger crews_protect_moderated_fields;
commit;
-- Kontrolle: erwartet je eine Crew mit 1, 2, 3 und drei mit 100; Trigger wieder aktiv (O)
select sort_order, count(*) from public.crews group by sort_order order by sort_order;
