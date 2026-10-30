// Compare page logic (/cars/compare/, handoff "Vergleichsseite" 15.10.2026, DEC-0128).
// Pure functions, used by the browser script. All thresholds are Claude starting
// values -> set them on real data after launch (Fausto). Keep them here, nowhere else.
// COPY STATUS: verdict sentences are Claude placeholders from the mockup -> Codex (DEC-0088).

export const COMPARE_MAX = 4;
/** Best value: a candidate at most this much slower than the fastest pick ... */
export const VALUE_MAX_SLOWER_MS = 500;
/** ... and at least this much cheaper (0.25 = 25 %) */
export const VALUE_MIN_CHEAPER = 0.25;
/** Cheaper alternatives: same class, within this gap to the fastest pick ... */
export const ALT_MAX_SLOWER_MS = 600;
/** ... and at least this much cheaper than it */
export const ALT_MIN_CHEAPER = 0.25;
export const ALT_MAX = 3;

export interface CmpCar {
  id: string; make: string; model: string; logo: string; cls: string; classes: string[];
  drive: string; seats: number; acq: string | null; photo: boolean; based: string | null; release: boolean; sellable: string | null;
  price: number | null; sell: number | null; speed: number | null; ref: number | null;
}

/** Edition / bonus / GTA+ cars: judged like every other car (Fausto 15.10.), only marked
 *  because they can't be bought later. */
export const limited = (c: CmpCar) => Boolean(c.acq);
const LIMITED_NOTE: Record<string, string> = { 'ultimate-edition': 'Ultimate Edition only', 'pre-order': 'Pre-order bonus only', 'gta-plus': 'GTA+ only' };
export const limitedNote = (c: CmpCar) => (c.acq ? `${LIMITED_NOTE[c.acq] ?? 'Limited'}: can't be bought later.` : '');

export const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
export const moneyShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `$${Math.round(n / 1000)}k`);
export const secs = (ms: number) => `${(ms / 1000).toFixed(2)} s`;

export interface Verdict {
  value: { car: CmpCar; text: string } | null;
  valueNote: string | null;
  fastest: { car: CmpCar; text: string } | null;
  speed: { car: CmpCar; text: string } | null;
}

/** null = not enough data (price + reference lap for at least 2 cars) */
/** fmtSpeed: how the top speed reads in the sentence (DEC-0197: the page passes the chosen units) */
export function verdict(cars: CmpCar[], fmtSpeed: (mph: number) => string = (mph) => `${Math.round(mph)} mph`): Verdict | null {
  const priced = cars.filter((c) => c.price != null && c.ref != null);
  if (priced.length < 2) return null;
  const withRef = cars.filter((c) => c.ref != null).sort((a, b) => a.ref! - b.ref!);
  const fastest = withRef[0];
  const n = cars.length === 2 ? 'two' : cars.length === 3 ? 'three' : 'four';
  const fastestOut = { car: fastest, text: `Quickest reference lap of the ${n}. Worth it if you chase every tenth.` };

  // value: only cars you can buy
  const buyable = [...priced].sort((a, b) => a.ref! - b.ref!);
  let value: Verdict['value'] = null;
  const valueNote: string | null = null;
  if (buyable.length >= 2) {
    const f = buyable[0];
    const cheapest = [...buyable].sort((a, b) => a.price! - b.price!)[0];
    if (cheapest.id === f.id) {
      value = { car: f, text: `Faster and cheaper than the rest. A clear pick.` };
    } else {
      const cands = buyable.filter((c) => c.id !== f.id && c.ref! - f.ref! <= VALUE_MAX_SLOWER_MS && c.price! <= f.price! * (1 - VALUE_MIN_CHEAPER))
        .sort((a, b) => a.price! - b.price!);
      const pick = cands[0];
      if (pick) value = { car: pick, text: `Only ${secs(pick.ref! - f.ref!)} slower than the ${f.model} at Gellhorn, but ${money(f.price! - pick.price!)} cheaper. Our pick for most drivers.` };
      else value = { car: f, text: `None of the cheaper cars stays close enough at Gellhorn. The ${f.model} is worth its price.` };
    }
  }
  if (value && limited(value.car)) value = { ...value, text: `${value.text} ${limitedNote(value.car)}` };

  const withSpeed = cars.filter((c) => c.speed != null).sort((a, b) => b.speed! - a.speed!);
  let speed: Verdict['speed'] = null;
  if (withSpeed.length >= 2) {
    const s = withSpeed[0];
    const gap = s.ref != null && fastest.ref != null && s.id !== fastest.id ? ` but ${secs(s.ref - fastest.ref!)} slower around Gellhorn` : '';
    speed = { car: s, text: `${fmtSpeed(s.speed!)}, the highest here${gap}.` };
  }
  return { value, valueNote, fastest: fastestOut, speed };
}

/** Cheaper alternatives: same class as the fastest pick, close in lap time, clearly cheaper */
export function alternatives(cars: CmpCar[], all: CmpCar[]): { car: CmpCar; slower: number; cheaper: number }[] {
  const f = cars.filter((c) => c.ref != null && c.price != null).sort((a, b) => a.ref! - b.ref!)[0];
  if (!f) return [];
  const chosen = new Set(cars.map((c) => c.id));
  return all
    .filter((c) => !chosen.has(c.id) && c.release && c.classes.includes(f.cls) && c.ref != null && c.price != null)
    .filter((c) => c.ref! - f.ref! <= ALT_MAX_SLOWER_MS && c.price! <= f.price! * (1 - ALT_MIN_CHEAPER))
    .map((c) => ({ car: c, slower: Math.max(0, c.ref! - f.ref!), cheaper: f.price! - c.price! }))
    .sort((a, b) => a.slower - b.slower || b.cheaper - a.cheaper)
    .slice(0, ALT_MAX);
}
