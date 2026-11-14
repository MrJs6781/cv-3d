export function initNav() {
  const root = document.documentElement;
  const nav = document.querySelector('.site-nav');
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const marks = [...document.querySelectorAll('[data-nav]')];
  let ticking = false, active = -1, prog = -1, scrolled = null;

  const update = () => {
    ticking = false;
    // reads first, then writes
    const y = window.scrollY, vh = window.innerHeight;
    const max = root.scrollHeight - vh;
    let a = 0;
    chapters.forEach((c) => { if (c.getBoundingClientRect().top <= vh * 0.25) a = Number(c.dataset.chapter); });
    if (chapters.length && max > 0 && y >= max - 2) a = Number(chapters[chapters.length - 1].dataset.chapter);
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    const sc = y > 24;

    if (sc !== scrolled) { scrolled = sc; if (nav) nav.classList.toggle('is-scrolled', sc); }
    if (Math.abs(p - prog) > 0.0005) { prog = p; root.style.setProperty('--progress', p.toFixed(4)); }
    if (a !== active) {
      active = a;
      marks.forEach((el) => {
        const on = Number(el.dataset.nav) === a;
        if (el.tagName === 'LI') el.classList.toggle('on', on);
        else if (on) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });
    }
  };
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  update();

  // ---- mobile menu ----
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) return;
  let open = false;

  const focusables = () => [toggle, ...menu.querySelectorAll('a[href], button:not([disabled])')];
  const setOpen = (v, restoreFocus) => {
    if (v === open) return;
    open = v;
    menu.hidden = !v;
    root.classList.toggle('menu-open', v);
    root.style.overflow = v ? 'hidden' : '';
    toggle.setAttribute('aria-expanded', String(v));
    toggle.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
    if (v) { const first = menu.querySelector('a[href], button'); if (first) first.focus(); }
    else if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => setOpen(!open, true));
  menu.addEventListener('click', (e) => { if (e.target.closest('a[href]')) setOpen(false, false); });
  document.addEventListener('keydown', (e) => {
    if (!open || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false, true); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    const first = list[0], last = list[list.length - 1];
    const cur = document.activeElement;
    if (!list.includes(cur)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
  });
  matchMedia('(min-width: 768px)').addEventListener('change', (e) => { if (e.matches) setOpen(false, false); });
}
