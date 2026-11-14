const MAX = 6;

export function initMagnetic() {
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    let tx = 0, ty = 0, raf = 0, px = 0, py = 0, primed = false;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect(); // includes current translate; subtract it
      const cx = r.left + r.width / 2 - tx;
      const cy = r.top + r.height / 2 - ty;
      tx = Math.max(-MAX, Math.min(MAX, ((px - cx) / (r.width / 2)) * MAX));
      ty = Math.max(-MAX, Math.min(MAX, ((py - cy) / (r.height / 2)) * MAX));
      el.style.translate = `${tx.toFixed(2)}px ${ty.toFixed(2)}px`;
    };
    el.addEventListener('pointerenter', () => {
      if (primed) return;
      primed = true; // `translate` leaves the CSS transform alone; append to (don't replace) transitions
      el.style.transition = `${getComputedStyle(el).transition}, translate 300ms cubic-bezier(.2,.7,.2,1)`;
    }, { passive: true });
    el.addEventListener('pointermove', (e) => {
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf); raf = 0;
      tx = ty = 0;
      el.style.translate = '';
    }, { passive: true });
  });
}
