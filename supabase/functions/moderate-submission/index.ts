// moderate-submission — the second mandatory Supabase Edge Function from
// DEC-0045. Authenticated moderators only. Runs under the service role so it
// can (a) re-verify moderator status server-side rather than trust RLS
// alone, (b) issue short-lived signed URLs for private evidence, and
// (c) write an append-only moderation_log entry for every action.
//
// Every action re-checks the hard rule from spec 6.2 before touching
// verification_tier: a run can only become 'verified' if a public
// video_link evidence row exists for it (the DB trigger
// enforce_verification_requires_video enforces this independently too —
// this function's own check exists so a caller gets a clean 422 instead of
// a raw Postgres error).
//
// v5 (30.10.2026, RS-0091): request_correction also stores the reason in
// runs.correction_note, which the driver sees in My laps and answers via the
// correct-run function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Spec 8.3: private evidence is only ever exposed to a moderator for a short,
// fixed window, never permanently.
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const EVIDENCE_BUCKET = Deno.env.get("EVIDENCE_BUCKET") ?? "lap-evidence";

type Action =
  | { action: "accept_provisional"; run_id: string; reason?: string }
  | { action: "verify"; run_id: string; reason?: string }
  | { action: "reject"; run_id: string; reason: string }
  | { action: "invalidate"; run_id: string; reason: string }
  | { action: "request_correction"; run_id: string; reason: string }
  | { action: "issue_signed_url"; evidence_id: string };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "missing Authorization header" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "invalid session" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Server-side moderator re-verification (DEC-0045: RLS is an additional,
  // not the sole, protection layer for moderation actions).
  const { data: driver } = await admin
    .from("drivers")
    .select("driver_id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (!driver) return jsonResponse({ error: "no driver profile" }, 403);

  const { data: modRow } = await admin
    .from("moderators")
    .select("driver_id")
    .eq("driver_id", driver.driver_id)
    .maybeSingle();
  if (!modRow) return jsonResponse({ error: "not a moderator" }, 403);

  const moderatorDriverId = driver.driver_id as string;

  let body: Partial<Action>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  if (!body.action) return jsonResponse({ error: "action is required" }, 400);

  async function loadRun(runId: string) {
    const { data, error } = await admin.from("runs").select("*").eq("run_id", runId).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async function logAction(
    runId: string | null,
    evidenceId: string | null,
    action: string,
    previous: unknown,
    next: unknown,
    reason: string | null,
  ) {
    await admin.from("moderation_log").insert({
      run_id: runId,
      evidence_id: evidenceId,
      moderator_driver_id: moderatorDriverId,
      action,
      previous_value: previous,
      new_value: next,
      reason,
    });
  }

  switch (body.action) {
    case "accept_provisional": {
      const { run_id, reason } = body as Extract<Action, { action: "accept_provisional" }>;
      const run = await loadRun(run_id);
      if (!run) return jsonResponse({ error: "run not found" }, 404);
      const update = { review_status: "accepted" };
      const { error } = await admin.from("runs").update(update).eq("run_id", run_id);
      if (error) return jsonResponse({ error: error.message }, 422);
      await logAction(run_id, null, "accept_provisional", { review_status: run.review_status }, update, reason ?? null);
      return jsonResponse({ ok: true });
    }

    case "verify": {
      // Spec 6.2: only reachable with a human-reviewed, complete, uncut lap
      // video. This function does not and cannot watch the video for the
      // moderator — it only records that a moderator attests to having done
      // so, plus the hard DB-level guard that a public video_link evidence
      // row must already exist.
      const { run_id, reason } = body as Extract<Action, { action: "verify" }>;
      const run = await loadRun(run_id);
      if (!run) return jsonResponse({ error: "run not found" }, 404);

      const { data: videoEvidence } = await admin
        .from("evidence")
        .select("evidence_id")
        .eq("run_id", run_id)
        .eq("type", "video_link")
        .eq("visibility", "public")
        .eq("retention_state", "active")
        .limit(1)
        .maybeSingle();
      if (!videoEvidence) {
        return jsonResponse(
          { error: "cannot verify: no public, active video_link evidence attached to this run (spec 6.2)" },
          422,
        );
      }

      const previous = {
        review_status: run.review_status,
        verification_tier: run.verification_tier,
        publication_status: run.publication_status,
      };
      const update = {
        review_status: "accepted",
        verification_tier: "verified",
        publication_status: "official",
      };
      const { error } = await admin.from("runs").update(update).eq("run_id", run_id);
      if (error) return jsonResponse({ error: error.message }, 422);
      await logAction(run_id, null, "verify", previous, update, reason ?? null);
      return jsonResponse({ ok: true });
    }

    case "reject": {
      const { run_id, reason } = body as Extract<Action, { action: "reject" }>;
      if (!reason) return jsonResponse({ error: "reason is required to reject a run" }, 400);
      const run = await loadRun(run_id);
      if (!run) return jsonResponse({ error: "run not found" }, 404);
      const update = { review_status: "rejected", publication_status: "hidden" };
      const { error } = await admin.from("runs").update(update).eq("run_id", run_id);
      if (error) return jsonResponse({ error: error.message }, 422);
      await logAction(run_id, null, "reject", { review_status: run.review_status }, update, reason);
      return jsonResponse({ ok: true });
    }

    case "invalidate": {
      // 5.1: "früher akzeptierte Runde gilt nicht mehr; Grund ist öffentlich
      // sichtbar" — publication_status moves to archived, not hidden, so the
      // run stays reachable via its own URL with a visible reason.
      const { run_id, reason } = body as Extract<Action, { action: "invalidate" }>;
      if (!reason) return jsonResponse({ error: "reason is required to invalidate a run" }, 400);
      const run = await loadRun(run_id);
      if (!run) return jsonResponse({ error: "run not found" }, 404);
      const update = { review_status: "invalidated", publication_status: "archived" };
      const { error } = await admin.from("runs").update(update).eq("run_id", run_id);
      if (error) return jsonResponse({ error: error.message }, 422);
      await logAction(run_id, null, "invalidate", { review_status: run.review_status }, update, reason);
      return jsonResponse({ ok: true });
    }

    case "request_correction": {
      const { run_id, reason } = body as Extract<Action, { action: "request_correction" }>;
      if (!reason) return jsonResponse({ error: "reason is required" }, 400);
      const run = await loadRun(run_id);
      if (!run) return jsonResponse({ error: "run not found" }, 404);
      // RS-0091: the reason is what the driver reads in My laps
      const update = { review_status: "needs_correction", publication_status: "hidden", correction_note: reason.slice(0, 1000) };
      const { error } = await admin.from("runs").update(update).eq("run_id", run_id);
      if (error) return jsonResponse({ error: error.message }, 422);
      await logAction(run_id, null, "request_correction", { review_status: run.review_status }, update, reason);
      return jsonResponse({ ok: true });
    }

    case "issue_signed_url": {
      // Spec 8.3 / DEC-0045: moderators only ever get time-limited signed
      // access to private evidence, never a permanent public URL.
      const { evidence_id } = body as Extract<Action, { action: "issue_signed_url" }>;
      const { data: evidence } = await admin
        .from("evidence")
        .select("evidence_id, storage_reference, type, visibility")
        .eq("evidence_id", evidence_id)
        .maybeSingle();
      if (!evidence) return jsonResponse({ error: "evidence not found" }, 404);
      if (evidence.type !== "screenshot") {
        return jsonResponse({ error: "only screenshot evidence has a private file to sign" }, 400);
      }
      const { data: signed, error } = await admin.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(evidence.storage_reference, SIGNED_URL_TTL_SECONDS);
      if (error || !signed) return jsonResponse({ error: error?.message ?? "failed to sign url" }, 500);
      await logAction(null, evidence_id, "issue_signed_url", null, { ttl_seconds: SIGNED_URL_TTL_SECONDS }, null);
      return jsonResponse({ signed_url: signed.signedUrl, expires_in_seconds: SIGNED_URL_TTL_SECONDS });
    }

    default:
      return jsonResponse({ error: "unknown action" }, 400);
  }
});
