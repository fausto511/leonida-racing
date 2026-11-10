// site-visits-sync (Fausto 10.11.2026) — copies daily page views / visits for
// leonidaracing.com from Cloudflare Web Analytics into public.site_daily_visits.
// Only visitors who allowed visitor statistics are counted (privacy policy, section 12);
// Cloudflare samples these events, so the numbers are estimates. Aggregated figures only.
// Called hourly by pg_cron via pg_net with a secret job token (private.job_tokens);
// deployed with verify_jwt = false and checks the token itself.
// Secret: CF_ANALYTICS_TOKEN (Cloudflare API token, Account Analytics: Read).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CF_TOKEN = Deno.env.get("CF_ANALYTICS_TOKEN") ?? "";
const CF_ACCOUNT = "4e90b635d06def938e8110b6eb17d887";
const HOST = "leonidaracing.com";
const DAYS = 31; // Cloudflare keeps Web Analytics data for a limited time; we keep our own copy

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const QUERY = `query ($acc: string!, $from: Time!, $to: Time!, $host: string!) {
  viewer {
    accounts(filter: { accountTag: $acc }) {
      rumPageloadEventsAdaptiveGroups(
        limit: 1000
        filter: { datetime_geq: $from, datetime_lt: $to, requestHost: $host }
        orderBy: [date_ASC]
      ) {
        count
        sum { visits }
        dimensions { date }
      }
    }
  }
}`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: ok, error: tokErr } = await admin.rpc("check_job_token", {
    p_name: "site-visits-sync",
    p_token: req.headers.get("x-job-token") ?? "",
  });
  if (tokErr || ok !== true) return json({ error: "forbidden" }, 403);
  if (!CF_TOKEN) return json({ error: "CF_ANALYTICS_TOKEN missing" }, 500);

  const to = new Date();
  const from = new Date(to.getTime() - DAYS * 86400e3);
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${CF_TOKEN}` },
    body: JSON.stringify({ query: QUERY, variables: { acc: CF_ACCOUNT, from: from.toISOString(), to: to.toISOString(), host: HOST } }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.errors?.length) {
    return json({ error: "cloudflare", status: res.status, detail: body?.errors ?? body }, 502);
  }
  const groups = body.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
  const rows = groups.map((g: any) => ({
    day: g.dimensions.date,
    pageviews: Math.round(g.count ?? 0),
    visits: Math.round(g.sum?.visits ?? 0),
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await admin.from("site_daily_visits").upsert(rows, { onConflict: "day" });
    if (error) return json({ error: error.message }, 500);
  }
  return json({ ok: true, days: rows.length, last: rows[rows.length - 1] ?? null });
});
