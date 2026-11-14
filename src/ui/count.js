const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

export function initCount() {
  const els = [...document.querySelectorAll('[data-count]')];
  if (!els.length) return;
  const fmt = (el, v) => { el.textContent = v + (el.dataset.suffix || ''); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => fmt(el, Number(el.dataset.count)));
    return;
  }
  const run = (el) => {
    const end = Number(el.dataset.count);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 1400);
      fmt(el, Math.round(end * easeOutExpo(t)));
      if (t < 1) requestAnimationFrame(step);
    };
    fmt(el, 0);
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      run(e.target);
    });
  }, { threshold: 0.5 });
  els.forEach((el) => io.observe(el));
}
