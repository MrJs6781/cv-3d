const TEHRAN_OFFSET = 210; // minutes east of UTC; Iran has had no DST since 2022

/**
 * Pure: text for how Tehran time relates to a viewer.
 * viewerOffset = minutes east of UTC (i.e. -Date#getTimezoneOffset()).
 */
export function diffText(viewerOffset, tehranOffset = TEHRAN_OFFSET) {
  const d = tehranOffset - viewerOffset;
  if (d === 0) return 'same time as you';
  const abs = Math.abs(d);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const span = [h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
  return `${span} ${d > 0 ? 'ahead of' : 'behind'} you`;
}

export function initClock() {
  const times = document.querySelectorAll('[data-clock]');
  const diffs = document.querySelectorAll('[data-clock-diff]');
  if (!times.length && !diffs.length) return;
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  let timer = 0;
  const tick = () => {
    const now = new Date();
    const text = fmt.format(now);
    times.forEach((t) => { t.textContent = text; t.setAttribute('datetime', now.toISOString()); });
    const diff = diffText(-now.getTimezoneOffset());
    diffs.forEach((d) => { d.textContent = diff; });
    clearTimeout(timer);
    // aligned to the next minute boundary
    timer = setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  };
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
