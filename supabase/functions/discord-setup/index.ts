// discord-setup -- TEMPORARY (RS-0071, DEC-0129). One-off setup of roles and
// permissions on the official Leonida Racing Discord server.
// Auth: job token "discord-setup" (private.job_tokens) -> verify_jwt off.
// POST {"action": ...}
//   inspect -- read-only snapshot; the FIRST one is kept in discord_bot_state
//              'setup_snapshot' (never overwritten) for restore.
//   plan    -- computes every change against the live server, changes nothing.
//   apply   -- creates missing roles, then runs the same list. Optional
//              {"skip": ["<op key>", ...]} to leave single changes out.
//   restore -- puts roles (name, colour, hoist, mentionable, permissions),
//              channel overwrites and slowmode back to the snapshot, deletes roles
//              created here, disables onboarding. A deleted role is recreated
//              without members.
// Texts in ROLES_TEXT / VERIFY_TEXT / onboarding: placeholders until Codex tone review (2nd round 15.10.).
// Delete this function and its job token when the setup is done.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = Deno.env.get("DISCORD_BOT_TOKEN") ?? "";
const GUILD = Deno.env.get("DISCORD_GUILD_ID") ?? "";
const SITE = "https://leonidaracing.com";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b, null, 1), { status: s, headers: { "Content-Type": "application/json" } });

async function discord(method: string, path: string, body?: unknown) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(`https://discord.com/api/v10${path}`, {
      method, headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "X-Audit-Log-Reason": "Leonida Racing setup (RS-0071)" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (r.status === 429) { await sleep(Math.min(10, Number(data?.retry_after ?? 1)) * 1000 + 150); continue; }
    return { ok: r.ok, status: r.status, data, text };
  }
  return { ok: false, status: 429, data: null, text: "rate limited" };
}

// ---------- permission bits ----------
const b = (n: number) => 1n << BigInt(n);
const P = {
  INVITE: b(0), KICK: b(1), BAN: b(2), ADMIN: b(3), MANAGE_CH: b(4), REACT: b(6), PRIO_SPK: b(8), STREAM: b(9),
  VIEW: b(10), SEND: b(11), EMBED: b(14), ATTACH: b(15), HISTORY: b(16), MENTION_ALL: b(17), EXT_EMOJI: b(18),
  CONNECT: b(20), SPEAK: b(21), MUTE: b(22), DEAFEN: b(23), MOVE: b(24), VAD: b(25), APP_CMDS: b(31), REQ_SPEAK: b(32),
  PUB_THREADS: b(35), PRIV_THREADS: b(36), EXT_STICKERS: b(37), SEND_IN_THREADS: b(38), ACTIVITIES: b(39),
  POLLS: b(49), EXT_APPS: b(50),
};
const NAMES: Record<string, string> = { INVITE: "create invite", REACT: "add reactions", PRIO_SPK: "priority speaker", STREAM: "video", VIEW: "view channel", SEND: "send messages", EMBED: "embed links", ATTACH: "attach files", HISTORY: "read history", MENTION_ALL: "mention @everyone/roles", EXT_EMOJI: "external emojis", CONNECT: "connect", SPEAK: "speak", MUTE: "mute members", DEAFEN: "deafen members", MOVE: "move members", VAD: "voice activity", APP_CMDS: "use app commands", REQ_SPEAK: "request to speak", PUB_THREADS: "create public threads", PRIV_THREADS: "create private threads", EXT_STICKERS: "external stickers", SEND_IN_THREADS: "send in threads", ACTIVITIES: "use activities", POLLS: "create polls", EXT_APPS: "use external apps", KICK: "kick", BAN: "ban", MANAGE_CH: "manage channels" };
const bitsText = (v: bigint) => {
  const out: string[] = [];
  for (const [k, bit] of Object.entries(P)) if (v & bit) out.push(NAMES[k] ?? k);
  const rest = v & ~Object.values(P).reduce((a, x) => a | x, 0n);
  if (rest) out.push(`other bits ${rest}`);
  return out.join(", ") || "nothing";
};
// Feature rights decided ONLY at server level (base for everyone, extras for verified):
const FEATURE = P.EMBED | P.ATTACH | P.EXT_EMOJI | P.EXT_STICKERS | P.ACTIVITIES | P.POLLS | P.EXT_APPS | P.APP_CMDS;
const VERIFIED_BITS = P.EMBED | P.EXT_EMOJI | P.POLLS | P.ACTIVITIES; // Fausto 15.10.
const EVERYONE_ADD = P.INVITE | P.ATTACH | P.APP_CMDS | P.CONNECT | P.SPEAK | P.VAD | P.STREAM | P.REQ_SPEAK | P.PUB_THREADS;
const EVERYONE_REMOVE = P.POLLS | P.EXT_APPS | P.ACTIVITIES | P.EMBED | P.EXT_EMOJI | P.EXT_STICKERS;

// ---------- ids from the snapshot of 15.10.2026 ----------
const R = {
  organizer: "878766970584059935", bots: "881874381704421397", eventHost: "878767261274472508", playlistHost: "878768435574743080",
  crewLeader: "1557446185634111629", creator: "878774874661851177", editor: "882407210431422495", streamer: "879339204700680213",
  hotlap: "883341703224885348", troublemaker: "879169819688190012", registered: "1557590285129883801",
  europe: "878780420668416021", na: "878780421133963285", sa: "878780421553401916", oceania: "878780422404845578",
  eventPing: "893112573237526588", playlistPing: "893112193678209054",
  english: "878755376567291966", german: "878766594757640212", spanish: "878766380529377380", french: "878766639217266798",
  italiano: "1557687190983802880", portugues: "1557686877967093832",
};
const C = {
  startHere: "878747845858066454", rules: "1557671510745808937", roles: "878748648878522478", updates: "878753922532130816",
  timeAttack: "1560026940180533390", events: "878750571128053841", playlists: "896757714766675968", chat: "878762134358597632",
  carTalk: "1560274776713334856", voiceChat: "878764019207516192", organizers: "878766014580547654", jobCreators: "879338911086825512",
  suggest: "878775221849563217", content: "882251557528281169", snapmatics: "879336563388088320", streams: "878793454644256859",
  crews: "878761667742302218", feedback: "1557733234144448642",
};
// Roles this setup creates (looked up by name, so a second run does not duplicate them).
const NEW_ROLES = [
  { key: "vCrewLeader", name: "Verified Crew Leader", color: 0xF24B9D, hoist: true, perms: VERIFIED_BITS },
  { key: "vEventHost", name: "Verified Event Host", color: 0xD9F58E, hoist: true, perms: VERIFIED_BITS },
  { key: "vCreator", name: "Verified Creator", color: 0xFF9F43, hoist: true, perms: VERIFIED_BITS },
  { key: "asia", name: "Asia", color: 0x9B59B6, hoist: true, perms: 0n },
  { key: "africa", name: "Africa", color: 0xE67E22, hoist: true, perms: 0n },
  { key: "middleEast", name: "Middle East", color: 0x1ABC9C, hoist: true, perms: 0n },
  { key: "ps", name: "PlayStation", color: 0x0070D1, hoist: false, perms: 0n },
  { key: "xbox", name: "Xbox", color: 0x107C10, hoist: false, perms: 0n },
  { key: "pc", name: "PC", color: 0x99AAB5, hoist: false, perms: 0n },
  { key: "lfgPing", name: "LFG Pings", color: 0, hoist: false, perms: 0n },
];
const RENAME: Record<string, string> = { [R.eventPing]: "Event Pings", [R.playlistPing]: "Playlist Pings" };
const UNHOIST = [R.eventHost, R.playlistHost, R.crewLeader, R.creator, R.editor, R.streamer];
const SLOWMODE_S = 6 * 3600;

type Op = { key: string; desc: string; method: string; path: string; body?: unknown };

async function live() {
  const g = await discord("GET", `/guilds/${GUILD}`);
  const ch = await discord("GET", `/guilds/${GUILD}/channels`);
  if (!g.ok || !ch.ok) throw new Error(`read failed: guild ${g.status} channels ${ch.status}`);
  return { roles: g.data.roles as any[], channels: ch.data as any[], everyoneId: g.data.id as string };
}

function build(L: Awaited<ReturnType<typeof live>>, nid: Record<string, string>): Op[] {
  const ops: Op[] = [];
  const role = (id: string) => L.roles.find((r) => r.id === id);
  const rname = (id: string) => (id === L.everyoneId ? "@everyone" : role(id)?.name ?? Object.entries(nid).find(([, v]) => v === id)?.[0] ?? id);
  const managedOrBot = new Set(L.roles.filter((r) => r.managed).map((r) => r.id).concat([R.bots]));
  const verified = new Set([nid.vCrewLeader, nid.vEventHost, nid.vCreator, R.registered]); // Hotlap Ace = badge only, no own rights

  // 1. server-level role permissions + cosmetics
  for (const r of L.roles) {
    if (r.id === R.troublemaker) continue;
    if (managedOrBot.has(r.id) || r.id === R.organizer) continue;
    const cur = BigInt(r.permissions);
    let want: bigint;
    if (r.id === L.everyoneId) want = (cur & ~EVERYONE_REMOVE) | EVERYONE_ADD;
    else if (verified.has(r.id)) want = VERIFIED_BITS;
    else want = 0n;
    const patch: any = {};
    const why: string[] = [];
    if (want !== cur) {
      patch.permissions = want.toString();
      const add = want & ~cur, del = cur & ~want;
      why.push(`permissions${add ? ` +[${bitsText(add)}]` : ""}${del ? ` -[${bitsText(del)}]` : ""}`);
    }
    if (RENAME[r.id] && r.name !== RENAME[r.id]) { patch.name = RENAME[r.id]; why.push(`rename to "${RENAME[r.id]}"`); }
    if (RENAME[r.id] && r.mentionable) { patch.mentionable = false; why.push("not mentionable by everyone"); }
    if (UNHOIST.includes(r.id) && r.hoist) { patch.hoist = false; why.push("no longer shown separately (Verified is)"); }
    if (Object.keys(patch).length) ops.push({ key: `role:${r.id}`, desc: `Role "${r.name}": ${why.join("; ")}`, method: "PATCH", path: `/guilds/${GUILD}/roles/${r.id}`, body: patch });
  }
  if (role(R.troublemaker)) ops.push({ key: `delete:${R.troublemaker}`, desc: `Delete role "Troublemaker" (use the log channel instead)`, method: "DELETE", path: `/guilds/${GUILD}/roles/${R.troublemaker}` });

  // 2. role order (only roles below the bot's own role are sent)
  const top = L.roles.filter((r) => r.managed && r.tags?.bot_id && r.name === "Leonida Racing")[0];
  const order = L.roles.filter((r) => r.id !== L.everyoneId && r.id !== R.troublemaker && r.id !== top?.id).sort((a, b2) => b2.position - a.position).map((r) => r.id);
  const vIds = [nid.vCrewLeader, nid.vEventHost, nid.vCreator];
  const moved = [...vIds, nid.asia, nid.africa, nid.middleEast, nid.ps, nid.xbox, nid.pc, nid.lfgPing];
  let wanted = order.filter((id) => !moved.includes(id));
  const insertAfter = (after: string, ids: string[]) => { const i = wanted.indexOf(after); wanted = i < 0 ? [...wanted, ...ids] : [...wanted.slice(0, i + 1), ...ids, ...wanted.slice(i + 1)]; };
  insertAfter(R.organizer, vIds);
  insertAfter(R.oceania, [nid.asia, nid.africa, nid.middleEast, nid.ps, nid.xbox, nid.pc]);
  insertAfter(R.playlistPing, [nid.lfgPing]);
  if (order.join(",") !== wanted.join(",")) {
    const n = wanted.length;
    ops.push({ key: "positions", desc: `Role order: the 3 Verified roles directly under Organizer; new regions and PlayStation/Xbox/PC under Oceania; LFG Pings under Playlist Pings`, method: "PATCH", path: `/guilds/${GUILD}/roles`,
      body: wanted.map((id, i) => ({ id, position: n - i })) });
  }

  // 3. channel overwrites
  const E = L.everyoneId;
  for (const c of L.channels) {
    const ow = new Map<string, { id: string; type: number; allow: bigint; deny: bigint }>();
    for (const o of c.permission_overwrites ?? []) ow.set(o.id, { id: o.id, type: o.type, allow: BigInt(o.allow), deny: BigInt(o.deny) });
    const before = new Map([...ow].map(([k, v]) => [k, { ...v }]));
    // a) feature rights are no longer set per channel (bots and member overwrites untouched)
    for (const o of ow.values()) {
      if (o.type !== 0 || managedOrBot.has(o.id) || o.id === R.troublemaker) continue;
      o.allow &= ~FEATURE; o.deny &= ~FEATURE;
    }
    const set = (id: string, allow: bigint, deny = 0n) => {
      const o = ow.get(id) ?? { id, type: 0, allow: 0n, deny: 0n };
      o.allow = (o.allow | allow) & ~deny; o.deny = (o.deny | deny) & ~allow;
      ow.set(id, o);
    };
    const unset = (id: string, bits: bigint) => { const o = ow.get(id); if (o) { o.allow &= ~bits; o.deny &= ~bits; } };
    const READ = P.VIEW | P.HISTORY | P.REACT;
    const THREADS = P.PUB_THREADS | P.SEND_IN_THREADS;
    const showcase = (posters: string[]) => {
      set(E, READ | THREADS, P.SEND | P.PRIV_THREADS);
      for (const p of posters) set(p, READ | P.SEND);
    };
    switch (c.id) {
      case C.rules: set(E, P.VIEW | P.HISTORY, P.SEND | THREADS | P.PRIV_THREADS); break;
      case C.voiceChat: unset(E, P.VIEW | P.CONNECT | P.SPEAK | P.VAD | P.STREAM); break;
      case C.events:
        showcase([R.eventHost, R.playlistHost, nid.vEventHost]);
        unset(R.eventHost, P.MENTION_ALL);
        set(R.organizer, P.MENTION_ALL); // Verified hosts ping via /ping (role-limited), never @everyone
        break;
      case C.playlists:
        showcase([R.playlistHost, R.eventHost, nid.vEventHost]);
        set(R.organizer, P.MENTION_ALL);
        break;
      case C.organizers: for (const v of vIds) set(v, READ | P.SEND | THREADS); break;
      case C.jobCreators: case C.suggest: showcase([R.creator, nid.vCreator]); break;
      case C.content: showcase([R.editor, R.streamer, nid.vCreator]); break;
      case C.streams: showcase([R.streamer, R.editor]); break;
      case C.snapmatics: unset(E, P.VIEW); break;
      case C.crews: set(E, READ, P.SEND); break;
    }
    for (const [id, o] of ow) {
      const was = before.get(id);
      if (was && was.allow === o.allow && was.deny === o.deny) continue;
      if (!was && !o.allow && !o.deny) continue;
      const parts: string[] = [];
      const wa = was?.allow ?? 0n, wd = was?.deny ?? 0n;
      if ((o.allow & ~wa)) parts.push(`allow +[${bitsText(o.allow & ~wa)}]`);
      if ((wa & ~o.allow)) parts.push(`allow -[${bitsText(wa & ~o.allow)}]`);
      if ((o.deny & ~wd)) parts.push(`deny +[${bitsText(o.deny & ~wd)}]`);
      if ((wd & ~o.deny)) parts.push(`deny -[${bitsText(wd & ~o.deny)}]`);
      const desc = `#${c.name} · ${rname(id)}: ${parts.join("; ")}`;
      if (!o.allow && !o.deny) ops.push({ key: `ow:${c.id}:${id}`, desc: `#${c.name} · ${rname(id)}: remove overwrite (now neutral)`, method: "DELETE", path: `/channels/${c.id}/permissions/${id}` });
      else ops.push({ key: `ow:${c.id}:${id}`, desc, method: "PUT", path: `/channels/${c.id}/permissions/${id}`, body: { type: o.type, allow: o.allow.toString(), deny: o.deny.toString() } });
    }
    if ([C.jobCreators, C.suggest, C.content, C.streams].includes(c.id) && c.rate_limit_per_user !== SLOWMODE_S)
      ops.push({ key: `slow:${c.id}`, desc: `#${c.name}: slowmode 6 h`, method: "PATCH", path: `/channels/${c.id}`, body: { rate_limit_per_user: SLOWMODE_S } });
  }

  // 4. onboarding (last, needs the new roles)
  const sid = (i: number) => ((BigInt(Date.now() - 1420070400000) << 22n) + BigInt(i)).toString();
  let k = 0;
  const opt = (title: string, roleIds: string[], description?: string) => ({ id: sid(k++), title, description, role_ids: roleIds, channel_ids: [], emoji_id: null, emoji_name: null, emoji_animated: false });
  const prompt = (title: string, single: boolean, required: boolean, options: any[]) => ({ id: sid(k++), type: 0, title, single_select: single, required, in_onboarding: true, options });
  const onboarding = {
    enabled: true, mode: 0,
    default_channel_ids: [C.startHere, C.rules, C.updates, C.timeAttack, C.events, C.playlists, C.chat, C.carTalk, C.snapmatics, C.feedback],
    prompts: [
      prompt("Which region are you in?", true, true, [opt("Europe", [R.europe]), opt("North America", [R.na]), opt("South America", [R.sa]), opt("Asia", [nid.asia]), opt("Middle East", [nid.middleEast]), opt("Africa", [nid.africa]), opt("Oceania", [R.oceania])]),
      prompt("Which platforms do you play on?", false, false, [opt("PlayStation", [nid.ps]), opt("Xbox", [nid.xbox]), opt("PC", [nid.pc])]),
      prompt("Which languages do you speak?", false, false, [opt("English", [R.english]), opt("Deutsch", [R.german]), opt("Español", [R.spanish]), opt("Français", [R.french]), opt("Italiano", [R.italiano]), opt("Português", [R.portugues])]),
      prompt("Choose your community roles", false, false, [opt("Crew Leader", [R.crewLeader], "Self-selected; not a Verified role"), opt("Event Host", [R.eventHost], "Self-selected; not a Verified role"), opt("Playlist Host", [R.playlistHost]), opt("Creator", [R.creator], "Build GTA tracks & jobs; self-selected"), opt("Editor", [R.editor], "Create photo edits"), opt("Streamer", [R.streamer])]),
      prompt("Notify me about…", false, false, [opt("Events", [R.eventPing]), opt("Playlists", [R.playlistPing]), opt("Looking for players (LFG)", [nid.lfgPing])]),
    ],
  };
  ops.push({ key: "onboarding", desc: `Onboarding on: 5 questions (region – one answer, required; platform; languages; what you do; notifications), 10 default channels`, method: "PUT", path: `/guilds/${GUILD}/onboarding`, body: onboarding });
  return ops;
}

const ROLES_TEXT = [
  "## Your roles",
  "Pick your region, platform, languages, what you do in the scene and which pings you want – change it any time here: <id:customize>",
  "",
  "## Get verified",
  "Crew Leader, Event Host or Creator? Log in with Discord on Leonida Racing and your role becomes **Verified**: own colour, listed separately, link previews, polls, external emojis and activities. Your crew shows up in the crew directory and your events go to every server that follows the calendar.",
].join("\n");
const VERIFY_TEXT = [
  "## Get verified",
  "Log in with Discord on Leonida Racing: you get **Registered Driver**, and Crew Leaders, Event Hosts and Creators become **Verified** – own colour, link previews, polls, external emojis and activities.",
  "Roles: <id:customize>",
].join("\n");
const verifyButton = { type: 1, components: [{ type: 2, style: 5, label: "Log in with Discord", url: `${SITE}/account/` }] };

function messageOps(): Op[] {
  return [
    { key: "msg:roles-clean", desc: `#roles: remove carl-bot reaction-role messages`, method: "X", path: "" },
    { key: "msg:roles", desc: `#roles: post "Your roles / Get verified" with button (text below)`, method: "POST", path: `/channels/${C.roles}/messages`, body: { content: ROLES_TEXT, components: [verifyButton] } },
    { key: "msg:start", desc: `#start-here: post "Get verified" with button (text below)`, method: "POST", path: `/channels/${C.startHere}/messages`, body: { content: VERIFY_TEXT, components: [verifyButton] } },
  ];
}

async function cleanRoles(L: Awaited<ReturnType<typeof live>>) {
  const carl = L.roles.find((r) => r.managed && r.name.toLowerCase().includes("carl"))?.tags?.bot_id;
  if (!carl) return "carl-bot not found";
  const m = await discord("GET", `/channels/${C.roles}/messages?limit=100`);
  if (!m.ok) return `read failed ${m.status}`;
  let n = 0;
  for (const msg of m.data as any[]) if (msg.author?.id === carl) { const d = await discord("DELETE", `/channels/${C.roles}/messages/${msg.id}`); if (d.ok) n++; }
  return `${n} deleted`;
}

async function ensureRoles(L: Awaited<ReturnType<typeof live>>, create: boolean) {
  const nid: Record<string, string> = {};
  const created: string[] = [];
  for (const nr of NEW_ROLES) {
    const hit = L.roles.find((r) => r.name === nr.name);
    if (hit) { nid[nr.key] = hit.id; continue; }
    if (!create) { nid[nr.key] = `new:${nr.name}`; continue; }
    const r = await discord("POST", `/guilds/${GUILD}/roles`, { name: nr.name, color: nr.color, hoist: nr.hoist, mentionable: false, permissions: nr.perms.toString() });
    if (!r.ok) throw new Error(`create role ${nr.name}: ${r.status} ${r.text.slice(0, 200)}`);
    nid[nr.key] = r.data.id; created.push(r.data.id);
  }
  if (created.length) {
    const { data } = await db.from("discord_bot_state").select("value").eq("key", "setup_created_roles").maybeSingle();
    const prev: string[] = data ? JSON.parse(data.value) : [];
    await db.from("discord_bot_state").upsert({ key: "setup_created_roles", value: JSON.stringify([...prev, ...created]), updated_at: new Date().toISOString() });
  }
  return nid;
}

async function plan() {
  const L = await live();
  const nid = await ensureRoles(L, false);
  const toCreate = NEW_ROLES.filter((r) => nid[r.key].startsWith("new:")).map((r) => `Create role "${r.name}" (${r.hoist ? "shown separately, " : ""}colour #${r.color.toString(16).padStart(6, "0")}, ${r.perms ? bitsText(r.perms) : "no own permissions"})`);
  const ops = [...build(L, nid), ...messageOps()];
  return { create_roles: toCreate, changes: ops.map((o) => `[${o.key}] ${o.desc}`), texts: { roles: ROLES_TEXT, start_here: VERIFY_TEXT } };
}

async function apply(skip: string[]) {
  let L = await live();
  const nid = await ensureRoles(L, true);
  L = await live();
  const ops = [...build(L, nid), ...messageOps()].filter((o) => !skip.includes(o.key));
  const results: string[] = [];
  for (const o of ops) {
    if (o.key === "msg:roles-clean") { results.push(`ok  ${o.key}: ${await cleanRoles(L)}`); continue; }
    const r = await discord(o.method, o.path, o.body);
    results.push(`${r.ok ? "ok " : "ERR"} ${o.key}${r.ok ? "" : `: ${r.status} ${r.text.slice(0, 200)}`}`);
  }
  return { new_role_ids: nid, results };
}

async function restore() {
  const { data } = await db.from("discord_bot_state").select("value").eq("key", "setup_snapshot").maybeSingle();
  if (!data) return { error: "no snapshot" };
  const snap = JSON.parse(data.value);
  const L = await live();
  const out: string[] = [];
  const { data: cr } = await db.from("discord_bot_state").select("value").eq("key", "setup_created_roles").maybeSingle();
  for (const id of (cr ? JSON.parse(cr.value) : []) as string[]) { const r = await discord("DELETE", `/guilds/${GUILD}/roles/${id}`); out.push(`delete created role ${id}: ${r.status}`); }
  const idMap: Record<string, string> = {};
  for (const sr of snap.roles as any[]) {
    if (sr.managed) continue;
    let id = sr.id;
    if (!L.roles.find((r) => r.id === sr.id)) {
      const r = await discord("POST", `/guilds/${GUILD}/roles`, { name: sr.name, color: sr.color, hoist: sr.hoist, mentionable: sr.mentionable, permissions: sr.permissions });
      out.push(`recreate role ${sr.name} (without members): ${r.status}`); if (!r.ok) continue; id = r.data.id; idMap[sr.id] = id;
    }
    const r = await discord("PATCH", `/guilds/${GUILD}/roles/${id}`, { name: sr.name, color: sr.color, hoist: sr.hoist, mentionable: sr.mentionable, permissions: sr.permissions });
    if (!r.ok) out.push(`role ${sr.name}: ${r.status}`);
  }
  for (const sc of snap.channels as any[]) {
    const lc = L.channels.find((c) => c.id === sc.id);
    if (!lc) continue;
    const want = new Map((sc.overwrites ?? []).map((o: any) => [idMap[o.id] ?? o.id, o]));
    for (const o of lc.permission_overwrites ?? []) if (!want.has(o.id)) await discord("DELETE", `/channels/${sc.id}/permissions/${o.id}`);
    for (const [id, o] of want as Map<string, any>) {
      const r = await discord("PUT", `/channels/${sc.id}/permissions/${id}`, { type: o.type, allow: o.allow, deny: o.deny });
      if (!r.ok) out.push(`#${sc.name} ${id}: ${r.status}`);
    }
    if (lc.rate_limit_per_user !== sc.rate_limit_per_user) await discord("PATCH", `/channels/${sc.id}`, { rate_limit_per_user: sc.rate_limit_per_user ?? 0 });
  }
  const ob = await discord("PUT", `/guilds/${GUILD}/onboarding`, { enabled: false, prompts: [], default_channel_ids: [], mode: 0 });
  out.push(`onboarding off: ${ob.status}`);
  return { restored: true, notes: out };
}

async function inspect() {
  const g = await discord("GET", `/guilds/${GUILD}`);
  const ch = await discord("GET", `/guilds/${GUILD}/channels`);
  const ob = await discord("GET", `/guilds/${GUILD}/onboarding`);
  if (!g.ok || !ch.ok) return { error: `guild ${g.status} / channels ${ch.status}` };
  const snap = {
    taken_at: new Date().toISOString(),
    guild: { id: g.data.id, name: g.data.name, features: g.data.features },
    roles: (g.data.roles as any[]).sort((a, c) => c.position - a.position).map((r) => ({ id: r.id, name: r.name, position: r.position, color: r.color, hoist: r.hoist, mentionable: r.mentionable, managed: r.managed, permissions: r.permissions })),
    channels: (ch.data as any[]).sort((a, c) => a.position - c.position).map((c) => ({ id: c.id, name: c.name, type: c.type, parent_id: c.parent_id, position: c.position, rate_limit_per_user: c.rate_limit_per_user, topic: c.topic ?? null, overwrites: c.permission_overwrites })),
    onboarding: ob.ok ? ob.data : { error: ob.status },
  };
  const { data: existing } = await db.from("discord_bot_state").select("key").eq("key", "setup_snapshot").maybeSingle();
  if (!existing) await db.from("discord_bot_state").upsert({ key: "setup_snapshot", value: JSON.stringify(snap), updated_at: new Date().toISOString() });
  return { saved_as_snapshot: !existing, ...snap };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { data: ok } = await db.rpc("check_job_token", { p_name: "discord-setup", p_token: req.headers.get("x-job-token") ?? "" });
  if (ok !== true) return json({ error: "forbidden" }, 403);
  if (!TOKEN || !GUILD) return json({ error: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID missing" }, 500);
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "inspect") return json(await inspect());
    if (body?.action === "plan") return json(await plan());
    if (body?.action === "apply") return json(await apply(Array.isArray(body.skip) ? body.skip : []));
    if (body?.action === "restore") return json(await restore());
  } catch (err) { return json({ error: String(err).slice(0, 500) }, 500); }
  return json({ error: "unknown action" }, 400);
});
