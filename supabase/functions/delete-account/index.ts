// delete-account (RS-0037, DEC-0079) — "Delete my account" in My Account >
// Settings. Removes all personal data; reviewed lap times stay on the
// leaderboard as "Deleted driver". Order matters:
//   1. screenshot files (they show the PSN name) are deleted from storage;
//      if that fails, nothing else happens
//   2. anonymize_driver_account() — deletes/anonymises all rows (one transaction)
//   3. the auth user (login) is deleted; the driver row is already detached
// A later Discord login creates a brand-new, empty account.
// Same auth pattern as withdraw-run: the user is re-verified server-side.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVIDENCE_BUCKET = "lap-evidence";
const BATCH = 100;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...CORS } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing Authorization header" }, 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid session" }, 401);
  const uid = userData.user.id;

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  if (body.confirm !== "DELETE") return json({ error: "confirmation missing" }, 422);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: driver, error: dErr } = await admin
    .from("drivers").select("driver_id, deleted_at").eq("auth_user_id", uid).maybeSingle();
  if (dErr) return json({ error: "could not load driver" }, 500);

  if (driver && !driver.deleted_at) {
    // 1) screenshot files
    const { data: files, error: fErr } = await admin.rpc("account_evidence_files", { p_driver: driver.driver_id });
    if (fErr) return json({ error: "could not list evidence files" }, 500);
    const paths = ((files ?? []) as { storage_reference: string }[]).map((f) => f.storage_reference).filter(Boolean);
    for (let i = 0; i < paths.length; i += BATCH) {
      const { error: rmErr } = await admin.storage.from(EVIDENCE_BUCKET).remove(paths.slice(i, i + BATCH));
      if (rmErr) return json({ error: "could not delete evidence files — nothing was deleted, please try again" }, 500);
    }
    // 1b) Discord bot records tied to the Discord ID (17.10.2026): /ping cooldown stamp.
    //     Role-sync state is cleared by the role job the drivers trigger queues; leftovers by the daily housekeeping.
    const { data: dd } = await admin.from("drivers").select("discord_user_id").eq("driver_id", driver.driver_id).maybeSingle();
    if (dd?.discord_user_id) await admin.from("discord_bot_state").delete().eq("key", `ping_last:${dd.discord_user_id}`);
    // 2) rows
    const { error: aErr } = await admin.rpc("anonymize_driver_account", { p_driver: driver.driver_id });
    if (aErr) return json({ error: "could not anonymise the account" }, 500);
  }

  // 3) login
  const { error: delErr } = await admin.auth.admin.deleteUser(uid);
  if (delErr) return json({ error: "data removed, but the login could not be deleted — please contact us" }, 500);

  return json({ ok: true });
});
