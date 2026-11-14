const REDUCE = '(prefers-reduced-motion: reduce)';
const TOGGLES = '#theme-toggle, [data-theme-toggle], #mobile-menu button[aria-pressed]';

function readStored() {
  try { return localStorage.getItem('theme'); } catch { return null; }
}

/** Sync aria on every toggle + both theme-color metas to the current theme. */
function sync() {
  const root = document.documentElement;
  const light = root.dataset.theme === 'light';
  document.querySelectorAll(TOGGLES).forEach((b) => {
    b.setAttribute('aria-pressed', String(light));
    b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
  });
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
}

/**
 * Apply a theme. origin = {x,y} client px for the circular reveal (defaults to viewport centre).
 * Falls back to an instant switch without View Transitions or under reduced motion.
 */
export function setTheme(next, origin, persist = false) {
  const root = document.documentElement;
  if (persist) { try { localStorage.setItem('theme', next); } catch { /* private mode */ } }
  if (root.dataset.theme === next) return;
  const apply = () => {
    root.dataset.theme = next;
    sync();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  };
  if (!document.startViewTransition || matchMedia(REDUCE).matches) { apply(); return; }
  const x = origin ? origin.x : innerWidth / 2;
  const y = origin ? origin.y : innerHeight / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(apply);
  vt.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}

export function toggleTheme(origin) {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', origin, true);
}

export function initTheme() {
  sync();
  document.querySelectorAll(TOGGLES).forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = btn.getBoundingClientRect();
      toggleTheme({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
    });
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    if (!readStored()) setTheme(e.matches ? 'light' : 'dark');
  });
}
