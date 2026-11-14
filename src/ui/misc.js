export function initMisc() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = year; });
  document.querySelectorAll('[data-print]').forEach((el) => {
    el.addEventListener('click', () => window.print());
  });
}
