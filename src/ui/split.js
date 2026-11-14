export function initSplit() {
  const root = document.documentElement;
  document.querySelectorAll('[data-split]').forEach((el) => {
    if (el.querySelector('.line')) return;
    // Collect lines: text accumulates, <br> starts a new line.
    const lines = [''];
    el.childNodes.forEach((n) => {
      if (n.nodeName === 'BR') lines.push('');
      else lines[lines.length - 1] += n.textContent;
    });
    const clean = lines.map((l) => l.trim()).filter(Boolean);
    el.setAttribute('aria-label', clean.join(' '));
    let i = 0;
    const frag = document.createDocumentFragment();
    clean.forEach((text) => {
      const line = document.createElement('span');
      line.className = 'line';
      line.style.display = 'block';
      line.setAttribute('aria-hidden', 'true');
      for (const c of text) {
        const ch = document.createElement('span');
        ch.className = 'ch';
        ch.setAttribute('aria-hidden', 'true');
        ch.style.setProperty('--i', i++);
        ch.textContent = c === ' ' ? ' ' : c;
        line.appendChild(ch);
      }
      frag.appendChild(line);
    });
    el.replaceChildren(frag);
  });
  const go = () => requestAnimationFrame(() => root.classList.add('is-loaded'));
  if (!document.fonts || !document.fonts.ready) { go(); return; }
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(go, go);
}
