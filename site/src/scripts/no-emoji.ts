// Fausto 31.10.2026: no emojis in any text a user can write. Typed or pasted emojis are removed
// right away and a short note appears under the field. The database rejects them as well
// (migration 20261031140000, same character ranges), so this is only the friendly half.
// COPY: Claude placeholder, Codex review pending.
const RANGES = '\\u231A\\u231B\\u23E9-\\u23FA\\u2600-\\u27BF\\u2B00-\\u2BFF\\uFE0F\\u200D\\u20E3\\u{1F000}-\\u{1FAFF}';
const HAS = new RegExp(`[${RANGES}]`, 'u');
const ALL = new RegExp(`[${RANGES}]`, 'gu');
const TEXT_TYPES = new Set(['text', 'search', '']);
let note: HTMLElement | null = null;
let timer = 0;

function showNote(field: HTMLElement): void {
  if (!note) {
    note = document.createElement('div');
    note.className = 'lr-noemoji';
    note.setAttribute('role', 'status');
    note.textContent = 'Emojis aren’t allowed here.';
    document.body.append(note);
  }
  const r = field.getBoundingClientRect();
  note.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
  note.style.top = `${r.bottom + window.scrollY + 6}px`;
  note.hidden = false;
  clearTimeout(timer);
  timer = window.setTimeout(() => { if (note) note.hidden = true; }, 2500);
}

document.addEventListener('input', (e) => {
  const t = e.target;
  const ok = (t instanceof HTMLInputElement && TEXT_TYPES.has(t.getAttribute('type') ?? '')) || t instanceof HTMLTextAreaElement;
  if (!ok) return;
  const f = t as HTMLInputElement | HTMLTextAreaElement;
  if (!HAS.test(f.value)) return;
  const pos = f.selectionStart ?? f.value.length;
  const before = f.value.slice(0, pos).replace(ALL, '');
  f.value = f.value.replace(ALL, '');
  try { f.setSelectionRange(before.length, before.length); } catch { /* not all types allow it */ }
  showNote(f);
  f.dispatchEvent(new Event('input', { bubbles: true })); // let counters/previews update (value has no emoji now, so no loop)
}, true);
