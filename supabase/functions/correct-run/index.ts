// correct-run — RS-0091 "Needs correction" (30.10.2026). A moderator asked for a
// correction (moderate-submission request_correction, reason in runs.correction_note);
// the driver answers from My laps: car and/or lap time, optionally a new screenshot.
// The run goes back into the moderator queue as 'submitted' and stays hidden.
//
// Same pattern as submit-lap / withdraw-run / add-video-evidence: the user is
// re-verified server-side and all writes run with the service role (DEC-0045).
// Drivers have no direct write access to runs/evidence (security fix 30.10.2026).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVIDENCE_BUCKET = Deno.env.get("EVIDENCE_BUCKET") ?? "lap-evidence";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function getDriverId(supabase: SupabaseClient, authUserId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("drivers")
    .select("driver_id, deleted_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || !data || data.deleted_at) return null;
  return data.driver_id as string;
}

interface Body {
  run_id?: string;
  vehicle_id?: string;
  lap_time_ms?: number;
  screenshot?: { storage_reference?: string; mime_type?: string; byte_size?: number } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "missing Authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "invalid session" }, 401);
  const authUserId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const driverId = await getDriverId(admin, authUserId);
  if (!driverId) return jsonResponse({ error: "no active driver profile for this account" }, 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }
  if (!body.run_id) return jsonResponse({ error: "run_id is required" }, 422);
  if (!body.vehicle_id) return jsonResponse({ error: "vehicle_id is required" }, 422);
  if (!Number.isInteger(body.lap_time_ms) || (body.lap_time_ms ?? 0) <= 0 || (body.lap_time_ms ?? 0) > 3_600_000) {
    return jsonResponse({ error: "lap_time_ms must be a positive integer" }, 422);
  }

  const { data: run, error: runErr } = await admin
    .from("runs")
    .select("run_id, driver_id, review_status, vehicle_id, lap_time_ms, vehicles(make, model)")
    .eq("run_id", body.run_id)
    .maybeSingle();
  if (runErr || !run) return jsonResponse({ error: "run not found" }, 404);
  if (run.driver_id !== driverId) return jsonResponse({ error: "not your submission" }, 403);
  if (run.review_status !== "needs_correction") {
    return jsonResponse(
      { error: "not_requested", detail: "No correction is open for this lap. Reload the page to see its current status." },
      409,
    );
  }

  const { data: vehicle } = await admin
    .from("vehicles")
    .select("vehicle_id")
    .eq("vehicle_id", body.vehicle_id)
    .maybeSingle();
  if (!vehicle) return jsonResponse({ error: "unknown vehicle_id" }, 422);

  // New screenshot: must be the driver's own upload (folder = auth user id, as in
  // submit-lap) and must exist in the bucket.
  const shot = body.screenshot ?? null;
  if (shot) {
    const ref = String(shot.storage_reference ?? "");
    if (!ref.startsWith(`${authUserId}/`) || ref.includes("..")) {
      return jsonResponse({ error: "invalid screenshot reference" }, 422);
    }
    const folder = ref.slice(0, ref.lastIndexOf("/"));
    const name = ref.slice(ref.lastIndexOf("/") + 1);
    const { data: files } = await admin.storage.from(EVIDENCE_BUCKET).list(folder, { search: name, limit: 1 });
    if (!files?.some((f) => f.name === name)) return jsonResponse({ error: "screenshot upload not found" }, 422);
    const { error: evErr } = await admin.from("evidence").insert({
      run_id: run.run_id,
      type: "screenshot",
      role: "private_original",
      visibility: "private",
      storage_reference: ref,
      mime_type: shot.mime_type ?? null,
      byte_size: shot.byte_size ?? null,
    });
    if (evErr) return jsonResponse({ error: "failed to store screenshot", details: evErr.message }, 500);
  }

  const v = (run as { vehicles?: { make?: string; model?: string } }).vehicles;
  const prev = {
    vehicle_id: run.vehicle_id,
    vehicle_label: v ? `${v.make} ${v.model}` : run.vehicle_id,
    lap_time_ms: run.lap_time_ms,
    new_screenshot: Boolean(shot),
  };
  const update = {
    vehicle_id: body.vehicle_id,
    lap_time_ms: body.lap_time_ms,
    review_status: "submitted",
    publication_status: "hidden",
    corrected_at: new Date().toISOString(),
    correction_prev: prev,
  };
  const { error: upErr } = await admin.from("runs").update(update).eq("run_id", run.run_id).eq("review_status", "needs_correction");
  if (upErr) return jsonResponse({ error: "failed to save the correction", details: upErr.message }, 500);

  // Provenance (spec 8.5): who changed which field, as in submit-lap.
  const prov = [];
  if (body.vehicle_id !== run.vehicle_id) {
    prov.push({ entity_type: "run", entity_id: run.run_id, field_name: "vehicle_id", source: "user", observed_value: run.vehicle_id, confirmed_value: body.vehicle_id, actor: driverId, reason: "driver correction (RS-0091)" });
  }
  if (body.lap_time_ms !== run.lap_time_ms) {
    prov.push({ entity_type: "run", entity_id: run.run_id, field_name: "lap_time_ms", source: "user", observed_value: run.lap_time_ms, confirmed_value: body.lap_time_ms, actor: driverId, reason: "driver correction (RS-0091)" });
  }
  if (prov.length) await admin.from("field_provenance").insert(prov);

  return jsonResponse({ corrected: true, run_id: run.run_id, review_status: "submitted" }, 200);
});
