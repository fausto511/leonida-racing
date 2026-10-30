// Lap-time and screenshot helpers shared by "Correct this lap" in My laps (RS-0091).
// Same rules as the Submit page (time-attack/submit): digits-only lap time input and
// screenshots stored at most 1920 px on the long edge as JPEG, target <= 600 KB (DEC-0070).

export function normalizeLapTime(text: string): string | null {
  const t = (text || '').trim();
  if (/^\d{1,2}:\d{2}\.\d{1,3}$/.test(t)) return t;
  const digits = t.replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 7) return null;
  const ms = digits.slice(-3), sec = digits.slice(-5, -3), min = digits.slice(0, -5) || '0';
  if (parseInt(sec, 10) > 59) return null;
  return `${parseInt(min, 10)}:${sec}.${ms}`;
}
export function parseLapTimeToMs(text: string): number | null {
  const norm = normalizeLapTime(text);
  if (!norm) return null;
  const m = /^(\d{1,2}):(\d{2})\.(\d{1,3})$/.exec(norm);
  if (!m || parseInt(m[2], 10) > 59) return null;
  return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000 + parseInt(m[3].padEnd(3, '0'), 10);
}
export const fmtLapMs = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 1920;
const TARGET_BYTES = 600 * 1024;
export const safeName = (n: string) => (n || 'screenshot').toLowerCase().normalize('NFKD').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'screenshot';

function loadImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}
export interface PreparedShot { blob: Blob; name: string; type: string; size: number }
export async function prepareImage(file: File): Promise<PreparedShot> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) throw new Error('That file is not an image. Please choose your screenshot (JPG or PNG).');
  let loaded;
  try { loaded = await loadImage(file); } catch { throw new Error('This image format cannot be read by your browser. Please use a JPG or PNG screenshot.'); }
  const { img, url } = loaded;
  URL.revokeObjectURL(url);
  const small = ['image/jpeg', 'image/webp'].includes(file.type) && file.size <= TARGET_BYTES && Math.max(img.naturalWidth, img.naturalHeight) <= MAX_EDGE;
  if (small) return { blob: file, name: file.name, type: file.type, size: file.size };
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  let blob: Blob | null = null;
  for (const q of [0.86, 0.8, 0.72, 0.64]) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error('Could not prepare this image for upload. Try a smaller JPG or PNG screenshot.');
  return { blob, name: `${(file.name || 'screenshot').replace(/\.[^.]+$/, '')}.jpg`, type: 'image/jpeg', size: blob.size };
}
