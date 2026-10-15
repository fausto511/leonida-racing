// White speech bubble anchored to the clicked element (C1, DEC-0126). Shared by
// pages that need short hints next to a button; the Cars page has its own copy
// in scripts/cars.ts (same look, CSS .lr-bubble in styles/tokens.css).
let el: HTMLElement | null = null;
let anchorEl: HTMLElement | null = null;
let timer = 0;

function node(): HTMLElement {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'lr-bubble';
  el.setAttribute('role', 'status');
  el.hidden = true;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => e.stopPropagation());
  return el;
}

export function hideBubble() {
  if (el) el.hidden = true;
  anchorEl = null;
  clearTimeout(timer);
}

export function bubble(anchor: HTMLElement, html: string, ms = 4500) {
  const t = node();
  t.innerHTML = html;
  t.hidden = false;
  anchorEl = anchor;
  const a = anchor.getBoundingClientRect();
  const w = t.offsetWidth, h = t.offsetHeight;
  const below = a.top - h - 14 < 8;
  t.classList.toggle('below', below);
  const cx = a.left + a.width / 2;
  const left = Math.min(Math.max(12, cx - w / 2), window.innerWidth - w - 12);
  t.style.left = `${left}px`;
  t.style.top = `${below ? a.bottom + 12 : a.top - h - 12}px`;
  t.style.setProperty('--arrow-x', `${Math.min(w - 14, Math.max(14, cx - left))}px`);
  clearTimeout(timer);
  timer = window.setTimeout(hideBubble, ms);
}

export const bubbleAnchor = () => anchorEl;
window.addEventListener('scroll', () => { if (anchorEl) hideBubble(); }, { passive: true });
window.addEventListener('resize', () => { if (anchorEl) hideBubble(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideBubble(); });
