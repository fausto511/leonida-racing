// Filter fields "<label class=sel><span class=k>Language</span><select>": a click anywhere in the
// box opens the list, not only a click on the value (Fausto 31.10.2026). Clicking a label only
// focuses a <select>; showPicker() opens it where supported, otherwise focus stays the fallback.
export function wireSelectLabels(root: ParentNode = document): void {
  root.querySelectorAll<HTMLLabelElement>('label.sel').forEach((label) => {
    const sel = label.querySelector('select');
    if (!sel) return;
    label.addEventListener('click', (e) => {
      if (e.target === sel || sel.disabled) return;
      e.preventDefault();
      sel.focus();
      try { (sel as HTMLSelectElement & { showPicker?: () => void }).showPicker?.(); } catch { /* not allowed here: focus is enough */ }
    });
  });
}
