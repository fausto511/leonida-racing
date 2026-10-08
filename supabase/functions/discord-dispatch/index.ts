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
// Server admins may edit our server events in Discord: location / voice channel
// and cover image are kept; title, time and description follow the website.
// If they delete one, it is not recreated (REMOVED).
//
// Test events (hub_events.is_test) only reach guilds listed in
// discord_bot_state 'test_guild_ids' (comma separated).
//
// Package 4: cards carry I'm in / Withdraw buttons (custom_id rsvp:in|out:<event_id>).
//
// Gone servers/channels (privacy, 06.10.2026): if Discord reports the channel
// as deleted (10003) the feed is removed; if the bot is no longer in the server
// (GET /guilds -> 10004 / 50001) all feeds of that server are removed. A plain
// missing permission keeps the feed and only sets last_error. The same check
// runs once a day for every feed (body {"housekeeping": true}, cron job
// "discord-housekeeping"), so feeds without new events are cleaned up too.
//
// New vehicles (DEC-0106, 06.10.2026): outbox kind 'vehicle' (trigger on vehicles
// when release_id gets set). Waits until the vehicle page is live on the website
// (rebuild every 3 h), then posts to every feed with source 'vehicles': one card
// per vehicle, or one summary when VEHICLE_DIGEST_FROM or more are ready at once.
// Role sync (08.10.2026): see "Discord role sync" below.
// COPY STATUS: all user-facing texts are Claude placeholders, Codex review pending.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_ID = "1552506662533861376";
const SITE = "https://leonidaracing.com";
const INVITE = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=17600777047040&integration_type=0`;
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
// The host is always a person (Fausto 2026-10-04): PSN name, else the creator's
// site name. A crew can organise an event but can't host the lobby -> shown as a tag.
const hostPerson = (e: any) => e.host_name ?? (e.creator && !e.creator.deleted_at ? e.creator.display_name : null) ?? "Community host";
// Crew shown GTA-style as a tag behind the host name, e.g. "Fausto-511 [LR]".
const crewTag = (e: any) => e.host?.tag ? `[${e.host.tag}]` : e.host?.name ? `[${e.host.name}]` : "";
const withTag = (e: any, name: string) => crewTag(e) ? `${name} ${crewTag(e)}` : name;
const typeLine = (e: any) => [EVENT_TYPES[e.event_type] ?? e.event_type, ...(e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p)].join(" \u00b7 ");
const goingValue = (e: any, going: number, closed: boolean) => (e.max_participants ? `${going} / ${e.max_participants}` : String(going)) + (closed ? "\nSign-ups closed" : "");
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
const EVENT_COLS = "event_id,title,event_type,starts_at,ends_at,platforms,host_name,host_crew_id,created_by,status,is_published,is_test,max_participants,registration,discord_url,description,host:crews(name,tag,discord_url),creator:drivers!hub_events_created_by_fkey(display_name,deleted_at)";
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

// ---------- gone servers / channels ----------
const UNKNOWN_CHANNEL = 10003, UNKNOWN_GUILD = 10004, MISSING_ACCESS = 50001;
async function botLeftGuild(guildId: string): Promise<boolean> {
  const g = await discord("GET", `/guilds/${guildId}`);
  return !g.ok && (g.status === 403 || g.status === 404) && [UNKNOWN_GUILD, MISSING_ACCESS].includes(g.data?.code);
}
async function dropGuild(guildId: string) {
  console.log("bot no longer in server, removing its feeds", guildId);
  await db.from("discord_feeds").delete().eq("guild_id", guildId); // messages + outbox rows cascade
}
async function dropFeed(f: any) {
  console.log("channel gone, removing feed", f.feed_id);
  const { data: refs } = await db.from("discord_messages").select("scheduled_event_id").eq("feed_id", f.feed_id);
  for (const r of refs ?? []) {
    if (r.scheduled_event_id && r.scheduled_event_id !== REMOVED) await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${r.scheduled_event_id}`);
  }
  await db.from("discord_feeds").delete().eq("feed_id", f.feed_id);
}
// true = the feed (or its whole server) was removed, caller stops.
async function handleGone(f: any, r: DResult): Promise<boolean> {
  if (r.status === 404 && r.data?.code === UNKNOWN_CHANNEL) { await dropFeed(f); return true; }
  if (r.status === 403 || (r.status === 404 && r.data?.code === UNKNOWN_GUILD)) {
    if (await botLeftGuild(f.guild_id)) { await dropGuild(f.guild_id); return true; }
  }
  return false;
}
async function housekeeping() {
  const { data: feeds } = await db.from("discord_feeds").select("feed_id,guild_id,channel_id");
  const byGuild = new Map<string, any[]>();
  for (const f of feeds ?? []) byGuild.set(f.guild_id, [...(byGuild.get(f.guild_id) ?? []), f]);
  let guildsRemoved = 0, feedsRemoved = 0;
  for (const [guildId, list] of byGuild) {
    if (await botLeftGuild(guildId)) { await dropGuild(guildId); guildsRemoved++; feedsRemoved += list.length; continue; }
    for (const f of list) {
      const c = await discord("GET", `/channels/${f.channel_id}`);
      if (c.status === 404 && c.data?.code === UNKNOWN_CHANNEL) { await dropFeed(f); feedsRemoved++; }
    }
  }
  return { guilds: byGuild.size, guildsRemoved, feedsRemoved };
}

// ---------- new vehicles (DEC-0106) ----------
const VEHICLE_COLS = "vehicle_id,make,model,classes,drive,seats,real_life_inspiration,first_seen_in,has_photo,release_id";
const VEHICLE_DIGEST_FROM = 4;          // 4+ vehicles ready at once -> one summary post
const VEHICLE_WAIT_MAX_ATTEMPTS = 96;   // re-check every 30 min, give up after ~48 h
const vehicleUrl = (v: any) => `${SITE}/garage/vehicles/${v.vehicle_id}/`;
const vehicleImg = (v: any) => `${SITE}/images/vehicles/${v.vehicle_id}-1280.webp`;
async function live(url: string) { try { const r = await fetch(url, { method: "HEAD" }); return r.ok; } catch { return false; } }
function vehicleCard(v: any) {
  const url = vehicleUrl(v);
  const fields = [
    { name: "Class", value: (v.classes ?? []).join(", ") || "\u2014", inline: true },
    { name: "Drivetrain", value: v.drive || "\u2014", inline: true },
    { name: "Seats", value: v.seats ? String(v.seats) : "\u2014", inline: true },
  ];
  if (v.real_life_inspiration) fields.push({ name: "Real-life inspiration", value: v.real_life_inspiration, inline: false });
  if (v.first_seen_in) fields.push({ name: "First seen in", value: v.first_seen_in, inline: false });
  return {
    embeds: [{ author: { name: "New in The Garage" }, title: `${v.make} ${v.model}`, url, color: YELLOW, fields,
      ...(v._photo ? { image: { url: vehicleImg(v) } } : {}), footer: { text: "Leonida Racing \u00b7 The Garage" } }],
    components: [row(linkButton("Open in The Garage", url), linkButton("Add to your server", INVITE))],
    allowed_mentions: { parse: [] },
  };
}
function vehicleDigest(vs: any[]) {
  const shown = vs.slice(0, 15);
  const lines = shown.map((v) => `\u2022 [${v.make} ${v.model}](${vehicleUrl(v)})${(v.classes ?? []).length ? ` \u00b7 ${v.classes.join(", ")}` : ""}`);
  if (vs.length > shown.length) lines.push(`\u2026and ${vs.length - shown.length} more`);
  const pic = vs.find((v) => v._photo);
  return {
    embeds: [{ author: { name: "New in The Garage" }, title: `${vs.length} new vehicles`, url: `${SITE}/garage/`, color: YELLOW,
      description: clip(lines.join("\n"), 4000), ...(pic ? { image: { url: vehicleImg(pic) } } : {}), footer: { text: "Leonida Racing \u00b7 The Garage" } }],
    components: [row(linkButton("Open The Garage", `${SITE}/garage/`), linkButton("Add to your server", INVITE))],
    allowed_mentions: { parse: [] },
  };
}
async function handleVehicles(): Promise<number> {
  const { data: rows, error } = await db.rpc("discord_claim_vehicles");
  if (error) { console.error(error); return 0; }
  if (!rows?.length) return 0;
  const ids = [...new Set((rows as any[]).map((r) => r.vehicle_id))];
  const { data: vs } = await db.from("vehicles").select(VEHICLE_COLS).in("vehicle_id", ids).not("release_id", "is", null);
  const byId = new Map((vs ?? []).map((v: any) => [v.vehicle_id, v]));
  const ready: any[] = [];
  for (const r of rows as any[]) {
    const v = byId.get(r.vehicle_id);
    if (!v) continue; // deleted or no longer officially shown -> not posted
    if (await live(vehicleUrl(v))) { if (!ready.includes(v)) ready.push(v); continue; }
    if (r.attempts < VEHICLE_WAIT_MAX_ATTEMPTS) {
      await db.from("discord_outbox").update({ processed_at: null, not_before: new Date(Date.now() + 30 * 60e3).toISOString(), last_error: "vehicle page not live yet" }).eq("id", r.id);
    } else {
      await db.from("discord_outbox").update({ last_error: "vehicle page never went live, not posted" }).eq("id", r.id);
    }
  }
  if (!ready.length) return 0;
  ready.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  for (const v of ready) v._photo = !!v.has_photo && await live(vehicleImg(v));
  const msgs = ready.length >= VEHICLE_DIGEST_FROM ? [vehicleDigest(ready)] : ready.map(vehicleCard);
  const { data: feeds } = await db.from("discord_feeds").select("*").eq("source", "vehicles");
  for (const f of feeds ?? []) {
    let ok = true;
    for (const m of msgs) {
      const r = await discord("POST", `/channels/${f.channel_id}/messages`, m);
      if (!r.ok) {
        ok = false;
        if (!(await handleGone(f, r))) { await feedError(f, describeFail(r, "post in the channel")); console.log("vehicle post failed", f.feed_id, r.status, r.text.slice(0, 300)); }
        break;
      }
    }
    if (ok) await feedError(f, null);
  }
  console.log("vehicles posted", ready.length, "to", (feeds ?? []).length, "feeds");
  return ready.length;
}

// ---------- card ----------
function card(e: any, going: number) {
  const cancelled = e.status === "cancelled";
  const hostDiscord = e.discord_url ?? e.host?.discord_url ?? null;
  // Host PSN name links to the PSN profile (friend request from the PlayStation app / browser).
  const psnLink = !cancelled && e.host_name ? `[${e.host_name}](https://profile.playstation.com/${encodeURIComponent(e.host_name)})` : null;
  // Compact on purpose: Discord mobile stacks every field, so type/platform go
  // into the author line and the crew tag behind the host name.
  const fields = [
    { name: "Starts", value: `<t:${unix(e.starts_at)}:F>\n<t:${unix(e.starts_at)}:R>`, inline: true },
    { name: "Host", value: withTag(e, psnLink ?? hostPerson(e)), inline: true },
    { name: "Going", value: goingValue(e, going, !cancelled && e.registration === "closed"), inline: true },
  ];
  const embed: Record<string, unknown> = {
    author: { name: typeLine(e) }, title: clip(cancelled ? `Cancelled: ${e.title}` : e.title, 256), url: eventUrl(e),
    color: cancelled ? GREY : YELLOW, fields,
    footer: { text: "Leonida Racing · times shown in your time zone" },
  };
  if (cancelled) embed.description = "This event has been cancelled.";
  else if (e.description) embed.description = clip(String(e.description), 300);
  if (!cancelled) embed.image = { url: `${SITE}/images/hub/${EVENT_IMAGE[e.event_type] ?? "hub-events"}-1672.jpg` };
  // Package 4: I'm in / Withdraw (handled by discord-interactions, rpc discord_rsvp).
  const full = !!e.max_participants && going >= e.max_participants;
  const buttons: Record<string, unknown>[] = [];
  if (!cancelled) {
    buttons.push({ type: 2, style: 3, label: full ? "Full" : e.registration === "closed" ? "Sign-ups closed" : "I'm in", custom_id: `rsvp:in:${e.event_id}`, disabled: full || e.registration === "closed" });
    buttons.push({ type: 2, style: 2, label: "Withdraw", custom_id: `rsvp:out:${e.event_id}` });
  }
  buttons.push(linkButton("Details", eventUrl(e)));
  if (!cancelled && hostDiscord) buttons.push(linkButton("Host Discord", hostDiscord));
  if (!cancelled) buttons.push(linkButton("Add to your server", INVITE));
  return { embeds: [embed], components: [row(...buttons)], allowed_mentions: { parse: [] } };
}
// Cover image for server events: Discord wants a data URI (shown cropped to
// about 2.5:1). Fetched once per type per function instance from the website.
const coverCache = new Map<string, string | null>();
async function coverImage(type: string): Promise<string | null> {
  const name = EVENT_IMAGE[type] ?? "hub-events";
  if (coverCache.has(name)) return coverCache.get(name)!;
  let uri: string | null = null;
  try {
    const r = await fetch(`${SITE}/images/hub/${name}-1672.jpg`);
    if (r.ok) {
      const bytes = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      uri = `data:image/jpeg;base64,${btoa(bin)}`;
    } else console.log("cover fetch", r.status);
  } catch (err) { console.log("cover fetch failed", String(err)); }
  coverCache.set(name, uri);
  return uri;
}
async function nativeEvent(e: any, withImage: boolean) {
  const platforms = (e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p).join(", ");
  const facts = [`${EVENT_TYPES[e.event_type] ?? e.event_type} \u00b7 ${platforms}`, `Host: ${withTag(e, hostPerson(e))}`];
  const tail = `\n\n${facts.join("\n")}\n${eventUrl(e)}`;
  const desc = e.description ? clip(String(e.description), 1000 - tail.length) + tail : tail.trimStart();
  const body: Record<string, unknown> = {
    name: clip(e.title, 100), privacy_level: 2, entity_type: 3,
    entity_metadata: { location: clip(`Leonida Racing \u00b7 ${platforms || "GTA VI"}`, 100) },
    scheduled_start_time: new Date(e.starts_at).toISOString(),
    scheduled_end_time: endOf(e).toISOString(),
    description: desc,
  };
  if (withImage) { const img = await coverImage(e.event_type); if (img) body.image = img; }
  return body;
}

// Updates only touch what the website owns (title, time, description). Location /
// voice channel, privacy and cover image stay as the server admin set them.
async function nativeEventPatch(e: any) {
  const { name, scheduled_start_time, scheduled_end_time, description } = await nativeEvent(e, false) as any;
  return { name, scheduled_start_time, scheduled_end_time, description };
}
// scheduled_event_id = REMOVED: a server admin deleted our server event by hand ->
// respect that and never recreate it for this feed + event.
const REMOVED = "removed";

async function createServerEvent(f: any, e: any): Promise<DResult> {
  const s = await discord("POST", `/guilds/${f.guild_id}/scheduled-events`, await nativeEvent(e, true));
  if (s.status === 400) { // e.g. image rejected -> try once without it
    console.log("event create 400, retry without image", s.text.slice(0, 300));
    return discord("POST", `/guilds/${f.guild_id}/scheduled-events`, await nativeEvent(e, false));
  }
  return s;
}

// ---------- sync one feed x one event ----------
async function sync(f: any, eventId: string, e: any | null, going: number, depth = 0): Promise<void> {
  const { data: ref } = await db.from("discord_messages").select("*").eq("feed_id", f.feed_id).eq("event_id", eventId).maybeSingle();
  const want = await wants(f, e);
  const now = Date.now();

  if (!want) {
    if (!ref) return;
    if (ref.message_id) await discord("DELETE", `/channels/${ref.channel_id}/messages/${ref.message_id}`);
    if (ref.scheduled_event_id && ref.scheduled_event_id !== REMOVED) await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${ref.scheduled_event_id}`);
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
      if (await handleGone(f, r)) return;
      await feedError(f, describeFail(r, "post in the channel"));
      console.log("post failed", f.feed_id, r.status, r.text.slice(0, 300));
      return;
    }
    const patch: Record<string, unknown> = { message_id: r.data.id, updated_at: new Date().toISOString() };
    if (f.native_events && future) {
      const s = await createServerEvent(f, e);
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
    if (ref.scheduled_event_id && ref.scheduled_event_id !== REMOVED) await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${ref.scheduled_event_id}`);
    await db.from("discord_messages").delete().eq("feed_id", f.feed_id).eq("event_id", eventId);
    return sync(f, eventId, e, going, 1);
  }
  if (!r.ok && await handleGone(f, r)) return;
  if (!r.ok) { await feedError(f, describeFail(r, "edit messages in the channel")); console.log("edit failed", r.status, r.text.slice(0, 300)); }

  let sched: string | null = ref.scheduled_event_id;
  if (sched === REMOVED) {
    if (!f.native_events) sched = null; // option switched off -> forget the opt-out
  } else if (sched && (cancelled || !f.native_events)) {
    await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${sched}`);
    sched = null;
  } else if (!cancelled && f.native_events && future) {
    if (sched) {
      const s = await discord("PATCH", `/guilds/${f.guild_id}/scheduled-events/${sched}`, await nativeEventPatch(e));
      if (s.status === 404) sched = REMOVED; // deleted in Discord by an admin
      else if (!s.ok) {
        console.log("event update failed", s.status, s.text.slice(0, 300));
        await feedError(f, s.status === 403
          ? "Can't update a server event: if it was moved to a voice channel, give Leonida Racing View Channel and Connect there."
          : describeFail(s, "update server events"));
        await db.from("discord_messages").update({ updated_at: new Date().toISOString() }).eq("feed_id", f.feed_id).eq("event_id", eventId);
        return;
      }
    }
    if (!sched) {
      const s = await createServerEvent(f, e);
      if (s.ok) sched = s.data.id;
      else { await feedError(f, describeFail(s, "create server events")); console.log("event create failed", s.status, s.text.slice(0, 300)); }
    }
  }
  await db.from("discord_messages").update({ scheduled_event_id: sched, state: cancelled ? "cancelled" : "live", updated_at: new Date().toISOString() })
    .eq("feed_id", f.feed_id).eq("event_id", eventId);
  if (r.ok && (sched || !f.native_events || !future || cancelled)) await feedError(f, null); // REMOVED counts as fine
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
  if (!f || f.source === "vehicles") return; // vehicle feeds only get vehicles added from now on
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

// ---------- Discord role sync (website -> official server, Fausto 07./08.10.2026) ----------
// "Registered Driver" for every account, plus Crew Leader / Event Host / Creator from
// hub_roles. One-way: Discord changes never reach the website. A role the bot granted
// that is now missing was removed by a Discord admin -> it stays off (suppressed) until
// that role changes on the website (job.reset_role). Roles given by hand on Discord
// are never removed by the bot. Jobs: table discord_role_jobs (DB triggers + daily
// discord_role_reconcile()). Server: secret DISCORD_GUILD_ID (same as join-discord-guild).
const ROLE_GUILD = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const ROLE_NAMES: Record<string, string> = { member: "Registered Driver", crew_leader: "Crew Leader", event_host: "Event Host", creator: "Creator" };
const UNKNOWN_MEMBER = 10007;
let roleIdsCache: Record<string, string> | null = null;
async function roleStatus(msg: string | null) {
  await db.from("discord_bot_state").upsert({ key: "role_sync_status", value: msg ?? "ok", updated_at: new Date().toISOString() });
}
// Role ids are looked up by name once and stored in discord_bot_state 'role_ids',
// so renaming a role on Discord later doesn't break anything.
async function roleIds(): Promise<Record<string, string>> {
  if (roleIdsCache && Object.keys(ROLE_NAMES).every((k) => roleIdsCache![k])) return roleIdsCache;
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "role_ids").maybeSingle();
  let ids: Record<string, string> = {};
  try { ids = JSON.parse(data?.value ?? "{}"); } catch { /* start fresh */ }
  if (Object.keys(ROLE_NAMES).some((k) => !ids[k])) {
    const r = await discord("GET", `/guilds/${ROLE_GUILD}/roles`);
    if (!r.ok) throw new Error(`role list failed: ${r.status} ${r.text.slice(0, 200)}`);
    for (const [k, name] of Object.entries(ROLE_NAMES)) {
      if (ids[k]) continue;
      const hit = (r.data as any[]).filter((x) => String(x.name).trim().toLowerCase() === name.toLowerCase());
      if (hit.length === 1) ids[k] = hit[0].id;
    }
    await db.from("discord_bot_state").upsert({ key: "role_ids", value: JSON.stringify(ids), updated_at: new Date().toISOString() });
  }
  roleIdsCache = ids;
  return ids;
}
async function wantedRoles(discordId: string): Promise<Set<string>> {
  const want = new Set<string>();
  const { data: d } = await db.from("drivers").select("driver_id").eq("discord_user_id", discordId).is("deleted_at", null).maybeSingle();
  if (!d) return want; // no account (or deleted) -> none of our roles
  want.add("member");
  const { data: rs } = await db.from("hub_roles").select("role").eq("driver_id", d.driver_id);
  for (const r of rs ?? []) if (ROLE_NAMES[r.role]) want.add(r.role);
  return want;
}
async function syncRoles(job: any): Promise<"done" | "retry"> {
  const ids = await roleIds();
  const uid = job.discord_user_id;
  const m = await discord("GET", `/guilds/${ROLE_GUILD}/members/${uid}`);
  if (m.status === 404 && m.data?.code === UNKNOWN_MEMBER) {
    // Not on the server. Leaving drops all roles, so forget what we granted (but keep
    // admin removals). Fresh accounts join right after login -> look again shortly.
    await db.from("discord_role_state").delete().eq("discord_user_id", uid).eq("suppressed", false);
    return job.attempts < 3 && Date.now() - new Date(job.created_at).getTime() < 3600e3 ? "retry" : "done";
  }
  if (!m.ok) throw new Error(`member lookup failed: ${m.status} ${m.text.slice(0, 200)}`);
  const has = new Set<string>(m.data?.roles ?? []);
  const want = await wantedRoles(uid);
  const { data: st } = await db.from("discord_role_state").select("*").eq("discord_user_id", uid);
  const state = new Map((st ?? []).map((x: any) => [x.role_key, x]));
  const problems: string[] = [];
  for (const key of Object.keys(ROLE_NAMES)) {
    const rid = ids[key];
    if (!rid) { if (want.has(key)) problems.push(`role "${ROLE_NAMES[key]}" not found on the server`); continue; }
    const s: any = state.get(key);
    if (want.has(key)) {
      if (has.has(rid)) {
        if (!s || s.suppressed) await db.from("discord_role_state").upsert({ discord_user_id: uid, role_key: key, suppressed: false });
      } else if (s && job.reset_role !== key) {
        // we gave it before and it's gone -> a Discord admin removed it: leave it off
        if (!s.suppressed) await db.from("discord_role_state").update({ suppressed: true }).eq("discord_user_id", uid).eq("role_key", key);
      } else {
        const r = await discord("PUT", `/guilds/${ROLE_GUILD}/members/${uid}/roles/${rid}`);
        if (r.ok) await db.from("discord_role_state").upsert({ discord_user_id: uid, role_key: key, suppressed: false, granted_at: new Date().toISOString() });
        else problems.push(`can't give "${ROLE_NAMES[key]}" (${r.status}${r.status === 403 ? ": needs Manage Roles and the bot role above it" : ""})`);
      }
    } else if (s) {
      if (has.has(rid) && !s.suppressed) {
        const r = await discord("DELETE", `/guilds/${ROLE_GUILD}/members/${uid}/roles/${rid}`);
        if (!r.ok && r.status !== 404) { problems.push(`can't remove "${ROLE_NAMES[key]}" (${r.status})`); continue; }
      }
      await db.from("discord_role_state").delete().eq("discord_user_id", uid).eq("role_key", key);
    }
  }
  await roleStatus(problems.length ? problems.join("; ") : null);
  return "done";
}
async function handleRoleJobs(started: number): Promise<number> {
  if (!ROLE_GUILD) return 0;
  let n = 0;
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: jobs, error } = await db.rpc("discord_claim_role_jobs", { p_limit: 20 });
    if (error) { console.error("role jobs", error.message); break; }
    if (!jobs?.length) break;
    for (const j of jobs as any[]) {
      try {
        if ((await syncRoles(j)) === "retry") {
          await db.from("discord_role_jobs").update({ processed_at: null, not_before: new Date(Date.now() + 10 * 60e3).toISOString(), last_error: "not on the server yet" }).eq("id", j.id);
        }
        n++;
      } catch (err) {
        console.error("role job", j.id, err);
        await roleStatus(String(err).slice(0, 300));
        await db.from("discord_role_jobs").update(j.attempts < 5
          ? { processed_at: null, not_before: new Date(Date.now() + j.attempts * 120_000).toISOString(), last_error: String(err).slice(0, 500) }
          : { last_error: String(err).slice(0, 500) }).eq("id", j.id);
      }
    }
  }
  return n;
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { data: ok } = await db.rpc("check_job_token", { p_name: "discord-dispatch", p_token: req.headers.get("x-job-token") ?? "" });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  if (!TOKEN) return json({ error: "DISCORD_BOT_TOKEN missing" }, 500);
  const body = await req.json().catch(() => ({}));
  if (body?.housekeeping === true) return json(await housekeeping());

  const started = Date.now();
  let done = 0, failed = 0;
  try { done += await handleVehicles(); } catch (err) { failed++; console.error("vehicles", err); }
  try { done += await handleRoleJobs(started); } catch (err) { failed++; console.error("roles", err); }
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
