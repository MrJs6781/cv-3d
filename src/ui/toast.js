let timer = 0;

/** Show a short status message in #toast (role=status, aria-live=polite). */
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}
