// discord-interactions -- HTTP endpoint for the Leonida Racing Discord bot
// (RS-0067, DEC-0098, spec: Claude outputs/SPEC-Discord-Bot-Phase-1-2026-10-04.md).
//
// Discord calls this URL for every slash command, autocomplete and button.
// No JWT (Discord can't send one): every request is authenticated by the
// Ed25519 signature Discord puts on it, checked against the app's PUBLIC key
// (not a secret). Data is read server-side with the service role, but only
// what the website shows publicly (published events, Garage vehicles). Website + DB stay the single source of truth.
//
// Package 1: /events, /event, /car, /create-event.
// Package 2: /leonida feed add|list|edit|remove (table discord_feeds).
// Package 4: I'm in / Withdraw buttons on the cards (rpc discord_rsvp).
// /ping (DEC-0129, 15.10.2026): official server only (registered as a guild command).
// Verified Event Host pings Event / Playlist / LFG Pings in #events or #playlists;
// allowed_mentions limits the ping to exactly that role (never @everyone/@here).
// Role picker (15.10.2026, replaces Discord onboarding): select menus in #roles,
// custom_id "roles:<group>"; the choice replaces the member's roles of that group.
// /compare + /crew (15.10.2026, Fausto 07.10. "zuerst Compare und Crew posten"): only data the
// website shows publicly (Garage vehicles with release_id, published crews, public leaderboard).
// Prices / reference laps / verdict live in the site build, not the DB -> the bot links to
// /cars/compare/?cars=a,b (DEC-0128) instead of guessing them.
// LFG v1 (DEC-0111, Fausto 15.10.: #lfg under COMMUNITY, auto ping, end -> voice-chat):
// panel button "lfg:new" -> ephemeral selects (activity, players) -> rpc discord_lfg_create
// (max 3 per server, 1 per host), own voice channel + card with Join / Leave / Close.
// Ending (3 h, closed, or empty) is done by discord-dispatch (handleLfg). Rows are deleted then.
// Texts: Codex "Bot-Stimme" 15.10. (Codex Zuarbeit/Discord-Texte-Bot-Stimme-2026-10-15.md).
// Package 3: cards are posted by the separate function discord-dispatch; test
// events (hub_events.is_test) are never shown by these commands.
// Option "add_to_server_events" = DB column native_events (Discord scheduled events).
// The global command list is (re)registered with the bot token on Discord's
// verification PING and on the first request after a deploy whenever
// COMMANDS_VERSION differs from the one stored in discord_bot_state.
//
// COPY STATUS: all user-facing texts are Claude placeholders, Codex review pending.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_KEY = "5aef5b94df1e1470f44ce3f5eac2e53618c6582759ebe295d9745eeceeb0cfe6";
const APP_ID = "1552506662533861376";
const SITE = "https://leonidaracing.com";
// Guild install with bot user + slash commands. Permissions: View Channels, Send Messages, Embed Links, Manage Events + Create Events (server events), Connect (needed to update server events an admin moved to a voice channel).
const INVITE = `https://discord.com/oauth2/authorize?client_id=${APP_ID}&scope=bot+applications.commands&permissions=17600777047040&integration_type=0`;
const YELLOW = 0xffd74c;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const EVENT_TYPES: Record<string, string> = { race: "Race", "time-attack": "Time Attack", league: "League", "car-meet": "Car Meet", cruise: "Cruise", other: "Other" };
const PLATFORMS: Record<string, string> = { ps5: "PS5", xbox: "Xbox Series X|S" };
const REMINDERS: Record<string, string> = { off: "Off", "24h": "24 hours before", "1h": "1 hour before", both: "24 hours and 1 hour before" };
const REMINDER_CHOICES = Object.entries(REMINDERS).map(([value, name]) => ({ name, value }));
const MAX_FEEDS_PER_SERVER = 10;
// ---------- /ping (official server only) ----------
const OFFICIAL_GUILD = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const PING_TARGETS: Record<string, { role: string; label: string }> = {
  event: { role: "893112573237526588", label: "Event Pings" },
  playlist: { role: "893112193678209054", label: "Playlist Pings" },
  lfg: { role: "1560309891086811157", label: "LFG Pings" },
};
const PING_CHANNELS = ["878750571128053841", "896757714766675968"]; // #events, #playlists
const PING_COOLDOWN_MS = 15 * 60e3;
// ---------- role picker (official server only) ----------
// Group -> allowed role ids. Only these roles can ever be given/removed by the picker.
const ROLE_GROUPS: Record<string, string[]> = {
  region: ["878780420668416021", "878780421133963285", "878780421553401916", "1560309881662083153", "1560309885277569115", "1560309883708903525", "878780422404845578"],
  platform: ["1560309886997500076", "1560309888335482941", "1560309889606361282"],
  language: ["878755376567291966", "878766594757640212", "878766380529377380", "878766639217266798", "1557687190983802880", "1557686877967093832"],
  scene: ["1557446185634111629", "878767261274472508", "878768435574743080", "878774874661851177", "882407210431422495", "879339204700680213"],
  pings: ["893112573237526588", "893112193678209054", "1560309891086811157"],
};
const GUILD_COMMANDS = [
  { name: "ping", description: "Give the right crowd a heads-up about your event, playlist or LFG post.", dm_permission: false,
    options: [
      { type: 3, name: "audience", description: "Who should get the ping?", required: true, choices: Object.entries(PING_TARGETS).map(([value, t]) => ({ name: t.label, value })) },
      { type: 3, name: "message", description: "What do you want them to know?", required: true, max_length: 500 },
    ] },
];

// /events, /event, /car, /create-event are open to everyone (Fausto 2026-10-07):
// read-only or link-only; publishing events still needs the host role on the website.
const COMMANDS = [
  { name: "events", description: "Upcoming GTA VI events from the Leonida Racing calendar", dm_permission: false,
    options: [
      { type: 3, name: "type", description: "Event type", required: false, choices: Object.entries(EVENT_TYPES).map(([value, name]) => ({ name, value })) },
      { type: 3, name: "platform", description: "Platform", required: false, choices: Object.entries(PLATFORMS).map(([value, name]) => ({ name, value })) },
    ] },
  { name: "event", description: "Show one event", dm_permission: false,
    options: [{ type: 3, name: "event", description: "Start typing the event name", required: true, autocomplete: true }] },
  { name: "car", description: "Vehicle card from The Garage", dm_permission: false,
    options: [{ type: 3, name: "vehicle", description: "Start typing a make or model", required: true, autocomplete: true }] },
  { name: "create-event", description: "Create an event on Leonida Racing", dm_permission: false },
  { name: "compare", description: "Put 2 to 4 cars from The Garage side by side", dm_permission: false,
    options: [1, 2, 3, 4].map((n) => ({ type: 3, name: `car${n}`, description: n <= 2 ? "Start typing a make or model" : "Optional: another car", required: n <= 2, autocomplete: true })) },
  { name: "crew", description: "Crew card from Leonida Racing", dm_permission: false,
    options: [{ type: 3, name: "crew", description: "Start typing a crew name or tag", required: true, autocomplete: true }] },
  // Setup command: always "Manage Server" only (also checked at runtime).
  { name: "leonida", description: "Set up Leonida Racing on this server", default_member_permissions: "32", dm_permission: false,
    options: [{ type: 2, name: "feed", description: "Leonida Racing feeds for this server", options: [
      { type: 1, name: "add", description: "Post events from a source into a channel", options: [
        { type: 7, name: "channel", description: "Channel for the event posts", required: true, channel_types: [0, 5] },
        { type: 3, name: "source", description: "Which events", required: true, choices: [
          { name: "My crew", value: "crew" }, { name: "My host profile", value: "host" }, { name: "Public calendar", value: "public" }] },
        { type: 3, name: "platform", description: "Only this platform (required for the public calendar)", required: false, choices: Object.entries(PLATFORMS).map(([value, name]) => ({ name, value })) },
        { type: 3, name: "event_type", description: "Only this event type", required: false, choices: Object.entries(EVENT_TYPES).map(([value, name]) => ({ name, value })) },
        { type: 3, name: "crew", description: "Your crew (only needed if you lead more than one)", required: false, autocomplete: true },
        { type: 5, name: "add_to_server_events", description: "Also add each event to this server's Events (top of the channel list)", required: false },
        { type: 3, name: "reminders", description: "Reminder posts before the start", required: false, choices: REMINDER_CHOICES },
        { type: 5, name: "mention_attendees", description: "Mention drivers who are in when posting reminders", required: false },
      ] },
      // Own subcommand, so the event-only options (platform, reminders ...) don't show up (Fausto 06.10.).
      { type: 1, name: "vehicles", description: "Post new vehicles into a channel", options: [
        { type: 7, name: "channel", description: "Channel for the vehicle posts", required: true, channel_types: [0, 5] },
      ] },
      { type: 1, name: "list", description: "Show this server's feeds" },
      { type: 1, name: "edit", description: "Change a feed's options", options: [
        { type: 3, name: "feed", description: "Feed to change", required: true, autocomplete: true },
        { type: 5, name: "add_to_server_events", description: "Also add each event to this server's Events (top of the channel list)", required: false },
        { type: 3, name: "reminders", description: "Reminder posts before the start", required: false, choices: REMINDER_CHOICES },
        { type: 5, name: "mention_attendees", description: "Mention drivers who are in when posting reminders", required: false },
      ] },
      { type: 1, name: "remove", description: "Remove a feed", options: [
        { type: 3, name: "feed", description: "Feed to remove", required: true, autocomplete: true },
      ] },
    ] }] },
];
// Bump whenever COMMANDS changes -> re-registered automatically after deploy.
const COMMANDS_VERSION = "2026-10-15.2"; // + /compare, /crew

// ---------- helpers ----------
const hex = (h: string) => new Uint8Array(h.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
let keyPromise: Promise<CryptoKey> | null = null;
async function verify(req: Request, body: string): Promise<boolean> {
  const sig = req.headers.get("x-signature-ed25519");
  const ts = req.headers.get("x-signature-timestamp");
  if (!sig || !ts) return false;
  keyPromise ??= crypto.subtle.importKey("raw", hex(PUBLIC_KEY), { name: "Ed25519" }, false, ["verify"]);
  try {
    return await crypto.subtle.verify("Ed25519", await keyPromise, hex(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const reply = (data: Record<string, unknown>) => json({ type: 4, data: { allowed_mentions: { parse: [] }, ...data } });
const ephemeral = (content: string, components?: unknown[]) => reply({ content, flags: 64, ...(components ? { components } : {}) });
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const linkButton = (label: string, url: string) => ({ type: 2, style: 5, label, url });
const row = (...buttons: unknown[]) => ({ type: 1, components: buttons });
const addButton = linkButton("Add to your server", INVITE);
// Leaf options, also inside subcommand groups / subcommands (types 1 and 2).
function leafOpts(i: any): any[] {
  let o: any[] = i.data?.options ?? [];
  while (o.length && (o[0].type === 1 || o[0].type === 2)) o = o[0].options ?? [];
  return o;
}
const subPath = (i: any) => { const p: string[] = []; let o: any[] = i.data?.options ?? []; while (o.length && (o[0].type === 1 || o[0].type === 2)) { p.push(o[0].name); o = o[0].options ?? []; } return p.join(" "); };
const opt = (i: any, name: string) => leafOpts(i).find((o: any) => o.name === name)?.value;
// Run work after the response has been sent (Supabase EdgeRuntime).
// @ts-ignore EdgeRuntime is provided by Supabase
const bg = (p: Promise<unknown>) => { try { EdgeRuntime.waitUntil(p.catch((e) => console.error(e))); } catch { p.catch((e) => console.error(e)); } };
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function registerCommandsIfChanged() {
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "commands_version").maybeSingle();
  if (data?.value === COMMANDS_VERSION) return;
  await registerCommands();
}
async function registerCommands() {
  if (!DISCORD_BOT_TOKEN) return;
  const r = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDS),
  });
  console.log("register commands", COMMANDS_VERSION, r.status, r.ok ? "" : await r.text());
  let g = { ok: true } as { ok: boolean };
  if (OFFICIAL_GUILD) {
    const gr = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/guilds/${OFFICIAL_GUILD}/commands`, {
      method: "PUT",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(GUILD_COMMANDS),
    });
    console.log("register guild commands", gr.status, gr.ok ? "" : await gr.text());
    g = gr;
  }
  if (r.ok && g.ok) await db.from("discord_bot_state").upsert({ key: "commands_version", value: COMMANDS_VERSION, updated_at: new Date().toISOString() });
}
let commandsChecked = false;

// ---------- data ----------
const EVENT_COLS = "event_id,title,event_type,starts_at,ends_at,platforms,host_name,status,max_participants,registration,discord_url,host:crews(name,tag,discord_url),creator:drivers!hub_events_created_by_fkey(display_name,deleted_at)";
async function upcomingEvents(type?: string, platform?: string, limit = 5) {
  let q = db.from("hub_events").select(EVENT_COLS).eq("is_published", true).eq("is_test", false).neq("status", "cancelled")
    .gte("starts_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("starts_at").limit(limit);
  if (type) q = q.eq("event_type", type);
  if (platform) q = q.contains("platforms", [platform]);
  const { data } = await q;
  return (data ?? []) as any[];
}
async function goingCount(eventId: string) {
  const { count } = await db.from("hub_event_rsvps").select("event_id", { count: "exact", head: true }).eq("event_id", eventId);
  return count ?? 0;
}
const eventUrl = (e: any) => `${SITE}/community/events/#event-${e.event_id}`;
// Host = a person (PSN name, else the creator's site name); the crew as a tag behind it.
const hostPerson = (e: any) => e.host_name ?? (e.creator && !e.creator.deleted_at ? e.creator.display_name : null) ?? "Community host";
// Crew shown GTA-style as a tag behind the host name, e.g. "Fausto-511 [LR]".
const crewTag = (e: any) => e.host?.tag ? `[${e.host.tag}]` : e.host?.name ? `[${e.host.name}]` : "";
const withTag = (e: any, name: string) => crewTag(e) ? `${name} ${crewTag(e)}` : name;
const psnOrName = (e: any) => e.host_name ? `[${e.host_name}](https://profile.playstation.com/${encodeURIComponent(e.host_name)})` : hostPerson(e);
const typeLine = (e: any) => [EVENT_TYPES[e.event_type] ?? e.event_type, ...(e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p)].join(" \u00b7 ");
const goingValue = (e: any, going: number, closed: boolean) => (e.max_participants ? `${going} / ${e.max_participants}` : String(going)) + (closed ? "\nSign-ups closed" : "");
const hostLabel = (e: any) => withTag(e, hostPerson(e));

async function eventEmbed(e: any) {
  const going = await goingCount(e.event_id);
  // Compact on purpose: Discord mobile stacks every field, so type/platform go
  // into the author line and the crew tag behind the host name.
  const fields = [
    { name: "Starts", value: `<t:${unix(e.starts_at)}:F>\n<t:${unix(e.starts_at)}:R>`, inline: true },
    { name: "Host", value: withTag(e, psnOrName(e)), inline: true },
    { name: "Going", value: goingValue(e, going, e.registration === "closed"), inline: true },
  ];
  return {
    author: { name: typeLine(e) }, title: clip(e.title, 256), url: eventUrl(e), color: YELLOW, fields,
    image: { url: `${SITE}/images/hub/hub-events-1672.jpg` },
    footer: { text: "Leonida Racing · leonidaracing.com" },
  };
}

// ---------- commands ----------
async function cmdEvents(i: any) {
  const type = opt(i, "type"), platform = opt(i, "platform");
  const list = await upcomingEvents(type, platform);
  const what = [type && EVENT_TYPES[type], platform && PLATFORMS[platform]].filter(Boolean).join(" · ");
  if (!list.length) {
    return reply({ content: `No upcoming events${what ? ` (${what})` : ""} right now.`, components: [row(linkButton("Open the calendar", `${SITE}/community/events/`), addButton)] });
  }
  const lines = list.map((e) => `**[${clip(e.title, 80)}](${eventUrl(e)})**\n<t:${unix(e.starts_at)}:f> · <t:${unix(e.starts_at)}:R> · ${EVENT_TYPES[e.event_type] ?? e.event_type} · ${hostLabel(e)}`);
  return reply({
    embeds: [{ title: `Upcoming events${what ? ` · ${what}` : ""}`, description: lines.join("\n\n"), color: YELLOW, footer: { text: "Leonida Racing · times shown in your time zone" } }],
    components: [row(linkButton("Full calendar", `${SITE}/community/events/`), addButton)],
  });
}

async function cmdEvent(i: any) {
  const id = String(opt(i, "event") ?? "");
  const { data: e } = await db.from("hub_events").select(EVENT_COLS).eq("event_id", id).eq("is_published", true).eq("is_test", false).maybeSingle();
  if (!e) return ephemeral("I couldn't find that event. Pick one from the suggestions while typing.");
  return reply({ embeds: [await eventEmbed(e)], components: [row(linkButton("Details", eventUrl(e)), addButton)] });
}

async function cmdCar(i: any) {
  const id = String(opt(i, "vehicle") ?? "");
  const { data: v } = await db.from("vehicles").select("vehicle_id,make,model,classes,drive,seats,real_life_inspiration,first_seen_in,has_photo").eq("vehicle_id", id).not("release_id", "is", null).maybeSingle();
  if (!v) return ephemeral("I couldn't find that vehicle. Pick one from the suggestions while typing.");
  const url = `${SITE}/cars/vehicles/${v.vehicle_id}/`;
  const fields = [
    { name: "Class", value: (v.classes ?? []).join(", ") || "—", inline: true },
    { name: "Drivetrain", value: v.drive || "—", inline: true },
    { name: "Seats", value: v.seats ? String(v.seats) : "—", inline: true },
  ];
  if (v.real_life_inspiration) fields.push({ name: "Real-life inspiration", value: v.real_life_inspiration, inline: false });
  if (v.first_seen_in) fields.push({ name: "First seen in", value: v.first_seen_in, inline: false });
  return reply({
    embeds: [{
      title: `${v.make} ${v.model}`, url, color: YELLOW, fields,
      ...(v.has_photo ? { image: { url: `${SITE}/images/vehicles/${v.vehicle_id}-1280.webp` } } : {}),
      footer: { text: "Leonida Racing · The Garage" },
    }],
    components: [row(linkButton("Open in The Garage", url), addButton)],
  });
}

// ---------- /compare ----------
const COMPARE_TRACK = "gellhorn-international-raceway", COMPARE_PLATFORM = "ps5"; // same as the compare page
const ACQ: Record<string, string> = { "pre-order": "Pre-order bonus", "ultimate-edition": "Ultimate Edition exclusive", "gta-plus": "GTA+ members only" };
const lapTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
async function cmdCompare(i: any) {
  const ids = [...new Set([1, 2, 3, 4].map((n) => String(opt(i, `car${n}`) ?? "").trim()).filter(Boolean))];
  if (ids.length < 2) return ephemeral("Pick at least two different cars.");
  const { data } = await db.from("vehicles").select("vehicle_id,make,model,classes,drive,seats,acquisition,real_life_inspiration,has_photo").in("vehicle_id", ids).not("release_id", "is", null);
  const byId = new Map((data ?? []).map((v: any) => [v.vehicle_id, v]));
  const cars = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  if (cars.length < 2) return ephemeral("I couldn't find those cars. Pick them from the suggestions while typing.");
  const { data: laps } = await db.from("public_leaderboard_ranks").select("scope_key,lap_time_ms,driver").eq("track_id", COMPARE_TRACK)
    .eq("platform", COMPARE_PLATFORM).eq("scope", "vehicle").eq("rank", 1).in("scope_key", cars.map((c) => c.vehicle_id));
  const best = new Map((laps ?? []).map((l: any) => [l.scope_key, l]));
  const fastest = Math.min(...[...best.values()].map((l: any) => l.lap_time_ms));
  const same = (f: (c: any) => string) => new Set(cars.map(f)).size === 1;
  const cls = (c: any) => (c.classes ?? []).join(" / ") || "\u2014";
  const lines = (c: any) => {
    const l: any = best.get(c.vehicle_id);
    return [
      `**Class** ${cls(c)}`,
      `**Drive** ${c.drive || "\u2014"}`,
      `**Seats** ${c.seats ?? "\u2014"}`,
      ...(c.acquisition ? [`**Get it** ${ACQ[c.acquisition] ?? c.acquisition}`] : []),
      ...(c.real_life_inspiration ? [`**Based on** ${clip(c.real_life_inspiration, 60)}`] : []),
      ...(best.size ? [`**Best lap** ${l ? `${lapTime(l.lap_time_ms)}${l.lap_time_ms === fastest && best.size > 1 ? " \u{1F3C1}" : ""}` : "\u2014"}`] : []),
    ].join("\n");
  };
  const fields: any[] = [];
  cars.forEach((c, n) => {
    fields.push({ name: clip(`${c.make} ${c.model}`, 256), value: lines(c), inline: true });
    if (cars.length === 4 && n === 1) fields.push({ name: "\u200b", value: "\u200b", inline: true }); // 2 + 2 instead of 3 + 1
  });
  if (cars.length === 4) fields.push({ name: "\u200b", value: "\u200b", inline: true });
  const notes = [
    best.size ? `Best lap = fastest community lap at Gellhorn (PS5) in that car.` : "",
    same(cls) ? "" : "Different classes: they don't race each other on the leaderboard.",
    "Prices, reference laps and our verdict are on the full comparison.",
  ].filter(Boolean).join("\n");
  const url = `${SITE}/cars/compare/?cars=${cars.map((c) => c.vehicle_id).join(",")}`;
  const photos = cars.filter((c) => c.has_photo);
  const embeds: any[] = [{
    title: clip(cars.map((c) => c.model).join(" vs "), 256), url, color: YELLOW, description: notes, fields,
    ...(photos[0] ? { image: { url: `${SITE}/images/vehicles/${photos[0].vehicle_id}-1280.webp` } } : {}),
    footer: { text: "Leonida Racing \u00b7 The Garage" },
  }];
  // Extra embeds with the same url are shown as one image grid on desktop.
  for (const c of photos.slice(1)) embeds.push({ url, image: { url: `${SITE}/images/vehicles/${c.vehicle_id}-1280.webp` } });
  return reply({ embeds, components: [row(linkButton("Full comparison", url), addButton)] });
}

// ---------- /crew ----------
const FOCUS: Record<string, string> = { racing: "Racing", "time-attack": "Time Attack", league: "League", drift: "Drift", "car-meet": "Car Meets", cruise: "Cruises" };
const REGIONS: Record<string, string> = { international: "International", "north-america": "North America", "south-america": "South America", europe: "Europe", "middle-east": "Middle East", africa: "Africa", asia: "Asia", oceania: "Oceania" };
const langName = (() => { let d: Intl.DisplayNames | null = null; try { d = new Intl.DisplayNames(["en"], { type: "language" }); } catch { /* fallback: code */ } return (c: string) => { try { return d?.of(c) ?? c; } catch { return c; } }; })();
const safeHttps = (u: string | null) => { try { const x = new URL(String(u ?? "")); return x.protocol === "https:" ? x.toString() : null; } catch { return null; } };
async function cmdCrew(i: any) {
  const id = String(opt(i, "crew") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return ephemeral("I couldn't find that crew. Pick one from the suggestions while typing.");
  const { data: c } = await db.from("crews").select("crew_id,name,tag,color,platforms,focus,region,languages,description,member_count,discord_url,social_club_url,is_official,is_partner")
    .eq("crew_id", id).eq("is_published", true).maybeSingle();
  if (!c) return ephemeral("I couldn't find that crew. Pick one from the suggestions while typing.");
  const { data: next } = await db.from("hub_events").select("event_id,title,starts_at").eq("host_crew_id", c.crew_id).eq("is_published", true).eq("is_test", false)
    .neq("status", "cancelled").gte("starts_at", new Date().toISOString()).order("starts_at").limit(1).maybeSingle();
  const url = `${SITE}/community/crews/#crew-${c.crew_id}`;
  const badges = [c.is_official ? "Official" : "", c.is_partner ? "Partner" : ""].filter(Boolean).join(" \u00b7 ");
  const fields: any[] = [
    { name: "Plays", value: [...(c.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p), ...(c.focus ?? []).map((f: string) => FOCUS[f] ?? f)].join(" \u00b7 ") || "\u2014", inline: false },
    { name: "Region", value: REGIONS[c.region] ?? c.region ?? "\u2014", inline: true },
    { name: "Language", value: (c.languages ?? []).map(langName).join(", ") || "\u2014", inline: true },
  ];
  if (c.member_count != null) fields.push({ name: "Members", value: String(c.member_count), inline: true });
  if (next) fields.push({ name: "Next event", value: `[${clip(next.title, 80)}](${SITE}/community/events/#event-${next.event_id})\n<t:${unix(next.starts_at)}:f> \u00b7 <t:${unix(next.starts_at)}:R>`, inline: false });
  const color = /^#[0-9a-f]{6}$/i.test(c.color ?? "") ? parseInt(c.color.slice(1), 16) : YELLOW;
  const dc = safeHttps(c.discord_url), sc = safeHttps(c.social_club_url);
  const buttons = [linkButton("View crew", url), ...(dc ? [linkButton("Crew Discord", dc)] : []), ...(sc ? [linkButton("Social Club", sc)] : []), addButton];
  return reply({
    embeds: [{
      author: badges ? { name: badges } : undefined, title: clip(`${c.name} [${c.tag}]`, 256), url, color: color || 0x111111,
      description: c.description ? clip(String(c.description), 400) : undefined, fields,
      footer: { text: "Leonida Racing \u00b7 Crews" },
    }],
    components: [row(...buttons)],
  });
}

function cmdCreateEvent() {
  return ephemeral("Create your event on Leonida Racing. Once it's published, servers that follow your crew or the public calendar get it automatically.",
    [row(linkButton("Create Event", `${SITE}/account/events/`))]);
}

// ---------- autocomplete ----------
async function autocomplete(i: any) {
  const focused = i.data?.options?.find((o: any) => o.focused);
  const term = String(focused?.value ?? "").trim();
  let choices: { name: string; value: string }[] = [];
  if (i.data?.name === "event") {
    let q = db.from("hub_events").select("event_id,title,starts_at").eq("is_published", true).eq("is_test", false).neq("status", "cancelled")
      .gte("starts_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("starts_at").limit(25);
    if (term) q = q.ilike("title", `%${term}%`);
    const { data } = await q;
    choices = (data ?? []).map((e: any) => ({ name: clip(`${e.title} · ${new Date(e.starts_at).toISOString().slice(0, 10)}`, 100), value: e.event_id }));
  } else if (i.data?.name === "crew") {
    let q = db.from("crews").select("crew_id,name,tag").eq("is_published", true).order("name").limit(25);
    const t = term.replace(/[,()%]/g, "");
    if (t) q = q.or(`name.ilike.%${t}%,tag.ilike.%${t}%`);
    const { data } = await q;
    choices = (data ?? []).map((c: any) => ({ name: clip(`${c.name} [${c.tag}]`, 100), value: c.crew_id }));
  } else if (i.data?.name === "car" || i.data?.name === "compare") {
    let q = db.from("vehicles").select("vehicle_id,make,model").not("release_id", "is", null).order("make").order("model").limit(25); // officially shown only
    if (term) q = q.or(`model.ilike.%${term.replace(/[,()%]/g, "")}%,make.ilike.%${term.replace(/[,()%]/g, "")}%`);
    const { data } = await q;
    choices = (data ?? []).map((v: any) => ({ name: clip(`${v.make} ${v.model}`, 100), value: v.vehicle_id }));
  }
  return json({ type: 8, data: { choices } });
}

// ---------- feeds (package 2) ----------
const PERM_ADMIN = 1n << 3n, PERM_MANAGE_GUILD = 1n << 5n, PERM_CREATE_EVENTS = 1n << 44n; // creating scheduled events needs CREATE_EVENTS
const SOURCES: Record<string, string> = { crew: "Crew", host: "Host profile", public: "Public calendar", vehicles: "New vehicles" };
const canManage = (i: any) => { const p = BigInt(i.member?.permissions ?? "0"); return (p & PERM_ADMIN) !== 0n || (p & PERM_MANAGE_GUILD) !== 0n; };
const discordId = (i: any): string => i.member?.user?.id ?? i.user?.id ?? "";
const api = (path: string, init: RequestInit = {}) => fetch(`https://discord.com/api/v10${path}`, {
  ...init, headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
});

// Deferred ephemeral reply: answer Discord within 3 s, finish the work afterwards.
function deferEphemeral(i: any, work: () => Promise<{ content: string; components?: unknown[] }>) {
  bg((async () => {
    let out: { content: string; components?: unknown[] };
    try { out = await work(); } catch (e) { console.error(e); out = { content: "Something went wrong on our side. Please try again in a moment." }; }
    await fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}/messages/@original`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: out.content, components: out.components ?? [], allowed_mentions: { parse: [] } }),
    });
  })());
  return json({ type: 5, data: { flags: 64 } });
}

async function driverByDiscord(id: string) {
  if (!id) return null;
  const { data } = await db.from("drivers").select("driver_id,display_name").eq("discord_user_id", id).is("deleted_at", null).maybeSingle();
  return data as { driver_id: string; display_name: string } | null;
}
async function rolesOf(driverId: string) {
  const { data } = await db.from("hub_roles").select("role,crew_id").eq("driver_id", driverId);
  return (data ?? []) as { role: string; crew_id: string | null }[];
}
async function leaderCrews(driverId: string) {
  const ids = (await rolesOf(driverId)).filter((r) => r.role === "crew_leader" && r.crew_id).map((r) => r.crew_id!);
  if (!ids.length) return [];
  const { data } = await db.from("crews").select("crew_id,name,tag").in("crew_id", ids).order("name");
  return (data ?? []) as { crew_id: string; name: string; tag: string }[];
}
const profileButton = row(linkButton("Create Your Driver Profile", `${SITE}/account/`));

function feedLabel(f: any, names: { crews: Record<string, string>; hosts: Record<string, string> }) {
  if (f.source === "vehicles") return "New vehicles";
  const src = f.source === "crew" ? `Crew: ${names.crews[f.crew_id] ?? "unknown crew"}`
    : f.source === "host" ? `Host: ${names.hosts[f.host_driver_id] ?? "unknown host"}` : "Public calendar";
  const filters = [...(f.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p), ...(f.event_types ?? []).map((t: string) => EVENT_TYPES[t] ?? t)];
  return filters.length ? `${src} · ${filters.join(" · ")}` : src;
}
async function feedsWithNames(guildId: string) {
  const { data } = await db.from("discord_feeds").select("*").eq("guild_id", guildId).order("created_at");
  const feeds = (data ?? []) as any[];
  const crewIds = [...new Set(feeds.map((f) => f.crew_id).filter(Boolean))];
  const hostIds = [...new Set(feeds.map((f) => f.host_driver_id).filter(Boolean))];
  const crews: Record<string, string> = {}, hosts: Record<string, string> = {};
  if (crewIds.length) for (const c of (await db.from("crews").select("crew_id,name,tag").in("crew_id", crewIds)).data ?? []) crews[c.crew_id] = `${c.name} [${c.tag}]`;
  if (hostIds.length) for (const d of (await db.from("drivers").select("driver_id,display_name").in("driver_id", hostIds)).data ?? []) hosts[d.driver_id] = d.display_name;
  return { feeds, names: { crews, hosts } };
}
const optionsLine = (f: any) => f.source === "vehicles" ? "One post per new vehicle, a summary when several arrive at once" : [
  `Server events: ${f.native_events ? "on" : "off"}`,
  `Reminders: ${REMINDERS[f.reminders] ?? f.reminders}`,
  ...(f.reminders !== "off" ? [`Mentions: ${f.mention_attendees ? "on" : "off"}`] : []),
].join(" · ");

async function cmdLeonida(i: any) {
  if (!i.guild_id) return ephemeral("This command only works on a server.");
  if (!canManage(i)) return ephemeral("Only members with the “Manage Server” permission can set up Leonida Racing feeds.");
  switch (subPath(i)) {
    case "feed add": return deferEphemeral(i, () => feedAdd(i));
    case "feed vehicles": return deferEphemeral(i, () => feedAdd(i, "vehicles"));
    case "feed list": return deferEphemeral(i, () => feedList(i));
    case "feed edit": return deferEphemeral(i, () => feedEdit(i));
    case "feed remove": return deferEphemeral(i, () => feedRemove(i));
  }
  return ephemeral("This action isn't available yet.");
}

async function feedAdd(i: any, forceSource?: string) {
  const channelId = String(opt(i, "channel") ?? "");
  const source = forceSource ?? String(opt(i, "source") ?? "");
  const platform = opt(i, "platform") as string | undefined;
  const eventType = opt(i, "event_type") as string | undefined;
  const nativeEvents = opt(i, "add_to_server_events") === true;
  const reminders = (opt(i, "reminders") as string | undefined) ?? "off";
  const mention = opt(i, "mention_attendees") === true;
  const who = discordId(i);

  const { count } = await db.from("discord_feeds").select("feed_id", { count: "exact", head: true }).eq("guild_id", i.guild_id);
  if ((count ?? 0) >= MAX_FEEDS_PER_SERVER) return { content: `This server already has ${MAX_FEEDS_PER_SERVER} feeds. Remove one with /leonida feed remove first.` };

  const row_: Record<string, unknown> = {
    guild_id: i.guild_id, channel_id: channelId, source,
    platforms: platform ? [platform] : null, event_types: eventType ? [eventType] : null,
    native_events: nativeEvents, reminders, mention_attendees: mention, created_by_discord_id: who,
  };
  let srcText = "the public calendar";
  const notes: string[] = [];
  if (source === "vehicles") {
    if (platform || eventType || nativeEvents || reminders !== "off" || mention) notes.push("Event options don't apply to vehicle feeds and were ignored.");
    Object.assign(row_, { platforms: null, event_types: null, native_events: false, reminders: "off", mention_attendees: false });
    srcText = "new vehicles";
  } else if (source === "public") {
    if (!platform) return { content: "Please choose a platform for the public calendar, so the channel only gets events you can join." };
  } else {
    const driver = await driverByDiscord(who);
    if (!driver) return { content: "To post your own events, link this Discord account to a Leonida Racing driver profile first.", components: [profileButton] };
    row_.created_by_driver_id = driver.driver_id;
    if (source === "crew") {
      const crews = await leaderCrews(driver.driver_id);
      if (!crews.length) return { content: "You need to be a crew leader on Leonida Racing to add a crew feed. You can apply on the website; a moderator reviews it.", components: [row(linkButton("Apply as Crew Leader", `${SITE}/account/crew/`))] };
      const picked = opt(i, "crew") as string | undefined;
      const crew = picked ? crews.find((c) => c.crew_id === picked) : crews.length === 1 ? crews[0] : undefined;
      if (!crew) return { content: picked ? "You don't lead that crew on Leonida Racing." : "You lead more than one crew. Pick one with the crew option." };
      row_.crew_id = crew.crew_id; srcText = `${crew.name} [${crew.tag}]`;
    } else if (source === "host") {
      if (!(await rolesOf(driver.driver_id)).some((r) => r.role === "event_host")) return { content: "You need the host role on Leonida Racing to add a host feed. You can apply on the website; a moderator reviews it.", components: [row(linkButton("Apply as Event Host", `${SITE}/account/events/`))] };
      row_.host_driver_id = driver.driver_id; srcText = `events hosted by ${driver.display_name}`;
    } else return { content: "Unknown source." };
  }

  // Can the bot post there? Test with the confirmation message itself.
  const filters = [platform && PLATFORMS[platform], eventType && EVENT_TYPES[eventType]].filter(Boolean).join(" · ");
  const post = await api(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify({
    allowed_mentions: { parse: [] },
    embeds: [{ color: YELLOW, description: source === "vehicles" ? `This channel now receives **${srcText}** via Leonida Racing.` : `This channel now receives events from **${srcText}**${filters ? ` (${filters})` : ""} via Leonida Racing.`, footer: { text: "Leonida Racing · leonidaracing.com" } }],
  }) });
  if (!post.ok) {
    console.log("feed add test post", post.status, await post.text());
    return { content: `I can't post in <#${channelId}>. Give Leonida Racing “View Channel”, “Send Messages” and “Embed Links” there, then try again.` };
  }
  const { error } = await db.from("discord_feeds").insert(row_);
  if (error) {
    if (error.code === "23505") return { content: `<#${channelId}> already has this feed.` };
    throw error;
  }
  if (source !== "vehicles" && nativeEvents && (BigInt(i.app_permissions ?? "0") & PERM_CREATE_EVENTS) === 0n) notes.push("Adding to server events is switched on, but Leonida Racing doesn't have the “Create Events” permission yet. Until it does, only the posts in the channel will appear.");
  if (source !== "vehicles" && mention && reminders === "off") notes.push("Mentions only apply to reminders, which are off for this feed.");
  return { content: [`Feed added: <#${channelId}> · ${srcText}${source !== "vehicles" && filters ? ` · ${filters}` : ""}.`, ...notes].join("\n") };
}

async function feedList(i: any) {
  const { feeds, names } = await feedsWithNames(i.guild_id);
  if (!feeds.length) return { content: "This server has no Leonida Racing feeds yet. Add one with /leonida feed add." };
  const lines = feeds.map((f, n) => `**${n + 1}.** <#${f.channel_id}> · ${feedLabel(f, names)}\n${optionsLine(f)}${f.last_error ? `\n⚠️ Last problem: ${clip(f.last_error, 150)}` : ""}`);
  return { content: clip(lines.join("\n\n"), 1900) };
}

async function feedOfGuild(i: any) {
  const id = String(opt(i, "feed") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await db.from("discord_feeds").select("*").eq("feed_id", id).eq("guild_id", i.guild_id).maybeSingle();
  return data as any;
}
async function feedEdit(i: any) {
  const f = await feedOfGuild(i);
  if (!f) return { content: "I couldn't find that feed on this server. Pick one from the suggestions while typing." };
  if (f.source === "vehicles") return { content: "Vehicle feeds have no options to change." };
  const patch: Record<string, unknown> = {};
  for (const [o, col] of [["add_to_server_events", "native_events"], ["reminders", "reminders"], ["mention_attendees", "mention_attendees"]]) { const v = opt(i, o); if (v !== undefined) patch[col] = v; }
  if (!Object.keys(patch).length) return { content: "Nothing to change. Pick at least one option." };
  patch.updated_at = new Date().toISOString();
  const { data: upd, error } = await db.from("discord_feeds").update(patch).eq("feed_id", f.feed_id).select("*").single();
  if (error) throw error;
  const { names } = await feedsWithNames(i.guild_id);
  const notes: string[] = [];
  if (upd.native_events && (BigInt(i.app_permissions ?? "0") & PERM_CREATE_EVENTS) === 0n) notes.push("Leonida Racing doesn't have the “Create Events” permission yet, so nothing will be added to your server events until it does.");
  return { content: [`Feed updated: <#${upd.channel_id}> · ${feedLabel(upd, names)}\n${optionsLine(upd)}`, ...notes].join("\n") };
}
async function feedRemove(i: any) {
  const f = await feedOfGuild(i);
  if (!f) return { content: "I couldn't find that feed on this server. Pick one from the suggestions while typing." };
  const { names } = await feedsWithNames(i.guild_id);
  // Remove the server events this feed created; posted cards stay in the channel.
  const { data: refs } = await db.from("discord_messages").select("scheduled_event_id").eq("feed_id", f.feed_id).not("scheduled_event_id", "is", null);
  for (const r of refs ?? []) if (r.scheduled_event_id !== "removed") await api(`/guilds/${i.guild_id}/scheduled-events/${r.scheduled_event_id}`, { method: "DELETE" });
  const { error } = await db.from("discord_feeds").delete().eq("feed_id", f.feed_id);
  if (error) throw error;
  return { content: `Feed removed: <#${f.channel_id}> · ${feedLabel(f, names)}. Posts already in the channel stay there.` };
}

async function feedAutocomplete(i: any) {
  const focused = leafOpts(i).find((o: any) => o.focused);
  const term = String(focused?.value ?? "").trim().toLowerCase();
  let choices: { name: string; value: string }[] = [];
  if (focused?.name === "crew") {
    const driver = await driverByDiscord(discordId(i));
    if (driver) choices = (await leaderCrews(driver.driver_id)).map((c) => ({ name: `${c.name} [${c.tag}]`, value: c.crew_id }));
  } else if (focused?.name === "feed" && i.guild_id && canManage(i)) {
    const [{ feeds, names }, ch] = await Promise.all([feedsWithNames(i.guild_id), api(`/guilds/${i.guild_id}/channels`).then((r) => r.ok ? r.json() : []).catch(() => [])]);
    const chName: Record<string, string> = {};
    for (const c of ch as any[]) chName[c.id] = c.name;
    choices = feeds.map((f) => ({ name: clip(`#${chName[f.channel_id] ?? f.channel_id} · ${feedLabel(f, names)}`, 100), value: f.feed_id }));
  }
  if (term) choices = choices.filter((c) => c.name.toLowerCase().includes(term));
  return json({ type: 8, data: { choices: choices.slice(0, 25) } });
}

// ---------- I'm in / Withdraw buttons (package 4) ----------
// custom_id "rsvp:in:<event_id>" / "rsvp:out:<event_id>" on the cards posted by
// discord-dispatch. Same rules as the website via rpc discord_rsvp. The card's
// "Going" count is refreshed by discord-dispatch within about a minute.
async function rsvpButton(i: any) {
  const [, action, eventId] = String(i.data?.custom_id ?? "").split(":");
  if (!/^[0-9a-f-]{36}$/.test(eventId ?? "")) return ephemeral("This button doesn't work anymore.");
  const { data, error } = await db.rpc("discord_rsvp", { p_event: eventId, p_discord_id: discordId(i), p_going: action === "in" });
  if (error) throw error;
  const r = data as any;
  const count = r.max ? `${r.going} / ${r.max}` : `${r.going}`;
  // Ways to reach the host (Fausto 2026-10-04): Discord invite and/or PSN profile page
  // (friend request straight from the PlayStation app or browser).
  const reach: unknown[] = [];
  if (r.discord_url) reach.push(linkButton("Host Discord", r.discord_url));
  if (r.host_name) reach.push(linkButton("Host PSN Profile", `https://profile.playstation.com/${encodeURIComponent(r.host_name)}`));
  reach.push(linkButton("Details", `${SITE}/community/events/#event-${eventId}`));
  const hostRow = [row(...reach)];
  const psn = r.host_name ? ` Host on PSN: **${r.host_name}** (send a friend request via the button below).` : "";
  switch (r.status) {
    case "no_profile": return ephemeral("To sign up, create your Leonida Racing driver profile first. It uses this Discord account, so it takes one click. Then press \u201cI'm in\u201d again.", [profileButton]);
    case "not_found": return ephemeral("This event isn't available anymore.");
    case "in": return ephemeral(`You're in for **${r.title}** \u2014 ${count} going.${psn}${r.discord_url ? " Join the host's Discord for the lobby invite." : ""}`, hostRow);
    case "already": return ephemeral(`You're already in for **${r.title}** (${count} going).${psn}`, hostRow);
    case "out": return ephemeral(`You're no longer signed up for **${r.title}**.`);
    case "not_in": return ephemeral(`You weren't signed up for **${r.title}**.`);
    case "full": return ephemeral(`Sorry, **${r.title}** is full (${count}).`);
    case "closed": return ephemeral(`Sign-ups for **${r.title}** are closed.`);
    case "cancelled": return ephemeral(`**${r.title}** has been cancelled.`);
    case "past": return ephemeral(`**${r.title}** is already over.`);
  }
  return ephemeral("This action isn't available yet.");
}

// ---------- /ping ----------
async function cmdPing(i: any) {
  if (!OFFICIAL_GUILD || i.guild_id !== OFFICIAL_GUILD) return ephemeral("This one only works on the Leonida Racing server.");
  const { data: ids } = await db.from("discord_bot_state").select("value").eq("key", "role_ids").maybeSingle();
  let hostRole = ""; try { hostRole = JSON.parse(ids?.value ?? "{}").event_host ?? ""; } catch { /* none */ }
  const roles: string[] = i.member?.roles ?? [];
  if (!hostRole || !roles.includes(hostRole)) return ephemeral("This one is for Verified Event Hosts. Get your Event Host role confirmed on Leonida Racing: My Account \u2192 Events.");
  if (!PING_CHANNELS.includes(i.channel_id)) return ephemeral("Use /ping in #events or #playlists to reach your crowd.");
  const t = PING_TARGETS[String(opt(i, "audience") ?? "")];
  const text = String(opt(i, "message") ?? "").trim();
  if (!t || !text) return ephemeral("Pick who to ping and add a short message.");
  const key = `ping_last:${discordId(i)}`;
  const { data: last } = await db.from("discord_bot_state").select("value").eq("key", key).maybeSingle();
  const lastAt = last ? Number(last.value) : 0;
  if (Date.now() - lastAt < PING_COOLDOWN_MS) return ephemeral(`Easy on the horn. You can ping again <t:${Math.floor((lastAt + PING_COOLDOWN_MS) / 1000)}:R>.`);
  await db.from("discord_bot_state").upsert({ key, value: String(Date.now()), updated_at: new Date().toISOString() });
  // Public reply: Discord shows "<host> used /ping" above it. Only the chosen role is pinged.
  return json({ type: 4, data: { content: clip(`<@&${t.role}> ${text}`, 2000), allowed_mentions: { parse: [], roles: [t.role] } } });
}

// ---------- LFG (DEC-0111) ----------
const LFG_CHANNEL = "1560406598512418920", LFG_CATEGORY = "1557675799585234944", LFG_ROLE = "1560309891086811157";
const LFG_MAX = 3;
const LFG_ACTIVITIES: Record<string, { label: string; emoji: string }> = {
  race: { label: "Race", emoji: "\u{1F3C1}" }, playlist: { label: "Playlist", emoji: "\u{1F4CB}" }, "car-meet": { label: "Car Meet", emoji: "\u{1F697}" },
  cruise: { label: "Cruise", emoji: "\u{1F6E3}\ufe0f" }, photo: { label: "Photo Session", emoji: "\u{1F4F8}" }, job: { label: "Job", emoji: "\u{1F4BC}" },
};
const LFG_PLAYERS: Record<string, string> = { "2-4": "2\u20134 players", "5-8": "5\u20138 players", "9+": "9+ players" };
const PERM_MANAGE_CHANNELS = 1n << 4n, PERM_MANAGE_MESSAGES = 1n << 13n;
const isMod = (i: any) => { const p = BigInt(i.member?.permissions ?? "0"); return (p & (PERM_ADMIN | PERM_MANAGE_GUILD | PERM_MANAGE_CHANNELS | PERM_MANAGE_MESSAGES)) !== 0n; };
async function lfgCard(l: any) {
  const a = LFG_ACTIVITIES[l.activity] ?? { label: l.activity, emoji: "" };
  const host = await driverByDiscord(l.host_discord_id);
  const { data: psn } = host ? await db.from("drivers").select("psn_name").eq("driver_id", host.driver_id).maybeSingle() : { data: null };
  const people: string[] = l.participants ?? [];
  const voiceUrl = `https://discord.com/channels/${l.guild_id}/${l.voice_channel_id}`;
  return {
    content: "", allowed_mentions: { parse: [] },
    embeds: [{
      title: `${a.emoji} ${a.label} \u00b7 looking for ${LFG_PLAYERS[l.players] ?? l.players}`, color: YELLOW,
      description: `Hop in ${l.voice_channel_id ? `<#${l.voice_channel_id}>` : "the voice"} and say hi.\nEnds <t:${unix(l.expires_at)}:R>.`,
      fields: [
        { name: "Host", value: `<@${l.host_discord_id}>${psn?.psn_name ? `\nPSN: ${psn.psn_name}` : ""}`, inline: true },
        { name: `In (${people.length})`, value: clip(people.map((u) => `<@${u}>`).join(" ") || "\u2014", 1000), inline: true },
      ],
      footer: { text: `Leonida Racing \u00b7 LFG ${l.slot} of ${LFG_MAX}` },
    }],
    components: [row(
      { type: 2, style: 3, label: "Join", custom_id: `lfg:join:${l.lfg_id}` },
      { type: 2, style: 2, label: "Leave", custom_id: `lfg:leave:${l.lfg_id}` },
      ...(l.voice_channel_id ? [linkButton("Open voice", voiceUrl)] : []),
      { type: 2, style: 4, label: "Close", custom_id: `lfg:close:${l.lfg_id}` },
    )],
  };
}
const lfgEndingCard = (l: any) => ({
  content: "", allowed_mentions: { parse: [] }, components: [],
  embeds: [{ title: `${LFG_ACTIVITIES[l.activity]?.label ?? l.activity} \u00b7 wrapping up`, color: 0x5c5c6e, description: "This search is closing. The voice disappears in a minute." }],
});
const lfgActivityMenu = () => [{ type: 1, components: [{ type: 3, custom_id: "lfg:act", placeholder: "What are you up for?",
  options: Object.entries(LFG_ACTIVITIES).map(([value, a]) => ({ label: a.label, value })) }] }];
async function lfgComponent(i: any) {
  if (!OFFICIAL_GUILD || i.guild_id !== OFFICIAL_GUILD) return ephemeral("LFG only works on the Leonida Racing server.");
  const [, action, arg] = String(i.data?.custom_id ?? "").split(":");
  const uid = discordId(i);
  if (action === "new") {
    if (!(await driverByDiscord(uid))) return ephemeral("Starting a search needs a Leonida Racing account (it's one click with Discord). Joining others works without.", [profileButton]);
    const { data: own } = await db.from("discord_lfg").select("lfg_id").eq("host_discord_id", uid).maybeSingle();
    if (own) return ephemeral("You already have a search running. Close it first, then start a new one.");
    const { count } = await db.from("discord_lfg").select("lfg_id", { count: "exact", head: true }).eq("guild_id", i.guild_id);
    if ((count ?? 0) >= LFG_MAX) return ephemeral(`All ${LFG_MAX} LFG slots are taken right now. Jump into one of them, or check back soon.`);
    return reply({ content: "What are you up for? You start right away, the search runs for 3 hours.", flags: 64, components: lfgActivityMenu() });
  }
  if (action === "act") {
    const act = String(i.data?.values?.[0] ?? "");
    if (!LFG_ACTIVITIES[act]) return json({ type: 7, data: { content: "Pick an activity.", components: lfgActivityMenu() } });
    return json({ type: 7, data: { content: `**${LFG_ACTIVITIES[act].label}**. How many players are you looking for?`, components: [{ type: 1, components: [{ type: 3, custom_id: `lfg:ply:${act}`, placeholder: "Players",
      options: Object.entries(LFG_PLAYERS).map(([value, label]) => ({ label, value })) }] }] } });
  }
  if (action === "ply") return lfgCreate(i, arg, String(i.data?.values?.[0] ?? ""));
  const id = arg ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return ephemeral("This button doesn't work anymore.");
  if (action === "close") {
    const { data: l } = await db.from("discord_lfg").select("*").eq("lfg_id", id).maybeSingle();
    if (!l || l.closing) return ephemeral("This search is already over.");
    if (l.host_discord_id !== uid && !isMod(i)) return ephemeral("Only the host or a moderator can close this search.");
    await db.from("discord_lfg").update({ expires_at: new Date().toISOString() }).eq("lfg_id", id);
    return json({ type: 7, data: lfgEndingCard(l) });
  }
  if (action === "join" || action === "leave") {
    const { data: r, error } = await db.rpc("discord_lfg_join", { p_lfg: id, p_user: uid, p_join: action === "join" });
    if (error) throw error;
    const st = (r as any).status;
    if (st === "gone") return ephemeral("This search is already over.");
    if (st === "already") return ephemeral("You're already in. See you in the voice.");
    if (st === "not_in") return ephemeral("You weren't in this one.");
    if (st === "ended") return json({ type: 7, data: lfgEndingCard(r) });
    return json({ type: 7, data: await lfgCard(r) });
  }
  return ephemeral("This button doesn't work anymore.");
}
function lfgCreate(i: any, act: string, players: string) {
  const uid = discordId(i);
  const done = (content: string, components: unknown[] = []) => fetch(`https://discord.com/api/v10/webhooks/${APP_ID}/${i.token}/messages/@original`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, components, allowed_mentions: { parse: [] } }) });
  bg((async () => {
    if (!LFG_ACTIVITIES[act] || !LFG_PLAYERS[players]) return void await done("Something was missing. Hit Find Players again.");
    if (!(await driverByDiscord(uid))) return void await done("Starting a search needs a Leonida Racing account.", [profileButton]);
    const { data: c, error } = await db.rpc("discord_lfg_create", { p_guild: i.guild_id, p_channel: LFG_CHANNEL, p_host: uid, p_activity: act, p_players: players, p_max: LFG_MAX });
    if (error) throw error;
    const res = c as any;
    if (res.status === "own") return void await done("You already have a search running. Close it first, then start a new one.");
    if (res.status === "limit") return void await done(`All ${LFG_MAX} LFG slots just filled up. Jump into one of them, or try again soon.`);
    const fail = async (what: string, r: Response) => {
      console.log("lfg create failed", what, r.status, await r.text());
      await db.from("discord_lfg").delete().eq("lfg_id", res.lfg_id);
      await done("Couldn't set up your lobby. Please try again in a moment.");
    };
    const v = await api(`/guilds/${i.guild_id}/channels`, { method: "POST", headers: { "X-Audit-Log-Reason": "LFG" }, body: JSON.stringify({
      name: `\u{1F3AE} LFG ${res.slot} \u00b7 ${LFG_ACTIVITIES[act].label}`, type: 2, parent_id: LFG_CATEGORY }) });
    if (!v.ok) return void await fail("voice", v);
    const voice = (await v.json()).id;
    const { data: l } = await db.from("discord_lfg").update({ voice_channel_id: voice }).eq("lfg_id", res.lfg_id).select("*").single();
    const card = await lfgCard(l);
    const m = await api(`/channels/${LFG_CHANNEL}/messages`, { method: "POST", body: JSON.stringify({ ...card, content: `<@&${LFG_ROLE}>`, allowed_mentions: { parse: [], roles: [LFG_ROLE] } }) });
    if (!m.ok) { await api(`/channels/${voice}`, { method: "DELETE" }); return void await fail("card", m); }
    await db.from("discord_lfg").update({ message_id: (await m.json()).id }).eq("lfg_id", res.lfg_id);
    await done(`You're live. Your voice: <#${voice}>. People who hit Join show up on the card.`, [row(linkButton("Open voice", `https://discord.com/channels/${i.guild_id}/${voice}`))]);
  })().catch(async (e) => { console.error("lfg", e); await done("Something went wrong on our side. Please try again in a moment."); }));
  return json({ type: 6 });
}

// ---------- role picker ----------
function rolePicker(i: any) {
  if (!OFFICIAL_GUILD || i.guild_id !== OFFICIAL_GUILD) return ephemeral("This menu only works on the Leonida Racing server.");
  const group = String(i.data?.custom_id ?? "").slice("roles:".length);
  const allowed = ROLE_GROUPS[group];
  if (!allowed) return ephemeral("This menu doesn't work anymore.");
  const picked: string[] = (i.data?.values ?? []).filter((v: string) => allowed.includes(v));
  const has: string[] = i.member?.roles ?? [];
  const add = picked.filter((r) => !has.includes(r));
  const remove = allowed.filter((r) => has.includes(r) && !picked.includes(r));
  const uid = discordId(i);
  return deferEphemeral(i, async () => {
    const { data: g } = await api(`/guilds/${OFFICIAL_GUILD}/roles`).then(async (r) => ({ data: r.ok ? await r.json() : [] }));
    const name = (id: string) => (g as any[]).find((x) => x.id === id)?.name ?? "role";
    const failed: string[] = [];
    for (const r of add) { const res = await api(`/guilds/${OFFICIAL_GUILD}/members/${uid}/roles/${r}`, { method: "PUT", headers: { "X-Audit-Log-Reason": "Role picker" } }); if (!res.ok) failed.push(name(r)); }
    for (const r of remove) { const res = await api(`/guilds/${OFFICIAL_GUILD}/members/${uid}/roles/${r}`, { method: "DELETE", headers: { "X-Audit-Log-Reason": "Role picker" } }); if (!res.ok) failed.push(name(r)); }
    if (failed.length) console.log("role picker failed", group, failed);
    if (!add.length && !remove.length) return { content: "Nothing changed – you already had exactly that." };
    const parts = [add.length ? `Added: ${add.map(name).join(", ")}` : "", remove.length ? `Removed: ${remove.map(name).join(", ")}` : ""].filter(Boolean);
    return { content: failed.length ? `Some roles didn't stick (${failed.join(", ")}). Try again in a moment.` : `Done. ${parts.join(" · ")}` };
  });
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Leonida Racing Discord bot", { status: 200 });
  const body = await req.text();
  if (!(await verify(req, body))) return new Response("invalid request signature", { status: 401 });
  const i = JSON.parse(body);

  if (i.type === 1) { // PING (Discord verifies the endpoint) -> also refresh the command list
    bg(registerCommands());
    return json({ type: 1 });
  }
  if (!commandsChecked) { commandsChecked = true; bg(registerCommandsIfChanged()); }
  try {
    if (i.type === 4) return i.data?.name === "leonida" ? await feedAutocomplete(i) : await autocomplete(i);
    if (i.type === 3 && String(i.data?.custom_id ?? "").startsWith("rsvp:")) return await rsvpButton(i);
    if (i.type === 3 && String(i.data?.custom_id ?? "").startsWith("roles:")) return rolePicker(i);
    if (i.type === 3 && String(i.data?.custom_id ?? "").startsWith("lfg:")) return await lfgComponent(i);
    if (i.type === 2) {
      switch (i.data?.name) {
        case "events": return await cmdEvents(i);
        case "event": return await cmdEvent(i);
        case "car": return await cmdCar(i);
        case "compare": return await cmdCompare(i);
        case "crew": return await cmdCrew(i);
        case "create-event": return cmdCreateEvent();
        case "leonida": return await cmdLeonida(i);
        case "ping": return await cmdPing(i);
      }
    }
    return ephemeral("This action isn't available yet.");
  } catch (err) {
    console.error(err);
    return ephemeral("Something went wrong on our side. Please try again in a moment.");
  }
});
