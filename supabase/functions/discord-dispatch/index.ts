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
// Reminders (package 5, 15.10.2026): see "reminders" below.
// LFG end (DEC-0111, 15.10.2026): see "LFG" below.
// Retention cleanup (17.10.2026): see retention() below, part of the daily housekeeping call.
// Card removal (17.10.2026): a reference is forgotten only after Discord confirmed the delete;
// failed deletes are retried by the daily housekeeping (retryRemovals).
// Mod alerts (DEC-0137, 17.10.2026): rows in discord_mod_alerts (DB triggers on runs, role requests,
// reports, community tracks) are posted, bundled, to the private #mod-alerts channel (found by name).
// Events panel (DEC-0137, 17.10.2026): body {"panel": "events", "channel_id": "..."} posts or updates the
// "Host your own event" panel and pins it. Body {"channels": true} lists the official server's channels.
// Videos & streams (Fausto 28.10.2026): body {"videos": true} (cron job "discord-videos", every 10 min)
// checks the moderators' channel list (video_channels): YouTube via the public channel RSS feed,
// Twitch via the Helix API (secrets TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET; skipped without them).
// New items go to every feed with source 'videos'. The first check of a channel only records
// what is already there (no backlog flood). gta_only: title (or Twitch category) must mention GTA; cars_only: title must also name a car/racing term.
// COPY STATUS: all user-facing texts are Claude placeholders, Codex review pending.
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_ID = "1552506662533861376";
const SITE = "https://leonidaracing.com";
const INVITE = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=17600777047040&integration_type=0`;
// Leonida Racing palette (DEC-0173/0177): orange = our embeds, coral = cancelled, disabled grey = ended
const ORANGE = 0xff955a, CORAL = 0xff8a8a, GREY = 0x55556a;
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
const eventUrl = (e: any) => `${SITE}/community/events/#event-${e.event_id}`;
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
  const removalsRetried = await retryRemovals();
  return { guilds: byGuild.size, guildsRemoved, feedsRemoved, removalsRetried, ...(await retention()) };
}
// Cards/server events whose event is no longer published (or deleted) but whose delete
// failed earlier: run sync() again, which deletes and only then forgets the reference.
async function retryRemovals() {
  const { data: refs } = await db.from("discord_messages").select("feed_id,event_id").limit(2000);
  const ids = [...new Set((refs ?? []).map((r: any) => r.event_id as string))];
  if (!ids.length) return 0;
  const live = new Set<string>();
  for (let n = 0; n < ids.length; n += 200) {
    const { data } = await db.from("hub_events").select("event_id").eq("is_published", true).in("event_id", ids.slice(n, n + 200));
    for (const e of data ?? []) live.add(e.event_id);
  }
  const stale = (refs ?? []).filter((r: any) => !live.has(r.event_id));
  if (!stale.length) return 0;
  const { data: feeds } = await db.from("discord_feeds").select("*").in("feed_id", [...new Set(stale.map((r: any) => r.feed_id as string))]);
  const byId = new Map((feeds ?? []).map((f: any) => [f.feed_id, f]));
  let n = 0;
  for (const r of stale) {
    const f = byId.get(r.feed_id);
    if (!f) continue;
    await sync(f, r.event_id, await loadEvent(r.event_id), 0);
    n++;
  }
  return n;
}
// Retention (privacy review 16.10.2026): processed role-sync jobs after 7 days, /ping cooldown
// stamps one day after the last ping, role-sync state of Discord IDs without an active account
// once no job is pending for them. Runs with the daily housekeeping call.
async function retention() {
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString(), dayAgo = new Date(Date.now() - 864e5).toISOString();
  const { count: jobs } = await db.from("discord_role_jobs").delete({ count: "exact" }).lt("processed_at", weekAgo);
  const { count: pings } = await db.from("discord_bot_state").delete({ count: "exact" }).like("key", "ping_last:%").lt("updated_at", dayAgo);
  const { data: st } = await db.from("discord_role_state").select("discord_user_id");
  const ids: string[] = [...new Set<string>((st ?? []).map((r: any) => String(r.discord_user_id)))];
  let states = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [{ data: act }, { data: pend }] = await Promise.all([
      db.from("drivers").select("discord_user_id").in("discord_user_id", chunk).is("deleted_at", null),
      db.from("discord_role_jobs").select("discord_user_id").in("discord_user_id", chunk).is("processed_at", null),
    ]);
    const keep = new Set([...(act ?? []), ...(pend ?? [])].map((r: any) => String(r.discord_user_id)));
    const gone = chunk.filter((id) => !keep.has(id));
    if (gone.length) { const { count } = await db.from("discord_role_state").delete({ count: "exact" }).in("discord_user_id", gone); states += count ?? 0; }
  }
  const { count: alerts } = await db.from("discord_mod_alerts").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
  // video_items only prevent double posts; RSS shows the last 15 videos, so 90 days is plenty
  const { count: vids } = await db.from("video_items").delete({ count: "exact" }).lt("created_at", new Date(Date.now() - 90 * 864e5).toISOString());
  return { roleJobsRemoved: jobs ?? 0, pingStampsRemoved: pings ?? 0, roleStatesRemoved: states, modAlertsRemoved: alerts ?? 0, videoItemsRemoved: vids ?? 0 };
}

// ---------- new vehicles (DEC-0106) ----------
const VEHICLE_COLS = "vehicle_id,make,model,classes,drive,seats,real_life_inspiration,first_seen_in,has_photo,release_id";
const VEHICLE_DIGEST_FROM = 4;          // 4+ vehicles ready at once -> one summary post
const VEHICLE_WAIT_MAX_ATTEMPTS = 96;   // re-check every 30 min, give up after ~48 h
const vehicleUrl = (v: any) => `${SITE}/cars/vehicles/${v.vehicle_id}/`;
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
    embeds: [{ author: { name: "New in Cars" }, title: `${v.make} ${v.model}`, url, color: ORANGE, fields,
      ...(v._photo ? { image: { url: vehicleImg(v) } } : {}), footer: { text: "Leonida Racing \u00b7 Cars" } }],
    components: [row(linkButton("Open car page", url), linkButton("Add to your server", INVITE))],
    allowed_mentions: { parse: [] },
  };
}
function vehicleDigest(vs: any[]) {
  const shown = vs.slice(0, 15);
  const lines = shown.map((v) => `\u2022 [${v.make} ${v.model}](${vehicleUrl(v)})${(v.classes ?? []).length ? ` \u00b7 ${v.classes.join(", ")}` : ""}`);
  if (vs.length > shown.length) lines.push(`\u2026and ${vs.length - shown.length} more`);
  const pic = vs.find((v) => v._photo);
  return {
    embeds: [{ author: { name: "New in Cars" }, title: `${vs.length} new vehicles`, url: `${SITE}/cars/`, color: ORANGE,
      description: clip(lines.join("\n"), 4000), ...(pic ? { image: { url: vehicleImg(pic) } } : {}), footer: { text: "Leonida Racing \u00b7 Cars" } }],
    components: [row(linkButton("Browse cars", `${SITE}/cars/`), linkButton("Add to your server", INVITE))],
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
    color: cancelled ? CORAL : ORANGE, fields,
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
    // Forget the reference only once Discord confirms the delete (or says it's already gone, 404).
    // On any other failure the row stays and the daily housekeeping retries (retryRemovals).
    if (ref.message_id) {
      const d = await discord("DELETE", `/channels/${ref.channel_id}/messages/${ref.message_id}`);
      if (!d.ok && d.status !== 404) {
        if (await handleGone(f, d)) return;
        await feedError(f, describeFail(d, "delete messages in the channel"));
        console.log("card delete failed, will retry", f.feed_id, eventId, d.status, d.text.slice(0, 300));
        return;
      }
    }
    if (ref.scheduled_event_id && ref.scheduled_event_id !== REMOVED) {
      const d = await discord("DELETE", `/guilds/${f.guild_id}/scheduled-events/${ref.scheduled_event_id}`);
      if (!d.ok && d.status !== 404) {
        // card is gone already; the retry gets a 404 for it and goes on to the server event
        await feedError(f, describeFail(d, "delete server events"));
        console.log("server event delete failed, will retry", f.feed_id, eventId, d.status, d.text.slice(0, 300));
        return;
      }
    }
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
  if (!f || f.source === "vehicles" || f.source === "videos") return; // these only get new items from now on
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
// "Registered Driver" for every account, plus Verified Crew Leader / Verified Event Host /
// Verified Creator from hub_roles (DEC-0129, 15.10.2026: the plain Crew Leader / Event Host /
// Creator roles are self-selected on Discord and no longer managed by the bot). One-way: Discord changes never reach the website. A role the bot granted
// that is now missing was removed by a Discord admin -> it stays off (suppressed) until
// that role changes on the website (job.reset_role). Roles given by hand on Discord
// are never removed by the bot. Jobs: table discord_role_jobs (DB triggers + daily
// discord_role_reconcile()). Server: secret DISCORD_GUILD_ID (same as join-discord-guild).
const ROLE_GUILD = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const ROLE_NAMES: Record<string, string> = { member: "Registered Driver", crew_leader: "Verified Crew Leader", event_host: "Verified Event Host", creator: "Verified Creator" };
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

// ---------- reminders (package 5, 15.10.2026) ----------
// Reply to the event card 24 h / 1 h before the start (feed option "reminders").
// Optional mention of drivers who are in AND are members of that server (privacy:
// attendees are never revealed to servers they are not on). Claimed via rpc
// discord_claim_reminders (marks them sent); reset on failure so the next run retries
// while the reminder window is open. Texts: Claude placeholders, Codex review pending.
const MAX_REMINDER_MENTIONS = 50;
async function attendeesOnServer(eventId: string, guildId: string): Promise<string[]> {
  const { data } = await db.from("hub_event_rsvps").select("driver:drivers(discord_user_id,deleted_at)").eq("event_id", eventId).limit(MAX_REMINDER_MENTIONS);
  const ids = (data ?? []).map((x: any) => x.driver).filter((d: any) => d && !d.deleted_at && d.discord_user_id).map((d: any) => String(d.discord_user_id));
  const out: string[] = [];
  for (const id of ids) { const m = await discord("GET", `/guilds/${guildId}/members/${id}`); if (m.ok) out.push(id); }
  return out;
}
async function handleReminders(): Promise<number> {
  const { data: rows, error } = await db.rpc("discord_claim_reminders");
  if (error) { console.error("reminders", error.message); return 0; }
  let n = 0;
  for (const r of (rows ?? []) as any[]) {
    const t = unix(r.starts_at);
    const text = r.kind === "1h"
      ? `\u23f1\ufe0f **${clip(r.title, 200)}** starts <t:${t}:R>. Get ready.`
      : `\ud83d\udcc5 **${clip(r.title, 200)}** starts <t:${t}:R> \u00b7 <t:${t}:F>. Still in? Your spot is on the card above.`;
    const users = r.mention_attendees ? await attendeesOnServer(r.event_id, r.guild_id) : [];
    const res = await discord("POST", `/channels/${r.channel_id}/messages`, {
      content: users.length ? `${text}\n${users.map((u) => `<@${u}>`).join(" ")}` : text,
      message_reference: { message_id: r.message_id, fail_if_not_exists: false },
      allowed_mentions: { parse: [], users, replied_user: false },
    });
    if (res.ok) { n++; continue; }
    console.log("reminder failed", r.feed_id, r.event_id, res.status, res.text.slice(0, 200));
    await db.from("discord_messages").update(r.kind === "1h" ? { reminded_1h_at: null } : { reminded_24h_at: null }).eq("feed_id", r.feed_id).eq("event_id", r.event_id);
    const { data: f } = await db.from("discord_feeds").select("*").eq("feed_id", r.feed_id).maybeSingle();
    if (f && !(await handleGone(f, res))) await feedError(f, describeFail(res, "post reminders in the channel"));
  }
  return n;
}

// ---------- LFG (DEC-0111) ----------
// Searches that ran out (3 h), were closed or emptied: move the Join people who are still in the
// LFG voice to voice-chat (only those, via their voice state), delete the voice, turn the card
// into a short "ended" note without names, then delete the row (no Discord IDs kept).
const LFG_END_VOICE = "878764019207516192"; // voice-chat (TALK), Fausto 15.10.
const LFG_LABELS: Record<string, string> = { race: "Race", playlist: "Playlist", "car-meet": "Car Meet", cruise: "Cruise", photo: "Photo Session", job: "Job" };
async function handleLfg(): Promise<number> {
  const { data: rows, error } = await db.rpc("discord_lfg_claim_ended");
  if (error) { console.error("lfg", error.message); return 0; }
  let n = 0;
  for (const l of (rows ?? []) as any[]) {
    if (l.voice_channel_id) {
      for (const u of (l.participants ?? []) as string[]) {
        const vs = await discord("GET", `/guilds/${l.guild_id}/voice-states/${u}`);
        if (vs.ok && vs.data?.channel_id === l.voice_channel_id) await discord("PATCH", `/guilds/${l.guild_id}/members/${u}`, { channel_id: LFG_END_VOICE });
      }
      const d = await discord("DELETE", `/channels/${l.voice_channel_id}`);
      if (!d.ok && d.status !== 404) { console.log("lfg voice delete failed", d.status, d.text.slice(0, 200)); continue; } // retried later (claim again after 4 h)
    }
    if (l.message_id) {
      const joined = (l.participants ?? []).length;
      const e = await discord("PATCH", `/channels/${l.channel_id}/messages/${l.message_id}`, { content: "", components: [], allowed_mentions: { parse: [] },
        embeds: [{ color: GREY, title: `${LFG_LABELS[l.activity] ?? l.activity} \u00b7 ended`, description: `${joined} ${joined === 1 ? "driver was" : "drivers were"} in. Want another round? Hit Find Players.` }] });
      // keep the row (and the participant IDs) until the card no longer shows names; retried later
      if (!e.ok && e.status !== 404) { console.log("lfg card edit failed", e.status, e.text.slice(0, 200)); continue; }
    }
    await db.from("discord_lfg").delete().eq("lfg_id", l.lfg_id);
    n++;
  }
  return n;
}

// ---------- mod alerts (DEC-0137) ----------
const normName = (n: string) => String(n ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
async function modAlertsChannel(): Promise<string | null> {
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "mod_alerts_channel").maybeSingle();
  if (data?.value) return data.value;
  const r = await discord("GET", `/guilds/${ROLE_GUILD}/channels`);
  if (!r.ok) { console.log("mod alerts: channel list failed", r.status); return null; }
  const hit = (r.data as any[]).filter((c) => c.type === 0 && normName(c.name).includes("modalerts"));
  if (hit.length !== 1) { console.log("mod alerts: channel not found or ambiguous", hit.length); return null; }
  await db.from("discord_bot_state").upsert({ key: "mod_alerts_channel", value: hit[0].id, updated_at: new Date().toISOString() });
  return hit[0].id;
}
async function handleModAlerts(): Promise<number> {
  if (!ROLE_GUILD) return 0;
  const { data: rows } = await db.from("discord_mod_alerts").select("*").is("sent_at", null).lt("attempts", 20).order("id").limit(25);
  if (!rows?.length) return 0;
  const channel = await modAlertsChannel();
  const ids = rows.map((r: any) => r.id);
  const fail = async () => { for (const r of rows as any[]) await db.from("discord_mod_alerts").update({ attempts: r.attempts + 1 }).eq("id", r.id); };
  if (!channel) { await fail(); return 0; }
  const line = (r: any) => `\u2022 **${r.kind}**${r.actor ? ` \u00b7 ${clip(r.actor, 40)}` : ""}${r.detail ? ` \u00b7 ${clip(r.detail, 80)}` : ""} \u00b7 [open](${SITE}/${r.link})`;
  const links: string[] = [...new Set<string>(rows.map((r: any) => String(r.link)))];
  const res = await discord("POST", `/channels/${channel}/messages`, {
    allowed_mentions: { parse: [] },
    embeds: [{ color: ORANGE, title: rows.length === 1 ? "Waiting for review" : `${rows.length} things waiting for review`,
      description: clip(rows.map(line).join("\n"), 4000), footer: { text: "Leonida Racing \u00b7 mod alerts" }, timestamp: new Date().toISOString() }],
    components: links.length <= 5 ? [row(...links.map((l) => linkButton(l === "moderator/" ? "Lap times" : l.includes("hub") ? "Hub requests" : l.includes("reports") ? "Lap reports" : l.includes("content") ? "Content reports" : "Open", `${SITE}/${l}`)))] : [],
  });
  if (res.ok) { await db.from("discord_mod_alerts").update({ sent_at: new Date().toISOString() }).in("id", ids); return rows.length; }
  console.log("mod alert post failed", res.status, res.text.slice(0, 200));
  if (res.status === 404 || res.status === 403) await db.from("discord_bot_state").delete().eq("key", "mod_alerts_channel"); // look the channel up again
  await fail();
  return 0;
}

// ---------- events panel (DEC-0137) ----------
const EVENTS_PANEL = {
  allowed_mentions: { parse: [] },
  embeds: [{ color: ORANGE, title: "Host your own event",
    description: "Race, car meet, cruise or league night \u2013 create it on leonidaracing.com. Once it's published, it shows up on this server automatically, with sign-up buttons.\n\n**First time?** Apply as event host on the same page. A mod confirms it within 24 hours, then you can publish.",
    footer: { text: "Leonida Racing \u00b7 no commands needed" } }],
  components: [row(linkButton("Create Event", `${SITE}/account/events/`), linkButton("Event calendar", `${SITE}/community/events/`))],
};
async function postEventsPanel(channelId: string) {
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "events_panel").maybeSingle();
  let ref: { channel_id?: string; message_id?: string } = {};
  try { ref = JSON.parse(data?.value ?? "{}"); } catch { /* none */ }
  let msgId: string | null = null;
  if (ref.message_id && ref.channel_id === channelId) {
    const r = await discord("PATCH", `/channels/${channelId}/messages/${ref.message_id}`, EVENTS_PANEL);
    if (r.ok) msgId = ref.message_id;
  }
  if (!msgId) {
    const r = await discord("POST", `/channels/${channelId}/messages`, EVENTS_PANEL);
    if (!r.ok) return { ok: false, step: "post", status: r.status, error: r.text.slice(0, 300) };
    msgId = r.data.id;
  }
  const pin = await discord("PUT", `/channels/${channelId}/pins/${msgId}`);
  await db.from("discord_bot_state").upsert({ key: "events_panel", value: JSON.stringify({ channel_id: channelId, message_id: msgId }), updated_at: new Date().toISOString() });
  return { ok: true, message_id: msgId, pinned: pin.ok, pinStatus: pin.status };
}

// ---------- videos & streams (28.10.2026) ----------
const GTA_RE = /\b(gta|grand theft auto|vice city|leonida)\b|gta ?(6|vi)\b/i;
// cars_only: title must also name a car/racing term or an in-game manufacturer (list agreed 28.10.2026;
// "stay tuned" is excluded, ambiguous brand words like Obey/Emperor/Coil are left out on purpose).
const CARS_RE = new RegExp("(?<![\\p{L}\\p{N}_])(cars?|vehicles?|supercars?|hypercars?|sports ?cars?|muscle ?cars?|lowriders?|jdm|suvs?|sedans?|coupes?|off-?road|races?|racing|racers?|time attack|lap ?times?|lap records?|raceway|motorsports?|gellhorn|drift(?:s|ing)?|carmeets?|burnouts?|tuning|(?<!stay )tuned|top speed|garages?|driving|handling|annis|bravado|canis|declasse|dinka|dundreary|enus|gallivanter|granforma|grotti|imponte|invetero|karin|lampadati|maibatsu|ocelot|pegassi|pfister|progen|schyster|truffade|[uü]bermacht|vapid|zirconium)(?![\\p{L}\\p{N}_])", "iu");
const YT_HEADERS = { "Accept-Language": "en", "Cookie": "SOCS=CAI; CONSENT=YES+1", "User-Agent": "Mozilla/5.0 (compatible; LeonidaRacingBot/1.0; +https://leonidaracing.com/discord/bot/)" };
const xmlText = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
async function resolveYouTube(input: string): Promise<string | null> {
  const direct = input.match(/(UC[\w-]{22})/);
  if (direct) return direct[1];
  let url = input.trim();
  if (/^@[\w.-]+$/.test(url)) url = `https://www.youtube.com/${url}`;
  else if (!/^https?:\/\//.test(url)) url = `https://www.youtube.com/@${url.replace(/^@/, "")}`;
  try {
    const r = await fetch(url, { headers: YT_HEADERS, redirect: "follow" });
    if (!r.ok) return null;
    const html = await r.text();
    const m = html.match(/"externalId":"(UC[\w-]{22})"/) ?? html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/)
      ?? html.match(/youtube\.com\/channel\/(UC[\w-]{22})/) ?? html.match(/"channelId":"(UC[\w-]{22})"/);
    return m ? m[1] : null;
  } catch { return null; }
}
type VItem = { item_id: string; title: string; url: string; published_at: string | null; extra?: string };
async function youtubeItems(channelId: string): Promise<VItem[] | string> {
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, { headers: YT_HEADERS });
    if (!r.ok) return `YouTube feed answered ${r.status}`;
    const xml = await r.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
      const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] ?? "";
      return { item_id: id, title: xmlText(e.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""), url: `https://www.youtube.com/watch?v=${id}`,
        published_at: e.match(/<published>([^<]+)<\/published>/)?.[1] ?? null };
    }).filter((x) => x.item_id);
  } catch (err) { return `YouTube feed failed: ${String(err).slice(0, 120)}`; }
}
async function twitchToken(): Promise<string | null> {
  const id = Deno.env.get("TWITCH_CLIENT_ID"), secret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!id || !secret) return null;
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "twitch_token").maybeSingle();
  try { const t = JSON.parse(data?.value ?? "{}"); if (t.token && t.exp > Date.now() + 600e3) return t.token; } catch { /* new one */ }
  const r = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }) });
  if (!r.ok) { console.log("twitch token failed", r.status); return null; }
  const j = await r.json();
  await db.from("discord_bot_state").upsert({ key: "twitch_token", value: JSON.stringify({ token: j.access_token, exp: Date.now() + j.expires_in * 1000 }), updated_at: new Date().toISOString() });
  return j.access_token;
}
function videoMessage(ch: any, it: VItem, live: boolean) {
  const head = live ? `\u{1F534} **${ch.display_name}** is live${it.extra ? ` \u00b7 ${it.extra}` : ""}` : `\u{1F3AC} **${ch.display_name}** posted a new video`;
  return {
    content: `${head}\n${it.url}`, // Discord shows YouTube's / Twitch's own preview (playable for YouTube)
    allowed_mentions: { parse: [] },
    components: [row(linkButton(live ? "Watch live" : "Watch", it.url), linkButton("Add to your server", INVITE))],
  };
}
async function handleVideos() {
  const { data: chans } = await db.from("video_channels").select("*").eq("is_active", true).order("created_at").limit(200);
  const { data: feeds } = await db.from("discord_feeds").select("*").eq("source", "videos");
  if (!chans?.length) return { channels: 0, posted: 0 };
  let posted = 0, recorded = 0;
  const twitch = chans.filter((c: any) => c.platform === "twitch");
  const twitchLive = new Map<string, any>();
  if (twitch.length) {
    const token = await twitchToken();
    if (!token) { for (const c of twitch) await db.from("video_channels").update({ last_error: "Twitch not connected yet (missing TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET)", last_checked_at: new Date().toISOString() }).eq("channel_id", c.channel_id); }
    else {
      for (let n = 0; n < twitch.length; n += 100) {
        const logins = twitch.slice(n, n + 100).map((c: any) => (c.external_id ?? String(c.input).replace(/^.*twitch\.tv\//i, "").replace(/[/?#].*$/, "")).toLowerCase());
        const r = await fetch(`https://api.twitch.tv/helix/streams?${logins.map((l: string) => `user_login=${encodeURIComponent(l)}`).join("&")}&first=100`,
          { headers: { "Client-Id": Deno.env.get("TWITCH_CLIENT_ID")!, Authorization: `Bearer ${token}` } });
        if (!r.ok) { console.log("twitch streams failed", r.status, (await r.text()).slice(0, 200)); if (r.status === 401) await db.from("discord_bot_state").delete().eq("key", "twitch_token"); continue; }
        for (const s of (await r.json()).data ?? []) twitchLive.set(String(s.user_login).toLowerCase(), s);
      }
    }
  }
  for (const ch of chans as any[]) {
    let items: VItem[] = [];
    let error: string | null = null;
    const patch: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
    if (ch.platform === "youtube") {
      let ext = ch.external_id;
      if (!ext) { ext = await resolveYouTube(ch.input); if (ext) patch.external_id = ext; }
      if (!ext) error = "Couldn't find this YouTube channel. Paste the channel link (youtube.com/@name or youtube.com/channel/UC...).";
      else { const res = await youtubeItems(ext); if (typeof res === "string") error = res; else items = res; }
    } else {
      if (!Deno.env.get("TWITCH_CLIENT_ID")) continue; // error already stored above
      const login = (ch.external_id ?? String(ch.input).replace(/^.*twitch\.tv\//i, "").replace(/[/?#].*$/, "")).toLowerCase();
      if (!ch.external_id) patch.external_id = login;
      const s = twitchLive.get(login);
      if (s) items = [{ item_id: String(s.id), title: String(s.title ?? ""), url: `https://www.twitch.tv/${login}`, published_at: s.started_at ?? null, extra: s.game_name || undefined }];
    }
    patch.last_error = error;
    if (error) { await db.from("video_channels").update(patch).eq("channel_id", ch.channel_id); continue; }
    if (items.length) {
      const { data: known } = await db.from("video_items").select("item_id").eq("platform", ch.platform).in("item_id", items.map((i) => i.item_id));
      const seen = new Set((known ?? []).map((k: any) => k.item_id));
      for (const it of items.filter((i) => !seen.has(i.item_id)).reverse()) { // oldest first
        let reason: string | null = null;
        if (!ch.primed && ch.platform === "youtube") reason = "already there when the channel was added";
        else if (it.published_at && Date.now() - new Date(it.published_at).getTime() > 3 * 864e5) reason = "older than 3 days";
        else if (ch.gta_only && !GTA_RE.test(`${it.title} ${it.extra ?? ""}`)) reason = "not about GTA";
        else if (ch.cars_only && !CARS_RE.test(it.title)) reason = "not about cars or racing";
        const { error: insErr } = await db.from("video_items").insert({ platform: ch.platform, item_id: it.item_id, channel_id: ch.channel_id, title: it.title.slice(0, 300), url: it.url, published_at: it.published_at, skipped_reason: reason });
        if (insErr) continue; // another run got it
        recorded++;
        if (reason) continue;
        for (const f of feeds ?? []) {
          const r = await discord("POST", `/channels/${f.channel_id}/messages`, videoMessage(ch, it, ch.platform === "twitch"));
          if (!r.ok) { if (!(await handleGone(f, r))) { await feedError(f, describeFail(r, "post in the channel")); console.log("video post failed", f.feed_id, r.status, r.text.slice(0, 200)); } }
          else if (f.last_error) await feedError(f, null);
        }
        await db.from("video_items").update({ posted_at: new Date().toISOString() }).eq("platform", ch.platform).eq("item_id", it.item_id);
        posted++;
      }
    }
    if (!ch.primed) patch.primed = true;
    await db.from("video_channels").update(patch).eq("channel_id", ch.channel_id);
  }
  return { channels: chans.length, recorded, posted, feeds: (feeds ?? []).length };
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { data: ok } = await db.rpc("check_job_token", { p_name: "discord-dispatch", p_token: req.headers.get("x-job-token") ?? "" });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  if (!TOKEN) return json({ error: "DISCORD_BOT_TOKEN missing" }, 500);
  const body = await req.json().catch(() => ({}));
  if (body?.housekeeping === true) return json(await housekeeping());
  if (body?.videos === true) return json(await handleVideos());
  if (body?.channels === true) {
    const r = await discord("GET", `/guilds/${ROLE_GUILD}/channels`);
    return json(r.ok ? (r.data as any[]).map((c) => ({ id: c.id, name: c.name, type: c.type, parent: c.parent_id })) : { error: r.status });
  }
  if (body?.panel === "events" && /^\d{15,25}$/.test(String(body.channel_id ?? ""))) return json(await postEventsPanel(String(body.channel_id)));

  const started = Date.now();
  let done = 0, failed = 0;
  try { done += await handleVehicles(); } catch (err) { failed++; console.error("vehicles", err); }
  try { done += await handleRoleJobs(started); } catch (err) { failed++; console.error("roles", err); }
  try { done += await handleReminders(); } catch (err) { failed++; console.error("reminders", err); }
  try { done += await handleLfg(); } catch (err) { failed++; console.error("lfg", err); }
  try { done += await handleModAlerts(); } catch (err) { failed++; console.error("mod alerts", err); }
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
