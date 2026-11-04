// chat-car (RS-0110, Fausto 04.11.2026): one line of plain text for Twitch/YouTube chat bots
// (Nightbot $(urlfetch ...), StreamElements ${customapi ...}). Public, no login (verify_jwt off),
// read-only on public data via the anon key. Usage: GET /functions/v1/chat-car?q=comet
// Answer: name · class · inspiration · price · top speed · Gellhorn lap · link · "Data by Leonida Racing"
// (DEC-0214). Values only appear once they exist; unreleased (leak-only) cars are never matched.
// COPY STATUS: Claude placeholders.

const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SITE = "leonidaracing.com";
const MAX = 400; // Nightbot / Twitch message limit
const CREDIT = "Data by Leonida Racing";

type Car = { vehicle_id: string; make: string; model: string; classes: string[] | null; real_life_inspiration: string | null; other_names: string[] | null };
let cache: { at: number; cars: Car[] } | null = null;

async function rest(path: string) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function cars(): Promise<Car[]> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache.cars;
  const list = await rest("vehicles?release_id=not.is.null&select=vehicle_id,make,model,classes,real_life_inspiration,other_names");
  cache = { at: Date.now(), cars: list };
  return list;
}
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[’'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function best(q: string, list: Car[]): Car | null {
  const nq = norm(q);
  if (!nq) return null;
  let top: { c: Car; s: number } | null = null;
  for (const c of list) {
    const names = [`${c.make} ${c.model}`, c.model, ...(c.other_names ?? [])].map(norm);
    let s = 0;
    for (const n of names) {
      if (n === nq) s = Math.max(s, 100);
      else if (n.startsWith(nq)) s = Math.max(s, 80 - (n.length - nq.length) * 0.1);
      else if (n.split(" ").some((w) => w.startsWith(nq))) s = Math.max(s, 60 - n.length * 0.1);
      else if (n.includes(nq)) s = Math.max(s, 40 - n.length * 0.1);
      else if (nq.split(" ").every((w) => n.includes(w))) s = Math.max(s, 30 - n.length * 0.1);
    }
    if (s > 0 && (!top || s > top.s)) top = { c, s };
  }
  return top?.c ?? null;
}
const lap = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;

async function line(q: string): Promise<string> {
  if (!norm(q)) return `Usage: !car <name>, e.g. !car comet · ${SITE}/cars/`;
  const c = best(q, await cars());
  if (!c) return `No GTA 6 car found for "${q.slice(0, 40)}" · ${SITE}/cars/`;
  const id = encodeURIComponent(c.vehicle_id);
  const [vals, rank] = await Promise.all([
    rest(`vehicle_values?vehicle_id=eq.${id}&status=eq.current&select=metric,tuning,value`).catch(() => []),
    rest(`public_leaderboard_ranks?scope=eq.vehicle&scope_key=eq.${id}&rank=eq.1&track_id=eq.gellhorn-international-raceway&select=lap_time_ms&limit=1`).catch(() => []),
  ]);
  const v = (m: string) => (vals as { metric: string; tuning?: string; value: number }[]).find((x) => x.metric === m && (x.tuning ?? "stock") === "stock")?.value;
  const price = v("price_gtad");
  const mph = v("top_speed_mph");
  const ref = v("gellhorn_reference_lap_ms");
  const bestLap = (rank as { lap_time_ms: number }[])[0]?.lap_time_ms;
  const parts = [
    `${c.make} ${c.model}${c.classes?.length ? ` (${c.classes.join(", ")})` : ""}`,
    c.real_life_inspiration ? `based on ${c.real_life_inspiration}` : "",
    price != null ? `$${Number(price).toLocaleString("en-US")}` : "",
    mph != null ? `${Math.round(Number(mph))} mph / ${Math.round(Number(mph) * 1.609344)} km/h` : "",
    ref != null ? `Gellhorn ref. lap ${lap(Number(ref))}` : bestLap != null ? `Gellhorn best ${lap(Number(bestLap))}` : "",
    `${SITE}/cars/vehicles/${c.vehicle_id}/`,
  ].filter(Boolean);
  let out = `${parts.join(" · ")} · ${CREDIT}`;
  if (out.length > MAX) out = parts.join(" · ").slice(0, MAX);
  return out;
}

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? u.searchParams.get("car") ?? "").slice(0, 80);
  try {
    return new Response(await line(q), { headers: cors });
  } catch {
    return new Response(`Car data is not available right now · ${SITE}/cars/`, { headers: cors });
  }
});
