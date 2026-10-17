-- RS-0073 (Fausto 16.10.2026): the only photo shows the GranForma-badged car,
-- so the Pegassi Zorrusso falls back to the garage placeholder with its logo.
update public.vehicles set has_photo = false, updated_at = now() where vehicle_id = 'pegassi-zorrusso';
