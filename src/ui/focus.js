const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

export function initFocus() {
  const jobs = [...document.querySelectorAll('.job')];
  if (jobs.length) {
    let cur = -1;
    const set = (i) => {
      if (i === cur) return;
      cur = i;
      jobs.forEach((j, k) => j.classList.toggle('is-active', k === i));
      emit('jobfocus', { index: i });
    };
    set(0);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        const hit = entries.filter((e) => e.isIntersecting).pop();
        if (hit) set(jobs.indexOf(hit.target));
      }, { rootMargin: '-45% 0px -45% 0px' });
      jobs.forEach((j) => io.observe(j));
    }
  }
  const hover = (sel, attr, name) => {
    document.querySelectorAll(sel).forEach((el) => {
      const index = Number(el.dataset[attr]);
      const on = () => emit(name, { index });
      const off = () => emit(name, { index: null });
      el.addEventListener('pointerenter', on, { passive: true });
      el.addEventListener('pointerleave', off, { passive: true });
      el.addEventListener('focusin', on);
      el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) off(); });
    });
  };
  hover('.skill-group', 'skill', 'skillfocus');
  hover('.project', 'project', 'projectfocus');
}
