import { initTheme } from './ui/theme.js';
import { initSplit } from './ui/split.js';
import { initNav } from './ui/nav.js';
import { initPalette } from './ui/palette.js';
import { initFocus } from './ui/focus.js';
import { initCount } from './ui/count.js';
import { initClock } from './ui/clock.js';
import { initCopy } from './ui/copy.js';
import { initMagnetic } from './ui/magnetic.js';
import { initMisc } from './ui/misc.js';

const safe = (fn) => { try { fn(); } catch (err) { console.error(err); } };
[initTheme, initSplit, initNav, initPalette, initFocus, initCount, initClock, initCopy, initMagnetic, initMisc].forEach(safe);

function bootScene() {
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  idle(async () => {
    try {
      const m = await import('./scene/index.js');
      await m.init(canvas);
    } catch (err) {
      console.error(err);
      document.documentElement.classList.add('no-webgl');
    }
  });
}

if (document.readyState === 'complete') bootScene();
else addEventListener('load', bootScene, { once: true });
