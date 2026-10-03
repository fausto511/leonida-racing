// discord-interactions -- HTTP endpoint for the Leonida Racing Discord bot
// (RS-0067, DEC-0098, spec: Claude outputs/SPEC-Discord-Bot-Phase-1-2026-10-04.md).
//
// Discord calls this URL for every slash command, autocomplete and button.
// No JWT (Discord can't send one): every request is authenticated by the
// Ed25519 signature Discord puts on it, checked against the app's PUBLIC key
// (not a secret). Data is read server-side with the service role, but only
// what the website shows publicly (published events, Garage vehicles). Website + DB stay the single source of truth.
//
// Package 1: /events, /event, /car, /create-event. On Discord's verification
// PING (sent when the Interactions Endpoint URL is saved) the global command
// list is (re)registered with the bot token -- idempotent bulk overwrite.
//
// COPY STATUS: all user-facing texts are Claude placeholders, Codex review pending.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_KEY = "5aef5b94df1e1470f44ce3f5eac2e53618c6582759ebe295d9745eeceeb0cfe6";
const APP_ID = "1552506662533861376";
const SITE = "https://leonidaracing.com";
const INVITE = `https://discord.com/oauth2/authorize?client_id=${APP_ID}`;
const YELLOW = 0xffd74c;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const EVENT_TYPES: Record<string, string> = { race: "Race", "time-attack": "Time Attack", league: "League", "car-meet": "Car Meet", cruise: "Cruise", other: "Other" };
const PLATFORMS: Record<string, string> = { ps5: "PS5", xbox: "Xbox Series X|S" };

// While testing (package 1-6) commands are visible to members with "Manage Server" only.
// Package 7 opens /events, /event, /car to everyone.
const TEST_PERMS = "32";
const COMMANDS = [
  { name: "events", description: "Upcoming GTA VI events from the Leonida Racing calendar", default_member_permissions: TEST_PERMS, dm_permission: false,
    options: [
      { type: 3, name: "type", description: "Event type", required: false, choices: Object.entries(EVENT_TYPES).map(([value, name]) => ({ name, value })) },
      { type: 3, name: "platform", description: "Platform", required: false, choices: Object.entries(PLATFORMS).map(([value, name]) => ({ name, value })) },
    ] },
  { name: "event", description: "Show one event", default_member_permissions: TEST_PERMS, dm_permission: false,
    options: [{ type: 3, name: "event", description: "Start typing the event name", required: true, autocomplete: true }] },
  { name: "car", description: "Vehicle card from The Garage", default_member_permissions: TEST_PERMS, dm_permission: false,
    options: [{ type: 3, name: "vehicle", description: "Start typing a make or model", required: true, autocomplete: true }] },
  { name: "create-event", description: "Create an event on Leonida Racing", default_member_permissions: TEST_PERMS, dm_permission: false },
];

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
const opt = (i: any, name: string) => i.data?.options?.find((o: any) => o.name === name)?.value;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function registerCommands() {
  if (!DISCORD_BOT_TOKEN) return;
  const r = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(COMMANDS),
  });
  console.log("register commands", r.status, r.ok ? "" : await r.text());
}

// ---------- data ----------
const EVENT_COLS = "event_id,title,event_type,starts_at,ends_at,platforms,host_name,status,max_participants,registration,discord_url,host:crews(name,tag,discord_url)";
async function upcomingEvents(type?: string, platform?: string, limit = 5) {
  let q = db.from("hub_events").select(EVENT_COLS).eq("is_published", true).neq("status", "cancelled")
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
const eventUrl = (e: any) => `${SITE}/hub/events/#event-${e.event_id}`;
const hostLabel = (e: any) => e.host?.name ? `${e.host.name}${e.host.tag ? ` [${e.host.tag}]` : ""}` : (e.host_name ?? "Community host");

async function eventEmbed(e: any) {
  const going = await goingCount(e.event_id);
  const fields = [
    { name: "Starts", value: `<t:${unix(e.starts_at)}:F>\n<t:${unix(e.starts_at)}:R>`, inline: true },
    { name: "Type", value: EVENT_TYPES[e.event_type] ?? e.event_type, inline: true },
    { name: "Platform", value: (e.platforms ?? []).map((p: string) => PLATFORMS[p] ?? p).join(", ") || "—", inline: true },
    { name: "Host", value: hostLabel(e), inline: true },
    { name: "Going", value: e.max_participants ? `${going} / ${e.max_participants}` : String(going), inline: true },
  ];
  if (e.registration === "closed") fields.push({ name: "Sign-ups", value: "Closed", inline: true });
  return {
    title: clip(e.title, 256), url: eventUrl(e), color: YELLOW, fields,
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
    return reply({ content: `No upcoming events${what ? ` (${what})` : ""} right now.`, components: [row(linkButton("Open the calendar", `${SITE}/hub/events/`), addButton)] });
  }
  const lines = list.map((e) => `**[${clip(e.title, 80)}](${eventUrl(e)})**\n<t:${unix(e.starts_at)}:f> · <t:${unix(e.starts_at)}:R> · ${EVENT_TYPES[e.event_type] ?? e.event_type} · ${hostLabel(e)}`);
  return reply({
    embeds: [{ title: `Upcoming events${what ? ` · ${what}` : ""}`, description: lines.join("\n\n"), color: YELLOW, footer: { text: "Leonida Racing · times shown in your time zone" } }],
    components: [row(linkButton("Full calendar", `${SITE}/hub/events/`), addButton)],
  });
}

async function cmdEvent(i: any) {
  const id = String(opt(i, "event") ?? "");
  const { data: e } = await db.from("hub_events").select(EVENT_COLS).eq("event_id", id).eq("is_published", true).maybeSingle();
  if (!e) return ephemeral("I couldn't find that event. Pick one from the suggestions while typing.");
  return reply({ embeds: [await eventEmbed(e)], components: [row(linkButton("Details", eventUrl(e)), addButton)] });
}

async function cmdCar(i: any) {
  const id = String(opt(i, "vehicle") ?? "");
  const { data: v } = await db.from("vehicles").select("vehicle_id,make,model,classes,drive,seats,real_life_inspiration,first_seen_in,has_photo").eq("vehicle_id", id).maybeSingle();
  if (!v) return ephemeral("I couldn't find that vehicle. Pick one from the suggestions while typing.");
  const url = `${SITE}/garage/vehicles/${v.vehicle_id}/`;
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
    let q = db.from("hub_events").select("event_id,title,starts_at").eq("is_published", true).neq("status", "cancelled")
      .gte("starts_at", new Date(Date.now() - 3 * 3600e3).toISOString()).order("starts_at").limit(25);
    if (term) q = q.ilike("title", `%${term}%`);
    const { data } = await q;
    choices = (data ?? []).map((e: any) => ({ name: clip(`${e.title} · ${new Date(e.starts_at).toISOString().slice(0, 10)}`, 100), value: e.event_id }));
  } else if (i.data?.name === "car") {
    let q = db.from("vehicles").select("vehicle_id,make,model").order("make").order("model").limit(25);
    if (term) q = q.or(`model.ilike.%${term.replace(/[,()%]/g, "")}%,make.ilike.%${term.replace(/[,()%]/g, "")}%`);
    const { data } = await q;
    choices = (data ?? []).map((v: any) => ({ name: clip(`${v.make} ${v.model}`, 100), value: v.vehicle_id }));
  }
  return json({ type: 8, data: { choices } });
}

// ---------- entry ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Leonida Racing Discord bot", { status: 200 });
  const body = await req.text();
  if (!(await verify(req, body))) return new Response("invalid request signature", { status: 401 });
  const i = JSON.parse(body);

  if (i.type === 1) { // PING (Discord verifies the endpoint) -> also refresh the command list
    // @ts-ignore EdgeRuntime is provided by Supabase
    try { EdgeRuntime.waitUntil(registerCommands()); } catch { registerCommands(); }
    return json({ type: 1 });
  }
  try {
    if (i.type === 4) return await autocomplete(i);
    if (i.type === 2) {
      switch (i.data?.name) {
        case "events": return await cmdEvents(i);
        case "event": return await cmdEvent(i);
        case "car": return await cmdCar(i);
        case "create-event": return cmdCreateEvent();
      }
    }
    return ephemeral("This action isn't available yet.");
  } catch (err) {
    console.error(err);
    return ephemeral("Something went wrong on our side. Please try again in a moment.");
  }
});
