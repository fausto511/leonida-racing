// discord-dispatch -- posts and maintains Leonida Racing event cards in
// subscribed Discord channels (RS-0067 package 3, DEC-0098).
//
// Called every minute by pg_cron (job "discord-dispatch") via pg_net, but
// only when public.discord_outbox has pending rows. Auth: secret job token
// (private.job_tokens, checked with rpc check_job_token) -> verify_jwt off.
//
// Outbox rows:
//   kind 'event'    -- an event (or its RSVPs) changed: sync every feed that
//                      should show it, and clean up feeds that no longer should.
//   kind 'backfill' -- a feed was added / changed: sync its upcoming events.
// sync() is idempotent: post if missing, edit if present, delete if the
// event is no longer visible (unpublished, deleted, no longer matching).
// Cancelled events keep their card, marked "Cancelled", without buttons;
// the native Discord event (server Events list) is deleted.
//
// Test events (hub_events.is_test) only reach guilds listed in
// discord_bot_state 'test_guild_ids' (comma separated).
//
// COPY STATUS: all user-facing texts are Claude placeholders, Codex review pending.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_ID = "1552506662533861376";
const SITE = "https://leonidaracing.com";
const INVITE = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=17600775998464&integration_type=0`;
const YELLOW = 0xffd74c, GREY = 0x5c5c6e;
const TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const EVENT_TYPES: Record<string, string> = { race: "Race", "time-attack": "Time Attack", league: "League", "car-meet": "Car Meet", cruise: "Cruise", other: "Other" };
const PLATFORMS: Record<string, string> = { ps5: "PS5", xbox: "Xbox Series X|S" };
// One image for all types until Fausto delivers one per type (same as site/src/data/hub.ts).
const EVENT_IMAGE: Record<string, string> = { race: "hub-events", "time-attack": "hub-events", league: "hub-events", "car-meet": "hub-events", cruise: "hub-events", other: "hub-events" };
const DEFAULT_DURATION_MS = 2 * 3600e3;
const TIME_BUDGET_MS = 40_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const linkButton = (label: string, url: string) => ({ type: 2, style: 5, label, url });
const row = (...b: unknown[]) => ({ type: 1, components: b });
const eventUrl = (e: any) => `${SITE}/hub/events/#event-${e.event_id}`;
const endOf = (e: any) => (e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + DEFAULT_DURATION_MS));
const hostLabel = (e: any) => e.host?.name ? `${e.host.name}${e.host.tag ? ` [${e.host.tag}]` : ""}` : (e.host_name ?? "Community host");
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

type DResult = { ok: boolean; status: number; data: any; text: string };
async function discord(method: string, path: string, body?: unknown): Promise<DResult> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      method, headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (r.status === 429) { await sleep(Math.min(10, Number(data?.retry_after ?? 1)) * 1000 + 100); continue; }
    return { ok: r.ok, status: r.status, data, text };
  }
  return { ok: false, status: 429, data: null, text: "rate limited" };
}

// ---------- data ----------
const EVENT_COLS = "event_id,title,event_type,starts_at,ends_at,platforms,host_name,host_crew_id,created_by,status,is_published,is_test,max_participants,registration,discord_url,description,host:crews(name,tag,discord_url)";
async function loadEvent(id: string) {
  const { data } = await db.from("hub_events").select(EVENT_COLS).eq("event_id", id).maybeSingle();
  return data as any | null;
}
async function goingCount(id: string) {
  const { count } = await db.from("hub_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", id);
  return count ?? 0;
}
let testGuildsCache: Set<string> | null = null;
async function testGuilds() {
  if (testGuildsCache) return testGuildsCache;
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "test_guild_ids").maybeSingle();
  testGuildsCache = new Set(String(data?.value ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return testGuildsCache;
}
function feedMatches(f: any, e: any) {
  if (f.platforms?.length && !f.platforms.some((p: string) => (e.platforms ?? []).includes(p))) return false;
  if (f.event_types?.length && !f.event_types.includes(e.event_type)) return false;
  if (f.source === "public") return true;
  if (f.source === "crew") return !!e.host_crew_id && e.host_crew_id === f.crew_id;
  if (f.source === "host") return !!e.created_by && e.created_by === f.host_driver_id;
  return false;
}
async function wants(f: any, e: any | null) {
  if (!e || !e.is_published) return false;
  if (e.is_test && !(await testGuilds()).has(f.guild_id)) return false;
  return feedMatches(f, e);
}
async function feedError(f: any, msg: string | null) {
  if ((f.last_error ?? null) === msg) return;
  await db.from("discord_feeds").update({ last_error: msg, last_error_at: msg ? new Date().toISOString() : null }).eq("feed_id", f.feed_id);
  f.last_error = msg;
}
const describeFail = (r: DResult, what: string) =>
  r.status === 403 ? `Missing permission to ${what} (check View Channel, Send Messages, Embed Links${what.includes("event") ? ", Create Events, Manage Events" : ""}).`
  : r.status === 404 ? `Channel or server not found (was it deleted, or was the bot removed?).`
  : `Discord error ${r.status} while trying to ${what}.`;

// ---------- card ----------
function card(e: any, going: number) {
  const cancelled = e.status === "cancelled";
  const hostDiscord = e.discord_url ?? e.host?.discord_url ?? null;
  const fields = [
    { name: "Starts", value: `<t:${unix(e.starts_at)}:F>\n<t:${unix(e.starts_at)}:R>`, inline: true },
    { name: "Type", value: EVENT_TYPES[e.event_type] ?? e.event_type, inline: true },
    { name: "Platform", value: (e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p).join(", ") || "—", inline: true },
    { name: "Host", value: hostLabel(e), inline: true },
    { name: "Going", value: e.max_participants ? `${going} / ${e.max_participants}` : String(going), inline: true },
  ];
  if (!cancelled && e.registration === "closed") fields.push({ name: "Sign-ups", value: "Closed", inline: true });
  const embed: Record<string, unknown> = {
    title: clip(cancelled ? `Cancelled: ${e.title}` : e.title, 256), url: eventUrl(e),
    color: cancelled ? GREY : YELLOW, fields,
    footer: { text: "Leonida Racing · times shown in your time zone" },
  };
  if (cancelled) embed.description = "This event has been cancelled.";
  else if (e.description) embed.description = clip(String(e.description), 300);
  if (!cancelled) embed.image = { url: `${SITE}/images/hub/${EVENT_IMAGE[e.event_type] ?? "hub-events"}-1672.jpg` };
  const buttons = [linkButton("Details", eventUrl(e))];
  if (!cancelled && hostDiscord) buttons.push(linkButton("Host Discord", hostDiscord));
  if (!cancelled) buttons.push(linkButton("Add to your server", INVITE));
  return { embeds: [embed], components: [row(...buttons)], allowed_mentions: { parse: [] } };
}
function nativeEvent(e: any) {
  const lines = [
    `${EVENT_TYPES[e.event_type] ?? e.event_type} · ${(e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p).join(", ")}`,
    `Host: ${hostLabel(e)}`,
    eventUrl(e),
  ];
  return {
    name: clip(e.title, 100), privacy_level: 2, entity_type: 3,
    entity_metadata: { location: clip(eventUrl(e), 100) },
    scheduled_start_time: new Date(e.starts_at).toISOString(),
    scheduled_end_time: endOf(e).toISOString(),
    description: clip(lines.join("\n"), 1000),
  };
}

// ---------- sync one feed x one event ----------
async function sync(f: any, eventId: string, e: any | null, going: number, depth = 0): Promise<void> {
  const { data: ref } = await db.from("discord_messages").select("*").eq("feed_id", f.feed_id).eq("event_id", eventId).maybeSingle();
  const want = await wants(f, e);
  const now = Date.now();

  if (!want) {
    if (!ref) return;
    if (ref.message_id) await discord("DELETE", `/channels/${ref.channel_id}/messages/${ref.message_id}`);
    if (ref.scheduled_event_id) await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${ref.scheduled_event_id}`);
    await db.from("discord_messages").delete().eq("feed_id", f.feed_id).eq("event_id", eventId);
    return;
  }
  const cancelled = e.status === "cancelled";
  const future = new Date(e.starts_at).getTime() > now + 60_000;

  if (!ref) {
    if (cancelled || endOf(e).getTime() < now) return; // never post cancelled or past events
    // claim the slot first so parallel runs can't double-post
    const { data: claimed } = await db.from("discord_messages")
      .upsert({ feed_id: f.feed_id, event_id: eventId, channel_id: f.channel_id }, { onConflict: "feed_id,event_id", ignoreDuplicates: true })
      .select("feed_id");
    if (!claimed?.length) return;
    const r = await discord("POST", `/channels/${f.channel_id}/messages`, card(e, going));
    if (!r.ok) {
      await db.from("discord_messages").delete().eq("feed_id", f.feed_id).eq("event_id", eventId);
      await feedError(f, describeFail(r, "post in the channel"));
      console.log("post failed", f.feed_id, r.status, r.text.slice(0, 300));
      return;
    }
    const patch: Record<string, unknown> = { message_id: r.data.id, updated_at: new Date().toISOString() };
    if (f.native_events && future) {
      const s = await discord("POST", `/guilds/${f.guild_id}/scheduled-events`, nativeEvent(e));
      if (s.ok) patch.scheduled_event_id = s.data.id;
      else { await feedError(f, describeFail(s, "create server events")); console.log("event create failed", s.status, s.text.slice(0, 300)); }
    }
    await db.from("discord_messages").update(patch).eq("feed_id", f.feed_id).eq("event_id", eventId);
    if (patch.scheduled_event_id || !f.native_events || !future) await feedError(f, null);
    return;
  }

  if (!ref.message_id) return; // another run is posting it right now
  const r = await discord("PATCH", `/channels/${ref.channel_id}/messages/${ref.message_id}`, card(e, going));
  if (r.status === 404 && depth === 0) { // message deleted by a server admin -> forget it and repost once
    if (ref.scheduled_event_id) await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${ref.scheduled_event_id}`);
    await db.from("discord_messages").delete().eq("feed_id", f.feed_id).eq("event_id", eventId);
    return sync(f, eventId, e, going, 1);
  }
  if (!r.ok) { await feedError(f, describeFail(r, "edit messages in the channel")); console.log("edit failed", r.status, r.text.slice(0, 300)); }

  let sched: string | null = ref.scheduled_event_id;
  if (sched && (cancelled || !f.native_events)) {
    await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${sched}`);
    sched = null;
  } else if (!cancelled && f.native_events && future) {
    if (sched) {
      const s = await discord("PATCH", `/guilds/${f.guild_id}/scheduled-events/${sched}`, nativeEvent(e));
      if (s.status === 404) sched = null;
    }
    if (!sched) {
      const s = await discord("POST", `/guilds/${f.guild_id}/scheduled-events`, nativeEvent(e));
      if (s.ok) sched = s.data.id;
      else { await feedError(f, describeFail(s, "create server events")); console.log("event create failed", s.status, s.text.slice(0, 300)); }
    }
  }
  await db.from("discord_messages").update({ scheduled_event_id: sched, state: cancelled ? "cancelled" : "live", updated_at: new Date().toISOString() })
    .eq("feed_id", f.feed_id).eq("event_id", eventId);
  if (r.ok && (sched || !f.native_events || !future || cancelled)) await feedError(f, null);
}

// ---------- outbox handlers ----------
async function handleEvent(eventId: string) {
  const e = await loadEvent(eventId);
  const going = e ? await goingCount(eventId) : 0;
  const feeds = new Map<string, any>();
  if (e) {
    const ors = ["source.eq.public"];
    if (e.host_crew_id) ors.push(`crew_id.eq.${e.host_crew_id}`);
    if (e.created_by) ors.push(`host_driver_id.eq.${e.created_by}`);
    const { data } = await db.from("discord_feeds").select("*").or(ors.join(","));
    for (const f of data ?? []) feeds.set(f.feed_id, f);
  }
  const { data: refs } = await db.from("discord_messages").select("feed_id").eq("event_id", eventId);
  const missing = (refs ?? []).map((r: any) => r.feed_id).filter((id: string) => !feeds.has(id));
  if (missing.length) {
    const { data } = await db.from("discord_feeds").select("*").in("feed_id", missing);
    for (const f of data ?? []) feeds.set(f.feed_id, f);
  }
  for (const f of feeds.values()) await sync(f, eventId, e, going);
}

async function handleBackfill(feedId: string) {
  const { data: f } = await db.from("discord_feeds").select("*").eq("feed_id", feedId).maybeSingle();
  if (!f) return;
  const { data: upcoming } = await db.from("hub_events").select(EVENT_COLS).eq("is_published", true).neq("status", "cancelled")
    .gte("starts_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("starts_at").limit(25);
  const { data: refs } = await db.from("discord_messages").select("event_id").eq("feed_id", feedId);
  const ids = new Set<string>([...(upcoming ?? []).map((e: any) => e.event_id), ...(refs ?? []).map((r: any) => r.event_id)]);
  const byId = new Map((upcoming ?? []).map((e: any) => [e.event_id, e]));
  for (const id of ids) {
    const e = byId.get(id) ?? await loadEvent(id);
    await sync(f, id, e, e ? await goingCount(id) : 0);
  }
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { data: ok } = await db.rpc("check_job_token", { p_name: "discord-dispatch", p_token: req.headers.get("x-job-token") ?? "" });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  if (!TOKEN) return json({ error: "DISCORD_BOT_TOKEN missing" }, 500);

  const started = Date.now();
  let done = 0, failed = 0;
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: rows, error } = await db.rpc("discord_claim_outbox", { p_limit: 10 });
    if (error) { console.error(error); break; }
    if (!rows?.length) break;
    for (const r of rows as any[]) {
      try {
        if (r.kind === "event") await handleEvent(r.event_id);
        else if (r.kind === "backfill") await handleBackfill(r.feed_id);
        done++;
      } catch (err) {
        failed++;
        console.error("outbox", r.id, err);
        if (r.attempts < 5) {
          await db.from("discord_outbox").update({ processed_at: null, not_before: new Date(Date.now() + r.attempts * 120_000).toISOString(), last_error: String(err).slice(0, 500) }).eq("id", r.id);
        } else {
          await db.from("discord_outbox").update({ last_error: String(err).slice(0, 500) }).eq("id", r.id);
        }
      }
    }
  }
  // housekeeping: processed rows older than 7 days
  await db.from("discord_outbox").delete().lt("processed_at", new Date(Date.now() - 7 * 864e5).toISOString());
  return json({ done, failed, ms: Date.now() - started });
});
