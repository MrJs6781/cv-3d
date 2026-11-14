import { CanvasTexture, SRGBColorSpace } from 'three';
import { onColor, rgba } from './theme.js';

// Everything is designed on a fixed 1024x640 grid and scaled to the canvas size.
const W = 1024;
const H = 640;
const PAD = 48;
const SANS = "'Geist', ui-sans-serif, system-ui, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const FONT_SPECS = ['500 20px Geist', '600 20px Geist', '700 20px Geist', '400 16px "Geist Mono"', '500 16px "Geist Mono"'];

let g; // active 2D context
let C; // active theme colours

export function loadFonts() {
  const loads = FONT_SPECS.map((s) => document.fonts.load(s).catch(() => {}));
  const timeout = new Promise((r) => setTimeout(r, 2500));
  return Promise.race([Promise.all(loads).then(() => document.fonts.ready), timeout]);
}

/* ---------- drawing helpers ---------- */

const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const fillRR = (x, y, w, h, r, fill) => { rr(x, y, w, h, r); g.fillStyle = fill; g.fill(); };
const strokeRR = (x, y, w, h, r, stroke, lw = 2) => { rr(x, y, w, h, r); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); };
const bar = (x, y, w, h, fill) => fillRR(x, y, w, h, h / 2, fill);
const dot = (x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); };

function linear(x0, y0, x1, y1, stops) {
  const grad = g.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => grad.addColorStop(o, c));
  return grad;
}

function setFont(size, weight, mono) { g.font = `${weight} ${size}px ${mono ? MONO : SANS}`; }

function text(s, x, y, { size = 20, weight = 500, mono = false, color = C.ink, align = 'left', base = 'alphabetic' } = {}) {
  setFont(size, weight, mono);
  g.textAlign = align;
  g.textBaseline = base;
  g.fillStyle = color;
  g.fillText(s, x, y);
  return g.measureText(s).width;
}

function fitSize(s, maxW, size, weight, mono = false) {
  while (size > 26) {
    setFont(size, weight, mono);
    if (g.measureText(s).width <= maxW) break;
    size -= 2;
  }
  return size;
}

function chip(s, x, y, { h = 38, size = 17, fill = rgba(C.ink, 0.06), stroke = C.line, color = C.ink, mono = true, weight = 500 } = {}) {
  setFont(size, weight, mono);
  const w = Math.ceil(g.measureText(s).width + h * 0.9);
  fillRR(x, y, w, h, h / 2, fill);
  if (stroke) strokeRR(x, y, w, h, h / 2, stroke, 1.5);
  text(s, x + w / 2, y + h / 2 + 1, { size, mono, color, weight, align: 'center', base: 'middle' });
  return w;
}

// Wrapping chip row; returns the y of the row's bottom edge.
function chipRows(list, x, y, maxX, opts = {}) {
  const h = opts.h ?? 38;
  let cx = x;
  let cy = y;
  for (const s of list) {
    setFont(opts.size ?? 17, 500, true);
    const w = Math.ceil(g.measureText(s).width + h * 0.9);
    if (cx + w > maxX && cx > x) { cx = x; cy += h + 12; }
    if (cy + h > H - 40) break;
    cx += chip(s, cx, cy, opts) + 12;
  }
  return cy + h;
}

function check(cx, cy, s, color, lw = 3) {
  g.beginPath();
  g.moveTo(cx - s * 0.5, cy);
  g.lineTo(cx - s * 0.15, cy + s * 0.35);
  g.lineTo(cx + s * 0.5, cy - s * 0.35);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

// Smooth curve through points using quadratic mid-point joins.
function curve(pts) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    g.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

function lineChart(x, y, w, h, vals, color) {
  const pts = vals.map((v, i) => [x + (i / (vals.length - 1)) * w, y + h - v * h]);
  g.beginPath();
  curve(pts);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.closePath();
  g.fillStyle = linear(0, y, 0, y + h, [[0, rgba(color, 0.28)], [1, rgba(color, 0)]]);
  g.fill();
  g.beginPath();
  curve(pts);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
  const [ex, ey] = pts[pts.length - 1];
  dot(ex, ey, 11, rgba(color, 0.22));
  dot(ex, ey, 5.5, color);
}

function card(x, y, w, h, r = 16) {
  fillRR(x, y, w, h, r, rgba(C.ink, 0.04));
  strokeRR(x, y, w, h, r, C.line, 1.5);
}

function caption(s, x, y, align = 'left') {
  text(s, x, y, { size: 14, mono: true, color: C.muted, align });
}

// Shared panel chrome: translucent surface, soft light, hairline frame, mono label.
function frame(label) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = rgba(C.surface, C.name === 'light' ? 0.95 : 0.9);
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(150, 0, 0, 150, 0, 820);
  glow.addColorStop(0, rgba(C.accent, C.name === 'light' ? 0.07 : 0.11));
  glow.addColorStop(1, rgba(C.accent, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  strokeRR(10, 10, W - 20, H - 20, 16, rgba(C.line, 0.9), 2);
  text(label, PAD, 60, { size: 16, mono: true, color: C.muted });
}

/* ---------- texA: one per layer ---------- */

function drawFrontend() {
  frame('00 / FRONTEND');
  const x = PAD, y = 92, w = W - 2 * PAD, h = 500;
  card(x, y, w, h, 18);
  g.save();
  rr(x, y, w, h, 18); g.clip();
  g.fillStyle = rgba(C.ink, 0.04);
  g.fillRect(x, y, w, 56);
  g.fillStyle = C.line;
  g.fillRect(x, y + 56, w, 1.5);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => dot(x + 32 + i * 24, y + 28, 7, c));
  fillRR(x + 150, y + 12, 360, 32, 16, rgba(C.ink, 0.06));
  dot(x + 174, y + 28, 5, C.mint);
  text('~/resume', x + 192, y + 28, { size: 16, mono: true, color: C.muted, base: 'middle' });
  // nav skeleton
  bar(x + 40, y + 88, 64, 14, C.accent);
  [48, 56, 44].forEach((bw, i) => bar(x + w - 40 - (3 - i) * 72 + (72 - bw), y + 90, bw, 10, rgba(C.muted, 0.45)));
  // hero skeleton
  bar(x + 40, y + 140, 470, 40, rgba(C.ink, 0.88));
  bar(x + 40, y + 196, 330, 40, linear(x + 40, 0, x + 370, 0, [[0, C.accent], [1, C.accent2]]));
  bar(x + 40, y + 262, 500, 12, rgba(C.muted, 0.5));
  bar(x + 40, y + 288, 400, 12, rgba(C.muted, 0.5));
  fillRR(x + 40, y + 332, 168, 46, 23, C.accent);
  bar(x + 72, y + 351, 104, 8, rgba(onColor(C.accent), 0.8));
  strokeRR(x + 224, y + 332, 150, 46, 23, C.line, 2);
  bar(x + 254, y + 351, 90, 8, rgba(C.muted, 0.6));
  // art card
  fillRR(x + 570, y + 108, 318, 280, 22, linear(x + 570, y + 108, x + 888, y + 388, [[0, rgba(C.accent, 0.9)], [1, rgba(C.accent2, 0.9)]]));
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 2;
  [70, 120, 170].forEach((r) => { g.beginPath(); g.arc(x + 800, y + 190, r, 0, Math.PI * 2); g.stroke(); });
  fillRR(x + 596, y + 316, 190, 54, 14, rgba(C.surface, 0.92));
  dot(x + 622, y + 343, 11, C.mint);
  bar(x + 646, y + 333, 100, 8, rgba(C.ink, 0.75));
  bar(x + 646, y + 349, 64, 7, rgba(C.muted, 0.6));
  // stat tiles
  for (let i = 0; i < 3; i++) {
    strokeRR(x + 40 + i * 168, y + 416, 148, 56, 14, C.line, 1.5);
    bar(x + 58 + i * 168, y + 434, 56, 10, rgba(C.muted, 0.5));
    bar(x + 58 + i * 168, y + 452, 88, 8, rgba(C.ink, 0.25));
  }
  g.restore();
}

function drawUIKit() {
  frame('01 / UI & STYLING');
  const L = PAD, R = 536;
  caption('BUTTON', L, 112);
  fillRR(L, 128, 168, 52, 14, C.accent);
  text('Primary', L + 84, 155, { size: 20, weight: 600, color: onColor(C.accent), align: 'center', base: 'middle' });
  strokeRR(L + 184, 128, 140, 52, 14, C.line, 2);
  text('Ghost', L + 254, 155, { size: 20, weight: 600, align: 'center', base: 'middle' });

  caption('TOGGLE', L, 222);
  fillRR(L, 238, 64, 36, 18, C.accent);
  dot(L + 46, 256, 14, onColor(C.accent));
  text('On', L + 80, 257, { size: 18, mono: true, color: C.muted, base: 'middle' });
  fillRR(L + 160, 238, 64, 36, 18, rgba(C.ink, 0.12));
  dot(L + 178, 256, 14, rgba(C.ink, 0.55));
  text('Off', L + 240, 257, { size: 18, mono: true, color: C.muted, base: 'middle' });

  caption('INPUT', L, 312);
  fillRR(L, 328, 440, 56, 14, rgba(C.ink, 0.03));
  strokeRR(L, 328, 440, 56, 14, C.accent, 2.5);
  text('you@domain.dev', L + 20, 357, { size: 20, color: C.ink, base: 'middle' });
  g.fillStyle = C.accent;
  g.fillRect(L + 188, 344, 2.5, 26);

  caption('CHIP', L, 422);
  let cx = L;
  cx += chip('React', cx, 438, { fill: rgba(C.accent, 0.16), stroke: rgba(C.accent, 0.6), color: C.accent, size: 18, h: 40 }) + 12;
  cx += chip('Next.js', cx, 438, { size: 18, h: 40 }) + 12;
  chip('Tailwind', cx, 438, { size: 18, h: 40 });

  caption('COLOR', R, 112);
  [[C.accent, 'accent'], [C.accent2, 'accent-2'], [C.mint, 'mint'], [C.ink, 'ink'], [C.line, 'line']].forEach(([c, name], i) => {
    const sx = R + i * 91;
    fillRR(sx, 128, 74, 74, 16, c);
    strokeRR(sx, 128, 74, 74, 16, rgba(C.ink, 0.12), 1.5);
    text(name, sx + 37, 226, { size: 13, mono: true, color: C.muted, align: 'center' });
  });

  caption('CARD', R, 282);
  card(R, 298, 440, 254, 18);
  dot(R + 52, 354, 24, linear(R + 28, 330, R + 76, 378, [[0, C.accent], [1, C.accent2]]));
  text('Design System', R + 92, 350, { size: 22, weight: 600 });
  text('v2.4 · 48 components', R + 92, 376, { size: 14, mono: true, color: C.muted });
  chip('Stable', R + 440 - 24 - 84, 336, { fill: rgba(C.mint, 0.16), stroke: rgba(C.mint, 0.5), color: C.mint, size: 14, h: 32 });
  bar(R + 28, 410, 384, 10, rgba(C.muted, 0.35));
  bar(R + 28, 434, 290, 10, rgba(C.muted, 0.35));
  bar(R + 28, 480, 384, 8, rgba(C.ink, 0.1));
  bar(R + 28, 480, 276, 8, C.accent);
  text('72%', R + 412, 512, { size: 14, mono: true, color: C.muted, align: 'right' });
}

function drawDashboard() {
  frame('02 / STATE & DATA');
  const tw = 293;
  [['LCP', '1.2s', '-18%'], ['UPTIME', '99.98%', '+0.02'], ['THROUGHPUT', '4.2k/s', '+24%']].forEach(([label, value, delta], i) => {
    const x = PAD + i * (tw + 24);
    card(x, 92, tw, 118, 16);
    caption(label, x + 22, 126);
    text(value, x + 22, 182, { size: 44, weight: 600 });
    chip(delta, x + tw - 22 - 78, 104, { fill: rgba(C.mint, 0.14), stroke: null, color: C.mint, size: 14, h: 28 });
  });
  card(PAD, 232, 520, 360, 18);
  caption('REQUESTS · 24H', PAD + 24, 270);
  const cx = PAD + 24, cy = 296, cw = 472, ch = 250;
  g.strokeStyle = rgba(C.line, 0.9);
  g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx, cy + (i / 3) * ch); g.lineTo(cx + cw, cy + (i / 3) * ch); g.stroke(); }
  lineChart(cx, cy + 10, cw, ch - 20, [0.3, 0.42, 0.36, 0.55, 0.48, 0.66, 0.6, 0.78, 0.7, 0.88, 0.82, 0.96], C.accent);

  const bx = PAD + 520 + 24, bw = W - PAD - bx;
  card(bx, 232, bw, 360, 18);
  caption('LATENCY · P95', bx + 24, 270);
  const vals = [0.5, 0.62, 0.44, 0.7, 0.56, 0.82, 0.64, 0.92];
  const gap = 12, barW = (bw - 48 - gap * 7) / 8;
  vals.forEach((v, i) => {
    const bh = v * 240;
    fillRR(bx + 24 + i * (barW + gap), 546 - bh, barW, bh, 8, rgba(C.accent2, i === 7 ? 1 : 0.4));
  });
}

function drawBackend() {
  frame('03 / BACKEND');
  const NH = 64;
  const nodes = {
    client: { x: 56, y: 316, w: 150, label: 'Client', c: C.mint },
    next: { x: 336, y: 190, w: 214, label: 'Next.js API', c: C.accent },
    nest: { x: 336, y: 442, w: 168, label: 'NestJS', c: C.accent2 },
    pg: { x: 770, y: 190, w: 206, label: 'PostgreSQL', c: C.accent },
    mongo: { x: 770, y: 442, w: 186, label: 'MongoDB', c: C.mint },
  };
  const right = (n) => [n.x + n.w, n.y + NH / 2];
  const left = (n) => [n.x, n.y + NH / 2];
  const wire = (a, b) => {
    const [x1, y1] = right(a), [x2, y2] = left(b), mx = (x1 + x2) / 2;
    g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(mx, y1, mx, y2, x2, y2);
    g.strokeStyle = linear(x1, 0, x2, 0, [[0, rgba(a.c, 0.8)], [1, rgba(b.c, 0.8)]]);
    g.lineWidth = 3; g.lineCap = 'round'; g.stroke();
    dot((x1 + x2) / 2, (y1 + y2) / 2, 5, C.ink);
  };
  wire(nodes.client, nodes.next);
  wire(nodes.next, nodes.pg);
  wire(nodes.nest, nodes.pg);
  wire(nodes.nest, nodes.mongo);
  // Next.js -> NestJS (vertical)
  g.beginPath(); g.moveTo(nodes.next.x + 60, nodes.next.y + NH); g.lineTo(nodes.next.x + 60, nodes.nest.y);
  g.strokeStyle = rgba(C.accent2, 0.8); g.lineWidth = 3; g.stroke();
  dot(nodes.next.x + 60, (nodes.next.y + nodes.nest.y + NH) / 2, 5, C.ink);
  // client -> NestJS
  const [cx1, cy1] = right(nodes.client), [cx2, cy2] = left(nodes.nest);
  g.beginPath(); g.moveTo(cx1, cy1); g.bezierCurveTo((cx1 + cx2) / 2, cy1, (cx1 + cx2) / 2, cy2, cx2, cy2);
  g.strokeStyle = rgba(C.muted, 0.5); g.lineWidth = 2.5; g.setLineDash([8, 8]); g.stroke(); g.setLineDash([]);

  for (const n of Object.values(nodes)) {
    fillRR(n.x, n.y, n.w, NH, 16, C.surface);
    fillRR(n.x, n.y, n.w, NH, 16, rgba(C.ink, 0.05));
    strokeRR(n.x, n.y, n.w, NH, 16, rgba(n.c, 0.65), 2);
    dot(n.x + 26, n.y + NH / 2, 6, n.c);
    text(n.label, n.x + 46, n.y + NH / 2 + 1, { size: 21, weight: 600, base: 'middle' });
  }
  chip('JWT', 256, 258, { fill: rgba(C.mint, 0.16), stroke: rgba(C.mint, 0.6), color: C.mint, size: 15, h: 32, weight: 600 });
  caption('REST · JSON', 600, 160);
  caption('SQL', 800, 548);
}

function drawTesting() {
  frame('04 / TESTING & QUALITY');
  chip('PASS', PAD, 92, { fill: rgba(C.mint, 0.16), stroke: rgba(C.mint, 0.6), color: C.mint, size: 15, h: 34, weight: 600 });
  text('12 passed · 0 failed', PAD + 92, 110, { size: 16, mono: true, color: C.muted, base: 'middle' });
  const rows = ['hero.render.test', 'theme.toggle.test', 'api.auth.test', 'form.validation.test', 'a11y.axe.test', 'e2e.checkout.test'];
  const times = ['12ms', '8ms', '41ms', '19ms', '63ms', '212ms'];
  rows.forEach((name, i) => {
    const y = 156 + i * 70;
    dot(PAD + 18, y + 28, 18, rgba(C.mint, 0.16));
    check(PAD + 18, y + 28, 14, C.mint, 3);
    text(name, PAD + 54, y + 29, { size: 20, mono: true, base: 'middle' });
    text(times[i], 500, y + 29, { size: 16, mono: true, color: C.muted, align: 'right', base: 'middle' });
    g.fillStyle = rgba(C.line, 0.9);
    g.fillRect(PAD, y + 60, 452, 1.5);
  });
  g.fillStyle = rgba(C.line, 0.9);
  g.fillRect(534, 100, 1.5, 492);
  [['PERF', 0], ['A11Y', 1], ['BEST', 2], ['SEO', 3]].forEach(([label, i]) => {
    const rx = 664 + (i % 2) * 208, ry = 232 + ((i / 2) | 0) * 220, r = 62;
    g.beginPath(); g.arc(rx, ry, r, 0, Math.PI * 2);
    g.strokeStyle = rgba(C.mint, 0.16); g.lineWidth = 11; g.stroke();
    g.beginPath(); g.arc(rx, ry, r, -Math.PI / 2, Math.PI * 1.5);
    g.strokeStyle = C.mint; g.lineCap = 'round'; g.stroke();
    text('100', rx, ry + 2, { size: 38, weight: 600, align: 'center', base: 'middle' });
    text(label, rx, ry + r + 34, { size: 14, mono: true, color: C.muted, align: 'center' });
  });
}

function drawTools() {
  frame('05 / TOOLS & WORKFLOW');
  const x = PAD, y = 92, w = W - 2 * PAD;
  fillRR(x, y, w, 282, 18, rgba(C.ink, C.name === 'light' ? 0.06 : 0.28));
  strokeRR(x, y, w, 282, 18, C.line, 1.5);
  [0, 1, 2].forEach((i) => dot(x + 30 + i * 22, y + 28, 6, rgba(C.muted, 0.6)));
  text('zsh — ~/resume', x + w / 2, y + 28, { size: 14, mono: true, color: C.muted, align: 'center', base: 'middle' });
  g.fillStyle = C.line; g.fillRect(x, y + 56, w, 1.5);
  const t = (s, tx, ty, color = C.ink, size = 22) => text(s, tx, ty, { size, mono: true, color });
  t('$', x + 28, y + 106, C.mint);
  const cmdW = text('git commit -m ', x + 56, y + 106, { size: 22, mono: true });
  t('"feat: ship"', x + 56 + cmdW, y + 106, C.accent2);
  t('[main 3f9c2ab] feat: ship', x + 28, y + 144, C.muted, 19);
  t('12 files changed, 480 insertions(+)', x + 28, y + 174, C.muted, 19);
  t('$', x + 28, y + 224, C.mint); t('git push origin main', x + 56, y + 224);
  t('$', x + 28, y + 262, C.mint);
  g.fillStyle = C.accent; g.fillRect(x + 58, y + 244, 13, 24);

  caption('CI PIPELINE', x, 412);
  const sw = 270, gap = 59;
  ['build', 'test', 'deploy'].forEach((name, i) => {
    const sx = x + i * (sw + gap), sy = 432;
    card(sx, sy, sw, 140, 18);
    dot(sx + 38, sy + 40, 18, rgba(C.mint, 0.16));
    check(sx + 38, sy + 40, 14, C.mint, 3);
    text(name, sx + 70, sy + 41, { size: 26, weight: 600, base: 'middle' });
    text(['24s', '38s', '9s'][i], sx + sw - 24, sy + 41, { size: 16, mono: true, color: C.muted, align: 'right', base: 'middle' });
    bar(sx + 24, sy + 100, sw - 48, 8, rgba(C.mint, 0.18));
    bar(sx + 24, sy + 100, sw - 48, 8, C.mint);
    if (i < 2) {
      g.beginPath(); g.moveTo(sx + sw + 12, sy + 70); g.lineTo(sx + sw + gap - 12, sy + 70);
      g.strokeStyle = C.muted; g.lineWidth = 2.5; g.lineCap = 'round'; g.stroke();
      g.beginPath(); g.moveTo(sx + sw + gap - 20, sy + 62); g.lineTo(sx + sw + gap - 11, sy + 70); g.lineTo(sx + sw + gap - 20, sy + 78); g.stroke();
    }
  });
}

function drawTokens() {
  frame('06 / FOUNDATION');
  caption('SPACING', PAD, 112);
  [4, 8, 12, 16, 24, 32, 48, 64].forEach((v, i) => {
    const y = 134 + i * 56;
    text(`${v}px`, PAD, y + 15, { size: 15, mono: true, color: C.muted, base: 'middle' });
    fillRR(PAD + 64, y + 2, v * 5.2, 26, 7, rgba(C.accent, 0.3 + i * 0.1));
  });
  const R = 536;
  caption('TYPE', R, 112);
  g.fillStyle = rgba(C.line, 0.9);
  g.fillRect(R - 28, 100, 1.5, 492);
  [[96, 218, 'H1 · 96'], [64, 304, 'H2 · 64'], [44, 368, 'H3 · 44'], [30, 420, 'BODY · 30']].forEach(([size, base, label]) => {
    text('Aa', R, base, { size, weight: 600 });
    text(label, W - PAD, base, { size: 14, mono: true, color: C.muted, align: 'right' });
  });
  caption('COLOR', R, 478);
  [C.accent, C.accent2, C.mint, C.ink, C.muted, C.line].forEach((c, i) => {
    dot(R + 22 + i * 60, 524, 22, c);
    g.beginPath(); g.arc(R + 22 + i * 60, 524, 22, 0, Math.PI * 2);
    g.strokeStyle = rgba(C.ink, 0.14); g.lineWidth = 1.5; g.stroke();
  });
}

function drawShip() {
  frame('07 / SHIP');
  dot(PAD + 20, 138, 18, rgba(C.mint, 0.18));
  dot(PAD + 20, 138, 8, C.mint);
  text('Production · Ready', PAD + 56, 138, { size: 34, weight: 600, base: 'middle' });
  chip('3f9c2ab', W - PAD - 130, 120, { size: 16, h: 36 });
  fillRR(PAD, 184, W - 2 * PAD, 64, 16, rgba(C.ink, C.name === 'light' ? 0.06 : 0.28));
  strokeRR(PAD, 184, W - 2 * PAD, 64, 16, C.line, 1.5);
  text('$', PAD + 26, 217, { size: 22, mono: true, color: C.mint, base: 'middle' });
  text('vercel --prod', PAD + 54, 217, { size: 22, mono: true, base: 'middle' });
  check(W - PAD - 100, 216, 14, C.mint, 3);
  text('24s', W - PAD - 72, 217, { size: 18, mono: true, color: C.muted, base: 'middle' });
  [['REGION', 'iad1'], ['BUILD', '24s'], ['EDGE', 'Global']].forEach(([label, value], i) => {
    const x = PAD + i * 317;
    caption(label, x, 288);
    text(value, x, 326, { size: 30, weight: 600 });
  });
  card(PAD, 360, W - 2 * PAD, 232, 18);
  caption('RESPONSE TIME · P95', PAD + 24, 398);
  text('38 ms', W - PAD - 24, 400, { size: 28, weight: 600, color: C.mint, align: 'right' });
  lineChart(PAD + 24, 424, W - 2 * PAD - 48, 140, [0.5, 0.42, 0.56, 0.38, 0.46, 0.34, 0.5, 0.3, 0.4, 0.28, 0.36, 0.3], C.mint);
}

const DRAW_A = [drawFrontend, drawUIKit, drawDashboard, drawBackend, drawTesting, drawTools, drawTokens, drawShip];

/* ---------- texB: jobs (0-4) and projects (5-7) ---------- */

function drawJob(i, job) {
  frame('EXPERIENCE');
  const d = job || {};
  const glow = g.createRadialGradient(W - 140, 120, 0, W - 140, 120, 360);
  glow.addColorStop(0, rgba(C.accent2, 0.16));
  glow.addColorStop(1, rgba(C.accent2, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  if (d.period) text(d.period, W - PAD, 60, { size: 16, mono: true, color: C.muted, align: 'right' });
  text(`0${i + 1}`, PAD, 128, { size: 22, weight: 500, mono: true, color: C.accent });
  bar(PAD + 44, 120, 56, 2.5, rgba(C.accent, 0.6));
  if (d.company) {
    const size = fitSize(d.company, W - 2 * PAD, 84, 600);
    text(d.company, PAD, 230, { size, weight: 600 });
  } else {
    bar(PAD, 176, 520, 54, rgba(C.ink, 0.12));
  }
  if (d.role) text(d.role, PAD, 292, { size: 34, weight: 500, color: rgba(C.ink, 0.82) });
  else bar(PAD, 270, 340, 22, rgba(C.muted, 0.3));
  if (d.place) {
    dot(PAD + 6, 338, 5, C.mint);
    text(d.place, PAD + 24, 339, { size: 20, mono: true, color: C.muted, base: 'middle' });
  }
  g.fillStyle = rgba(C.line, 0.9);
  g.fillRect(PAD, 376, W - 2 * PAD, 1.5);
  caption('STACK', PAD, 412);
  const tech = (d.tech || '').split('·').map((s) => s.trim()).filter(Boolean);
  if (tech.length) chipRows(tech, PAD, 430, W - PAD, { size: 19, h: 44 });
  else [120, 90, 140].reduce((x, w) => { bar(x, 440, w, 26, rgba(C.muted, 0.3)); return x + w + 14; }, PAD);
}

// Mini illustrations are drawn in a local 928x336 box.
function artMap() {
  g.strokeStyle = rgba(C.ink, 0.08);
  g.lineCap = 'round';
  g.lineWidth = 14;
  [[0, 240, 928, 190], [0, 110, 928, 150], [200, 0, 260, 336], [620, 0, 560, 336], [0, 330, 400, 0]].forEach(([x1, y1, x2, y2]) => {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  });
  const route = [[110, 270], [250, 210], [360, 220], [470, 130], [640, 150], [780, 70]];
  g.beginPath(); curve(route);
  g.strokeStyle = rgba(C.accent, 0.22); g.lineWidth = 18; g.lineJoin = 'round'; g.stroke();
  g.strokeStyle = C.accent; g.lineWidth = 6; g.stroke();
  [[250, 210], [470, 130]].forEach(([x, y]) => { dot(x, y, 8, C.surface); strokeRR(x - 8, y - 8, 16, 16, 8, C.accent, 3); });
  dot(110, 270, 20, rgba(C.mint, 0.22)); dot(110, 270, 10, C.mint);
  dot(780, 70, 22, rgba(C.accent2, 0.22)); dot(780, 70, 13, C.accent2); dot(780, 70, 5, C.surface);
  fillRR(28, 24, 270, 84, 16, rgba(C.surface, 0.94));
  strokeRR(28, 24, 270, 84, 16, C.line, 1.5);
  text('12 min', 52, 62, { size: 30, weight: 600 });
  text('4.8 km · fastest route', 52, 90, { size: 14, mono: true, color: C.muted });
}

function artAdmin() {
  fillRR(0, 0, 176, 336, 0, rgba(C.ink, 0.04));
  g.fillStyle = C.line; g.fillRect(176, 0, 1.5, 336);
  bar(24, 28, 80, 14, C.accent);
  [0, 1, 2, 3, 4].forEach((n) => {
    if (n === 1) fillRR(12, 70 + n * 42, 152, 34, 10, rgba(C.accent, 0.16));
    bar(28, 83 + n * 42, 70 + (n % 3) * 18, 8, n === 1 ? C.accent : rgba(C.muted, 0.5));
  });
  fillRR(204, 20, 360, 36, 18, rgba(C.ink, 0.05));
  dot(224, 38, 6, rgba(C.muted, 0.6));
  dot(900, 38, 16, linear(884, 22, 916, 54, [[0, C.accent], [1, C.accent2]]));
  ['NAME', 'STATUS', 'ROLE', 'UPDATED'].forEach((s, n) => text(s, 204 + [0, 250, 430, 610][n], 102, { size: 13, mono: true, color: C.muted }));
  g.fillStyle = C.line; g.fillRect(204, 114, 700, 1.5);
  const tones = [C.mint, C.accent, C.muted, C.mint, C.accent2];
  for (let n = 0; n < 5; n++) {
    const y = 130 + n * 40;
    bar(204, y + 12, 110 + (n * 23) % 60, 9, rgba(C.ink, 0.55));
    chip(['Active', 'Review', 'Draft', 'Active', 'Paused'][n], 454, y, { size: 12, h: 28, fill: rgba(tones[n], 0.14), stroke: null, color: tones[n] });
    bar(634, y + 12, 70, 9, rgba(C.muted, 0.45));
    bar(814, y + 12, 60, 9, rgba(C.muted, 0.3));
  }
}

function artDash() {
  [C.accent, C.accent2, C.mint].forEach((c, n) => {
    const x = n * 316;
    card(x, 0, 296, 96, 16);
    bar(x + 22, 24, 70, 9, rgba(C.muted, 0.5));
    text(['2,481', '86%', '+12.4%'][n], x + 22, 76, { size: 32, weight: 600 });
    dot(x + 262, 32, 10, rgba(c, 0.3)); dot(x + 262, 32, 4, c);
  });
  card(0, 116, 928, 220, 16);
  const vals = [0.3, 0.46, 0.38, 0.6, 0.5, 0.72, 0.58, 0.8, 0.68, 0.9, 0.78, 0.95];
  vals.forEach((v, n) => fillRR(28 + n * 72, 316 - v * 150, 44, v * 150, 8, rgba(C.accent2, 0.22)));
  lineChart(50, 150, 828, 150, vals.map((v) => v * 0.9 + 0.05), C.accent);
}

const ART = [artMap, artAdmin, artDash];

function drawProject(k, project) {
  const d = project || {};
  frame(`PROJECT · 0${k + 1}`);
  if (d.title) text(d.title, PAD, 156, { size: fitSize(d.title, W - 2 * PAD, 60, 600), weight: 600 });
  else bar(PAD, 118, 420, 44, rgba(C.ink, 0.12));
  const tech = (d.tech || '').split('·').map((s) => s.trim()).filter(Boolean);
  if (tech.length) {
    let cx = PAD;
    for (const s of tech) {
      setFont(16, 500, true);
      if (cx + g.measureText(s).width + 32 > W - PAD) break;
      cx += chip(s, cx, 184, { size: 16, h: 36 }) + 10;
    }
  } else [100, 80, 120].reduce((x, w) => { bar(x, 192, w, 22, rgba(C.muted, 0.3)); return x + w + 12; }, PAD);

  const ax = PAD, ay = 256, aw = W - 2 * PAD, ah = H - 48 - ay;
  fillRR(ax, ay, aw, ah, 18, rgba(C.ink, 0.03));
  g.save();
  rr(ax, ay, aw, ah, 18); g.clip();
  g.translate(ax, ay);
  ART[k]();
  g.restore();
  strokeRR(ax, ay, aw, ah, 18, C.line, 1.5);
}

const drawB = (i, data) => (i < 5 ? drawJob(i, data.jobs[i]) : drawProject(i - 5, data.projects[i - 5]));

/* ---------- texture set ---------- */

export function createTextureSet(maxAnisotropy) {
  const a = [];
  const b = [];
  let width = 0;

  function make(w) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = Math.round(w * (H / W));
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return tex;
  }

  function dispose() {
    [...a, ...b].forEach((t) => t.dispose());
    a.length = 0;
    b.length = 0;
  }

  function paint(tex, fn) {
    const canvas = tex.image;
    g = canvas.getContext('2d');
    g.setTransform(canvas.width / W, 0, 0, canvas.width / W, 0, 0);
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
    g.setLineDash([]);
    fn();
    tex.needsUpdate = true;
  }

  return {
    a,
    b,
    // Redraws in place when the resolution is unchanged; otherwise swaps in fresh textures.
    build(theme, mobile, data) {
      const w = mobile ? 768 : 1024;
      if (w !== width) {
        dispose();
        width = w;
        for (let i = 0; i < 8; i++) { a.push(make(w)); b.push(make(w)); }
      }
      C = theme;
      for (let i = 0; i < 8; i++) {
        paint(a[i], DRAW_A[i]);
        paint(b[i], () => drawB(i, data));
      }
    },
    dispose,
  };
}
