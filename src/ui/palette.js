import { toggleTheme } from './theme.js';
import { copyEmail } from './copy.js';

/** Pure: case-insensitive; every whitespace-separated token must be a substring of label+keywords. Order preserved. */
export function filterItems(items, query) {
  const toks = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return items.slice();
  return items.filter((it) => {
    const hay = `${it.label} ${it.keywords || ''}`.toLowerCase();
    return toks.every((t) => hay.includes(t));
  });
}

const GROUPS = ['Navigate', 'Actions', 'Links'];

function buildItems() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = (id) => () => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    try { history.replaceState(null, '', `#${id}`); } catch { /* sandboxed */ }
  };
  const items = [
    ['top', 'Top', 'home hero intro boot'],
    ['about', 'Profile', 'about summary education languages parse'],
    ['skills', 'Skills', 'toolkit stack style'],
    ['experience', 'Experience', 'jobs work career layout'],
    ['projects', 'Projects', 'selected work paint'],
    ['contact', 'Contact', 'email hire ship reach'],
  ].map(([id, label, keywords]) => ({ group: 'Navigate', label, keywords, hint: `#${id}`, run: go(id) }));

  items.push({ group: 'Actions', label: 'Toggle theme', keywords: 'dark light mode appearance', hint: '', run: () => toggleTheme() });
  const email = document.querySelector('[data-copy]');
  if (email) items.push({ group: 'Actions', label: 'Copy email', keywords: 'address mail clipboard', hint: '', run: () => copyEmail(email.dataset.copy) });
  items.push({ group: 'Actions', label: 'Print / Save as PDF', keywords: 'resume cv download', hint: '', run: () => setTimeout(() => window.print(), 80) });

  // Link targets are read from the page so no URL is invented here.
  [['GitHub', 'github.com'], ['LinkedIn', 'linkedin.com'], ['X', 'x.com'], ['Medium', 'medium.com']].forEach(([label, host]) => {
    const a = document.querySelector(`a[href*="${host}"]`);
    if (a) items.push({ group: 'Links', label, keywords: `${host} social`, hint: host, run: () => window.open(a.href, '_blank', 'noopener,noreferrer') });
  });
  return items;
}

export function initPalette() {
  const dlg = document.getElementById('palette');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const opener = document.getElementById('palette-open');
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (/mac|iphone|ipad/i.test(plat)) document.querySelectorAll('[data-kbd-mod]').forEach((k) => { k.textContent = '⌘'; });

  const input = document.createElement('input');
  input.className = 'palette-input';
  input.type = 'text';
  input.placeholder = 'Search sections, actions, links…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', 'Search commands');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'palette-list');
  const list = document.createElement('ul');
  list.id = 'palette-list';
  list.className = 'palette-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Commands');
  dlg.replaceChildren(input, list);

  let all = [], shown = [], sel = 0, returnTo = null;

  const mark = (scroll) => {
    const opts = list.querySelectorAll('[role="option"]');
    opts.forEach((o, k) => o.setAttribute('aria-selected', String(k === sel)));
    const o = opts[sel];
    if (o) {
      input.setAttribute('aria-activedescendant', o.id);
      if (scroll) o.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const heading = (text) => {
    const h = document.createElement('li');
    h.className = 'palette-group';
    h.setAttribute('role', 'presentation');
    h.textContent = text;
    return h;
  };
  const render = () => {
    const hits = filterItems(all, input.value);
    shown = GROUPS.flatMap((g) => hits.filter((it) => it.group === g)); // DOM order === shown order
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    const frag = document.createDocumentFragment();
    let last = '';
    shown.forEach((it, i) => {
      if (it.group !== last) { last = it.group; frag.appendChild(heading(last)); }
      const li = document.createElement('li');
      li.className = 'palette-item';
      li.id = `palette-opt-${i}`;
      li.dataset.i = i;
      li.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.className = 'palette-label';
      label.textContent = it.label;
      const hint = document.createElement('span');
      hint.className = 'palette-hint';
      hint.textContent = it.hint;
      li.append(label, hint);
      frag.appendChild(li);
    });
    if (!shown.length) frag.appendChild(heading('No results'));
    list.replaceChildren(frag);
    mark(false);
  };
  const move = (i) => {
    if (!shown.length) return;
    sel = (i + shown.length) % shown.length;
    mark(true);
  };
  const run = (item) => {
    if (!item) return;
    dlg.close();
    item.run();
  };
  const open = () => {
    if (dlg.open) return;
    returnTo = document.activeElement;
    all = buildItems();
    input.value = '';
    sel = 0;
    dlg.showModal();
    render();
    input.focus();
  };
  const close = () => { if (dlg.open) dlg.close(); };

  dlg.addEventListener('close', () => {
    const t = returnTo;
    returnTo = null;
    if (t && t.isConnected && typeof t.focus === 'function') t.focus({ preventScroll: true });
  });
  input.addEventListener('input', () => { sel = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(sel + 1); break;
      case 'ArrowUp': e.preventDefault(); move(sel - 1); break;
      case 'Home': e.preventDefault(); move(0); break;
      case 'End': e.preventDefault(); move(shown.length - 1); break;
      case 'Enter': e.preventDefault(); run(shown[sel]); break;
      case 'Escape': e.preventDefault(); close(); break;
    }
  });
  list.addEventListener('pointermove', (e) => {
    const li = e.target.closest('[role="option"]');
    if (!li || Number(li.dataset.i) === sel) return;
    sel = Number(li.dataset.i);
    mark(false);
  }, { passive: true });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[role="option"]');
    if (li) run(shown[Number(li.dataset.i)]);
  });
  dlg.addEventListener('click', (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  });
  if (opener) opener.addEventListener('click', open);

  document.addEventListener('keydown', (e) => {
    if (!((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k')) return;
    const t = e.target;
    const typing = t && t !== input && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    if (typing) return;
    e.preventDefault();
    if (dlg.open) close(); else open();
  });
}
