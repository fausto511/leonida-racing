// Sub-filters in the moderator left column (RS-0102 stage 2). The page passes `subs` to
// ModeratorShell; this helper keeps the pressed state, the URL (?view=) and the counters in sync.

export interface ModSubs {
  current: string;
  set(key: string): void;
  count(key: string, n: number | null): void;
}

export function initModSubs(fallback: string, onChange: (key: string) => void): ModSubs {
  const btns = [...document.querySelectorAll<HTMLButtonElement>('.modside-sub')];
  const keys = btns.map((b) => b.dataset.sub!);
  const fromUrl = new URLSearchParams(location.search).get('view') ?? '';
  const api: ModSubs = {
    current: keys.includes(fromUrl) ? fromUrl : fallback,
    set(key: string) {
      api.current = key;
      btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sub === key)));
      const u = new URL(location.href);
      if (key === fallback) u.searchParams.delete('view'); else u.searchParams.set('view', key);
      history.replaceState(null, '', u);
      onChange(key);
    },
    count(key: string, n: number | null) {
      const el = document.querySelector<HTMLElement>(`[data-sub-n="${key}"]`);
      if (el) el.textContent = n === null ? '' : String(n);
    },
  };
  btns.forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.sub === api.current));
    b.addEventListener('click', () => {
      api.set(b.dataset.sub!);
      // Phones: fold the menu again so the list is visible
      const side = b.closest('.modside');
      if (side?.classList.contains('is-open')) {
        side.classList.remove('is-open');
        side.querySelector('.modside-sum')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
  return api;
}
