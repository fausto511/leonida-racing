-- RS-0091 "Needs correction" (30.10.2026): the moderator's reason is shown to the driver
-- in My laps; when the driver corrects the run (Edge Function correct-run) we keep when
-- and what changed, so the moderator sees it in the queue.
alter table public.runs
  add column if not exists correction_note text,
  add column if not exists corrected_at timestamptz,
  add column if not exists correction_prev jsonb;
comment on column public.runs.correction_note is 'Reason of the last correction request (moderate-submission request_correction); visible to the driver. RS-0091.';
comment on column public.runs.corrected_at is 'When the driver last sent a correction (correct-run). RS-0091.';
comment on column public.runs.correction_prev is 'Values before the last driver correction: vehicle_id, vehicle_label, lap_time_ms, new_screenshot. RS-0091.';
