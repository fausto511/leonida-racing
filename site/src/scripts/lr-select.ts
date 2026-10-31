// Site dropdown (Fausto 31.10.2026, DEC-0202): every <select> gets the same look instead of the
// browser's own grey list. The native <select> stays in the page (forms, change events, values,
// screen readers' fallback); a button shows its value and opens our list. On phones the list
// opens as a sheet from the bottom with big touch targets.
// Styles: styles/dropdown.css. Opt out per element with data-native.
// Written in plain JS syntax on purpose, so the same code runs in prototypes.

const SEARCH_FROM = 13; // long lists (cars, makes, ...) get a search field
const PHONE = '(max-width: 560px)';
const CHECK = '<svg class="lr-dd-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

let open = null; // { sel, btn, panel, items, active, backdrop }
let uid = 0;

function labelOf(sel) {
  const lab = sel.closest('label');
  const k = lab && lab.querySelector('.k, .set-label, .fix-label');
  if (k) return k.textContent.trim();
  if (sel.getAttribute('aria-label')) return sel.getAttribute('aria-label');
  if (lab) return (lab.childNodes[0] && lab.childNodes[0].textContent || '').replace('*', '').trim();
  return '';
}
function optText(o) { return (o ? o.textContent : '').trim(); }

function paintButton(sel) {
  const btn = sel._lrBtn;
  if (!btn) return;
  const o = sel.options[sel.selectedIndex];
  btn.querySelector('.lr-dd-v').textContent = optText(o) || '—';
  btn.disabled = sel.disabled;
  sel._lrWrap.hidden = sel.hidden;
}

function enhance(sel) {
  if (sel._lrBtn || sel.multiple || sel.size > 1 || sel.hasAttribute('data-native')) return;
  const wrap = document.createElement('span');
  wrap.className = 'lr-dd';
  const box = sel.closest('label.sel');
  const inFilter = !!(box && box.querySelector('.k')); // filter box "Layout  All"; a bare label.sel (leaderboard) is a field
  if (inFilter) wrap.classList.add('lr-dd-inline');
  // a select that filled its line keeps doing so
  const full = !inFilter && sel.parentElement && sel.offsetWidth > 0 && sel.offsetWidth >= sel.parentElement.clientWidth - 4;
  if (full || getComputedStyle(sel).width === '100%') wrap.classList.add('lr-dd-block');
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('lr-dd-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lr-dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.setAttribute('aria-expanded', 'false');
  const name = labelOf(sel);
  if (name) btn.setAttribute('aria-label', name);
  btn.innerHTML = '<span class="lr-dd-v"></span><svg class="lr-dd-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  wrap.appendChild(btn);
  sel._lrBtn = btn;
  sel._lrWrap = wrap;
  btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (open && open.sel === sel) close(true); else openList(sel); });
  btn.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(sel); }
  });
  // a label around it (filter boxes) opens the list too
  const lab = sel.closest('label');
  if (lab) lab.addEventListener('click', (e) => { if (e.target.closest('.lr-dd-btn, .lr-dd-panel')) return; e.preventDefault(); if (!btn.disabled) btn.click(); });
  // keep the button in step: value set by script, options filled later, hidden/disabled toggled
  sel.addEventListener('change', () => paintButton(sel));
  new MutationObserver(() => paintButton(sel)).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); paintButton(sel); } });
  const descI = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  Object.defineProperty(sel, 'selectedIndex', { configurable: true, get() { return descI.get.call(this); }, set(v) { descI.set.call(this, v); paintButton(sel); } });
  const form = sel.form;
  if (form && !form._lrReset) { form._lrReset = true; form.addEventListener('reset', () => setTimeout(() => form.querySelectorAll('select').forEach(paintButton), 0)); }
  paintButton(sel);
}

function buildItems(sel) {
  let html = '';
  let i = 0;
  const add = (o) => {
    const on = o.selected;
    const n = o.getAttribute('data-n');
    html += `<div class="lr-dd-i${on ? ' on' : ''}" role="option" id="lr-dd-${uid}-${i}" data-i="${o.index}" aria-selected="${on}"${o.disabled ? ' aria-disabled="true"' : ''}><span class="lr-dd-t"></span>${n ? `<span class="lr-dd-n">${n}</span>` : ''}${CHECK}</div>`;
    i++;
  };
  for (const node of sel.children) {
    if (node.tagName === 'OPTGROUP') {
      html += `<div class="lr-dd-h" role="presentation"></div>`;
      for (const o of node.children) add(o);
    } else if (!node.hidden) add(node);
  }
  return html;
}

function place(panel, btn) {
  if (matchMedia(PHONE).matches) { panel.style.cssText = ''; return; }
  const r = (btn.closest('.lr-dd-inline') ? btn.closest('label.sel') : btn.closest('.lr-dd')).getBoundingClientRect();
  const h = Math.min(panel.scrollHeight, 380);
  const below = innerHeight - r.bottom - 12;
  const up = below < Math.min(h, 240) && r.top > below;
  panel.style.minWidth = `${Math.max(r.width, 200)}px`;
  panel.style.left = `${Math.max(8, Math.min(r.left, innerWidth - panel.offsetWidth - 8))}px`;
  panel.style.top = up ? '' : `${r.bottom + 6}px`;
  panel.style.bottom = up ? `${innerHeight - r.top + 6}px` : '';
  panel.style.maxHeight = `${Math.max(160, (up ? r.top : below) - 12)}px`;
}

function openList(sel) {
  close(false);
  const btn = sel._lrBtn;
  if (!btn || btn.disabled) return;
  uid++;
  const phone = matchMedia(PHONE).matches;
  const panel = document.createElement('div');
  panel.className = 'lr-dd-panel' + (phone ? ' is-sheet' : '');
  const title = labelOf(sel);
  const long = sel.options.length >= SEARCH_FROM;
  panel.innerHTML =
    (phone ? `<div class="lr-dd-sh"><b></b><button type="button" class="lr-dd-x" aria-label="Close">${CLOSE}</button></div>` : '') +
    (long ? `<label class="lr-dd-q">${SEARCH}<input type="text" autocomplete="off" spellcheck="false" placeholder="Search" aria-label="Search${title ? ' ' + title : ''}"></label>` : '') +
    `<div class="lr-dd-list" role="listbox" id="lr-dd-l-${uid}"${title ? ` aria-label="${title.replace(/"/g, '&quot;')}"` : ''}>${buildItems(sel)}</div>` +
    (long ? '<p class="lr-dd-none" hidden>No match</p>' : '');
  if (phone) panel.querySelector('.lr-dd-sh b').textContent = title;
  // text via textContent: option labels are never parsed as HTML
  const items = [...panel.querySelectorAll('.lr-dd-i')];
  items.forEach((el) => { el.querySelector('.lr-dd-t').textContent = optText(sel.options[+el.dataset.i]); });
  const heads = [...panel.querySelectorAll('.lr-dd-h')];
  [...sel.querySelectorAll('optgroup')].forEach((g, k) => { if (heads[k]) heads[k].textContent = g.label; });
  let backdrop = null;
  if (phone) { backdrop = document.createElement('div'); backdrop.className = 'lr-dd-back'; document.body.appendChild(backdrop); backdrop.addEventListener('click', () => close(true)); }
  document.body.appendChild(panel);
  place(panel, btn);
  btn.setAttribute('aria-expanded', 'true');
  btn.setAttribute('aria-controls', `lr-dd-l-${uid}`);
  (btn.closest('.lr-dd-inline') ? btn.closest('label.sel') : btn.closest('.lr-dd')).classList.add('is-open');
  btn.closest('.lr-dd').classList.add('is-open');
  open = { sel, btn, panel, items, active: -1, backdrop };
  const cur = items.findIndex((el) => el.classList.contains('on'));
  setActive(cur >= 0 ? cur : 0, true);
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.lr-dd-x')) { close(true); return; }
    const it = e.target.closest('.lr-dd-i');
    if (it && it.getAttribute('aria-disabled') !== 'true') pick(+it.dataset.i);
  });
  panel.addEventListener('mousemove', (e) => { const it = e.target.closest('.lr-dd-i'); if (it) setActive(open.items.indexOf(it), false); });
  const q = panel.querySelector('.lr-dd-q input');
  if (q) {
    q.addEventListener('input', () => {
      const t = q.value.trim().toLowerCase();
      let shown = 0;
      items.forEach((el) => { const hit = !t || el.textContent.toLowerCase().includes(t); el.hidden = !hit; if (hit) shown++; });
      heads.forEach((h) => { let n = h.nextElementSibling, any = false; while (n && !n.classList.contains('lr-dd-h')) { if (!n.hidden) any = true; n = n.nextElementSibling; } h.hidden = !any; });
      panel.querySelector('.lr-dd-none').hidden = shown > 0;
      setActive(items.findIndex((el) => !el.hidden), true);
    });
    if (!phone) q.focus(); else panel.querySelector('.lr-dd-list').focus();
  } else panel.querySelector('.lr-dd-list').setAttribute('tabindex', '-1');
  if (!q || phone) { panel.querySelector('.lr-dd-list').setAttribute('tabindex', '-1'); panel.querySelector('.lr-dd-list').focus({ preventScroll: true }); }
  panel.addEventListener('keydown', onKey);
}

function setActive(i, scroll) {
  if (!open) return;
  open.items.forEach((el, k) => el.classList.toggle('is-act', k === i));
  open.active = i;
  const el = open.items[i];
  if (el) {
    open.btn.setAttribute('aria-activedescendant', el.id);
    if (scroll) {
      // scroll only the list, never the page (a page scroll closes the list)
      const list = el.parentElement;
      if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop - 6;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight + 6;
    }
  }
}
function move(d) {
  if (!open) return;
  const vis = open.items.filter((el) => !el.hidden && el.getAttribute('aria-disabled') !== 'true');
  if (!vis.length) return;
  const at = vis.indexOf(open.items[open.active]);
  const next = vis[Math.max(0, Math.min(vis.length - 1, at + d))] || vis[0];
  setActive(open.items.indexOf(next), true);
}
function onKey(e) {
  if (!open) return;
  const typing = e.target.tagName === 'INPUT';
  if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
  else if (e.key === 'Home' && !typing) { e.preventDefault(); move(-1e6); }
  else if (e.key === 'End' && !typing) { e.preventDefault(); move(1e6); }
  else if (e.key === 'Enter' || (e.key === ' ' && !typing)) { e.preventDefault(); const el = open.items[open.active]; if (el && !el.hidden) pick(+el.dataset.i); }
  else if (e.key === 'Escape') { e.preventDefault(); close(true); }
  else if (e.key === 'Tab') close(false);
  else if (!typing && e.key.length === 1) {
    // type-ahead: jump to the first option starting with the letter
    const k = e.key.toLowerCase();
    const from = open.active + 1;
    const list = open.items;
    for (let n = 0; n < list.length; n++) { const el = list[(from + n) % list.length]; if (!el.hidden && el.textContent.trim().toLowerCase().startsWith(k)) { setActive(list.indexOf(el), true); break; } }
  }
}
function pick(index) {
  if (!open) return;
  const sel = open.sel;
  const changed = sel.selectedIndex !== index;
  sel.selectedIndex = index;
  close(true);
  if (changed) {
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
function close(focusBtn) {
  if (!open) return;
  const { btn, panel, backdrop } = open;
  panel.remove();
  if (backdrop) backdrop.remove();
  btn.setAttribute('aria-expanded', 'false');
  btn.removeAttribute('aria-activedescendant');
  btn.closest('.lr-dd').classList.remove('is-open');
  btn.closest('label.sel')?.classList.remove('is-open');
  open = null;
  if (focusBtn) btn.focus({ preventScroll: true });
}

export function initSelects(root) {
  (root || document).querySelectorAll('select').forEach(enhance);
}

if (typeof window !== 'undefined' && !window._lrSelect) {
  window._lrSelect = true;
  document.addEventListener('pointerdown', (e) => { if (open && !e.target.closest('.lr-dd-panel') && !open.btn.contains(e.target)) close(false); }, true);
  addEventListener('resize', () => { if (open) place(open.panel, open.btn); });
  // page scrolls: the list follows its field; it closes only once the field has left the screen
  addEventListener('scroll', (e) => {
    if (!open || open.panel.contains(e.target) || open.panel.classList.contains('is-sheet')) return;
    const r = open.btn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) close(false); else place(open.panel, open.btn);
  }, true);
  const run = () => {
    initSelects(document);
    // selects that pages add later (forms built at runtime, inline editors)
    new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhance(n); else if (n.querySelector && !n.closest('.lr-dd-panel')) n.querySelectorAll('select').forEach(enhance); } })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
}
