import { toast } from './toast.js';

/** Copy text; resolves true on success. Clipboard API first, execCommand fallback. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  const prev = document.activeElement;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand('copy');
  } catch { ok = false; }
  ta.remove();
  if (prev && typeof prev.focus === 'function') prev.focus({ preventScroll: true });
  return ok;
}

export async function copyEmail(text) {
  const ok = await copyText(text);
  toast(ok ? 'Email copied' : 'Could not copy — select the address manually');
  return ok;
}

export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.textContent;
    let timer = 0;
    btn.addEventListener('click', async () => {
      const ok = await copyEmail(btn.dataset.copy);
      if (!ok) return;
      btn.textContent = 'Copied ✓';
      clearTimeout(timer);
      timer = setTimeout(() => { btn.textContent = label; }, 1600);
    });
  });
}
