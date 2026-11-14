import { Group, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer } from 'three';
import { CHAPTERS, HEIGHT, LAYERS, LINES, WIDTH, groupRot, makePose, pose } from './formations.js';
import { createConnectors, createPanel, setConnectorTheme, setPanelTheme, updateConnectors } from './layers.js';
import { createDust } from './dust.js';
import { createTextureSet, loadFonts } from './textures.js';
import { readTheme } from './theme.js';

const CAMERA_Z = 14;
const HALF_H = Math.tan((30 * Math.PI) / 360) * CAMERA_Z; // world half-height at z = 0
const CH = 10; // channels per layer: px py pz rx ry rz s o mix hl
const LAMBDA_POS = 6;
const LAMBDA_ROT = 7;
const LAMBDA_GROUP = 8;
const AMBIENT_SCALE = 0.72;
const AMBIENT_OPACITY = 0.12;
const NAV_H = 72; // fixed nav height; the carousel (chapter 3) fits below it
const INSET = [0, 0, 0, NAV_H, 0, 0];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (x) => x * x * (3 - 2 * x);
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const damp = (dt, lambda) => 1 - Math.exp(-dt * lambda);

export function init(canvas) {
  const root = document.documentElement;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    root.classList.add('no-webgl');
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

  const scene = new Scene();
  scene.matrixWorldAutoUpdate = false; // updated manually, once per frame, before sorting
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.z = CAMERA_Z;

  const mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)').matches;

  /* ---- scene objects ---- */
  const panels = Array.from({ length: LAYERS }, createPanel);
  const connectors = createConnectors(LAYERS);
  const dust = createDust(innerWidth < 768 ? 600 : 1200);
  const layerGroup = new Group();
  panels.forEach((p) => layerGroup.add(p.mesh));
  layerGroup.add(connectors.lines);
  scene.add(dust.points, layerGroup);

  const textures = createTextureSet(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  /* ---- state (all reused every frame) ---- */
  const focus = { job: 0, skill: null, project: null };
  const ctx = { job: 0, skill: null, project: null, aspect: 1, mobile: false, intro: 0 };
  const cur = new Float32Array(LAYERS * CH);
  const tgt = new Float32Array(LAYERS * CH);
  const poseA = makePose();
  const poseB = makePose();
  const rotA = [0, 0, 0];
  const rotB = [0, 0, 0];
  const placeA = { x: 0, y: 0, s: 1, o: 1 };
  const placeB = { x: 0, y: 0, s: 1, o: 1 };
  const grp = { x: 0, y: 0, s: 1, o: 1, rx: 0, ry: 0, rz: 0 };
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const depth = new Float32Array(LAYERS);
  const order = Array.from({ length: LAYERS }, (_, i) => i);
  const stages = Array.from({ length: CHAPTERS }, () => ({ w: 0, h: 0, cx: 0, inset: 0, docTop: 0, secTop: 0, secBottom: 0, sticky: false, fit: 1 }));
  const tops = new Float32Array(CHAPTERS).fill(Infinity);

  let theme = readTheme();
  let data = { jobs: [], projects: [] };
  let vw = innerWidth, vh = innerHeight, halfW = HALF_H, scrollY = scrollY0();
  let reduced = mqReduced.matches;
  let dirty = true;
  let snap = true;
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let introClock = 0;
  let ready = false;
  let texMobile = null;
  let dprMax = 2;
  let warm = 0, frames = 0, acc = 0;

  function scrollY0() { return window.scrollY || 0; }

  /* ---- data + textures + theme ---- */
  function readData() {
    const pick = (sel, n) => Array.from({ length: n }, (_, i) => {
      const el = document.querySelector(sel.replace('#', i));
      return el ? { ...el.dataset } : null;
    });
    return { jobs: pick('.job[data-job="#"]', 5), projects: pick('.project[data-project="#"]', 3) };
  }

  function applyTheme() {
    theme = readTheme();
    panels.forEach((p) => setPanelTheme(p, theme));
    setConnectorTheme(connectors, theme);
    dust.setTheme(theme);
  }

  function rebuildTextures() {
    data = readData();
    textures.build(theme, texMobile, data);
    panels.forEach((p, i) => { p.u.uTexA.value = textures.a[i]; p.u.uTexB.value = textures.b[i]; });
  }

  /* ---- layout cache: re-measured only on resize / body size change ---- */
  function applyDpr() {
    const dpr = Math.min(devicePixelRatio || 1, dprMax);
    renderer.setPixelRatio(dpr);
    dust.setPixelRatio(dpr);
  }

  function refresh() {
    dirty = false;
    vw = canvas.clientWidth || innerWidth;
    vh = canvas.clientHeight || innerHeight;
    applyDpr();
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
    halfW = HALF_H * camera.aspect;
    ctx.aspect = camera.aspect;
    scrollY = scrollY0();

    const mobile = vw < 768;
    ctx.mobile = mobile;
    if (ready && mobile !== texMobile) { texMobile = mobile; rebuildTextures(); }

    tops.fill(Infinity);
    stages.forEach((st) => { st.w = 0; st.h = 0; });
    // Natural (unstuck) stage top: batch static -> read -> restore so there is one reflow.
    const found = [];
    document.querySelectorAll('.chapter[data-chapter]').forEach((sec) => {
      const k = Number(sec.dataset.chapter);
      if (!(k >= 0 && k < CHAPTERS)) return;
      const stage = sec.querySelector('.stage');
      stages[k].sticky = !!stage && getComputedStyle(stage).position === 'sticky';
      found.push({ k, sec, stage });
    });
    found.forEach((f) => { if (f.stage) f.stage.style.position = 'static'; });
    found.forEach((f) => {
      const st = stages[f.k];
      const sr = f.sec.getBoundingClientRect();
      st.secTop = sr.top + scrollY;
      st.secBottom = sr.bottom + scrollY;
      tops[f.k] = st.secTop;
      if (!f.stage) return;
      const r = f.stage.getBoundingClientRect();
      st.w = r.width;
      st.h = r.height;
      st.cx = r.left + r.width / 2;
      st.docTop = r.top + scrollY;
    });
    found.forEach((f) => { if (f.stage) f.stage.style.position = ''; });
    found.forEach(({ k }) => {
      const st = stages[k];
      if (!st.w) return;
      st.inset = INSET[k];
      const worldW = (st.w / vw) * 2 * halfW;
      const worldH = ((st.h - st.inset) / vh) * 2 * HALF_H;
      st.fit = clamp(Math.min(worldW / WIDTH[k], worldH / HEIGHT[k]), 0.45, 1.4);
    });
  }

  // Stage -> world placement at z = 0. Zero-size stage means "ambient".
  function place(k, out) {
    const st = stages[k];
    if (st.w < 2 || st.h < 2) {
      out.x = 0; out.y = 0; out.s = AMBIENT_SCALE; out.o = AMBIENT_OPACITY;
      return;
    }
    // Sticky stages are pinned to the viewport while their section is in view.
    const top = st.sticky
      ? Math.min(Math.max(st.docTop - scrollY, 0), st.secBottom - scrollY - st.h)
      : st.docTop - scrollY;
    out.x = ((st.cx / vw) * 2 - 1) * halfW;
    out.y = -(((top + st.inset + (st.h - st.inset) / 2) / vh) * 2 - 1) * HALF_H;
    out.s = st.fit;
    out.o = 1;
  }

  // Boundary k morphs while the next section's top moves from 85% to 25% of the viewport.
  function progress() {
    let p = 0;
    for (let j = 1; j < CHAPTERS; j++) p += clamp((0.85 * vh - (tops[j] - scrollY)) / (0.6 * vh), 0, 1);
    return p;
  }

  /* ---- frame ---- */
  function adaptDpr(dt) {
    if (warm < 30) { warm++; return; }
    acc += dt;
    if (++frames < 90) return;
    const avg = acc / frames;
    frames = 0; acc = 0;
    const dpr = renderer.getPixelRatio();
    if (avg > 0.02 && dpr > 1) { dprMax = Math.max(1, dpr - 0.25); applyDpr(); }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (dirty) refresh();
    adaptDpr(dt);

    if (!reduced) { time += dt; introClock += dt; }
    const t = reduced ? 0 : time;

    const p = progress();
    const k = Math.min(Math.floor(p), CHAPTERS - 2);
    const f = clamp(p - k, 0, 1);

    ctx.job = focus.job; ctx.skill = focus.skill; ctx.project = focus.project;
    ctx.intro = reduced ? 1 : easeOut(clamp(introClock / 1.4, 0, 1));

    const kPos = damp(dt, LAMBDA_POS);
    const kRot = damp(dt, LAMBDA_ROT);
    const kGroup = damp(dt, LAMBDA_GROUP);

    // Group placement, rotation, ambient opacity
    place(k, placeA);
    place(k + 1, placeB);
    groupRot(k, t, rotA);
    groupRot(k + 1, t, rotB);
    const gx = placeA.x + (placeB.x - placeA.x) * f;
    const gy = placeA.y + (placeB.y - placeA.y) * f;
    const gs = placeA.s + (placeB.s - placeA.s) * f;
    const go = placeA.o + (placeB.o - placeA.o) * f;
    const grx = rotA[0] + (rotB[0] - rotA[0]) * f;
    const gry = rotA[1] + (rotB[1] - rotA[1]) * f;
    const grz = rotA[2] + (rotB[2] - rotA[2]) * f;
    const kg = snap ? 1 : kGroup;
    const kr = snap ? 1 : kRot;
    grp.x += (gx - grp.x) * kg; grp.y += (gy - grp.y) * kg;
    grp.s += (gs - grp.s) * kg; grp.o += (go - grp.o) * kg;
    grp.rx += (grx - grp.rx) * kr; grp.ry += (gry - grp.ry) * kr; grp.rz += (grz - grp.rz) * kr;
    pointer.x += (pointer.tx - pointer.x) * kRot;
    pointer.y += (pointer.ty - pointer.y) * kRot;

    layerGroup.position.set(grp.x, grp.y, 0);
    layerGroup.scale.setScalar(grp.s);
    layerGroup.rotation.set(grp.rx + pointer.y * 0.12, grp.ry + pointer.x * 0.18, grp.rz);

    // Per-layer targets with stagger, then damped chase
    for (let i = 0; i < LAYERS; i++) {
      const fi = smooth(clamp(f * 1.6 - (i * 0.6) / 7, 0, 1));
      pose(k, i, ctx, poseA);
      pose(k + 1, i, ctx, poseB);
      const o = i * CH;
      for (let c = 0; c < 3; c++) {
        tgt[o + c] = poseA.p[c] + (poseB.p[c] - poseA.p[c]) * fi;
        tgt[o + 3 + c] = poseA.r[c] + (poseB.r[c] - poseA.r[c]) * fi;
      }
      tgt[o + 6] = poseA.s + (poseB.s - poseA.s) * fi;
      tgt[o + 7] = poseA.o + (poseB.o - poseA.o) * fi;
      tgt[o + 8] = poseA.mix + (poseB.mix - poseA.mix) * fi;
      tgt[o + 9] = poseA.hl + (poseB.hl - poseA.hl) * fi;

      for (let c = 0; c < CH; c++) {
        const kc = snap ? 1 : c >= 3 && c < 6 ? kRot : kPos;
        cur[o + c] += (tgt[o + c] - cur[o + c]) * kc;
      }

      const panel = panels[i];
      const mesh = panel.mesh;
      const reveal = reduced ? 1 : easeInOut(clamp((introClock - i * 0.09) / 0.9, 0, 1));
      const op = cur[o + 7] * grp.o;
      const float = reduced ? 0 : Math.sin(t * 0.6 + i) * 0.03;
      mesh.position.set(cur[o], cur[o + 1] + float, cur[o + 2]);
      mesh.rotation.set(cur[o + 3], cur[o + 4], cur[o + 5]);
      mesh.scale.setScalar(Math.max(cur[o + 6], 0.001));
      mesh.updateMatrix();
      mesh.visible = op > 0.004 && cur[o + 6] > 0.01 && reveal > 0;
      panel.vis = mesh.visible ? op * reveal : 0;
      const u = panel.u;
      u.uOpacity.value = op;
      u.uMix.value = clamp(cur[o + 8], 0, 1);
      u.uHighlight.value = clamp(cur[o + 9], 0, 1);
      u.uReveal.value = reveal;
    }

    updateConnectors(connectors, panels, LINES[k] + (LINES[k + 1] - LINES[k]) * f);

    // Back-to-front draw order from world depth
    scene.updateMatrixWorld();
    for (let i = 0; i < LAYERS; i++) { depth[i] = panels[i].mesh.matrixWorld.elements[14]; order[i] = i; }
    for (let i = 1; i < LAYERS; i++) {
      const v = order[i];
      let j = i - 1;
      while (j >= 0 && depth[order[j]] > depth[v]) { order[j + 1] = order[j]; j--; }
      order[j + 1] = v;
    }
    for (let r = 0; r < LAYERS; r++) panels[order[r]].mesh.renderOrder = r + 1;

    dust.update(t, scrollY);
    renderer.render(scene, camera);
    snap = false;

    if (!root.classList.contains('scene-ready')) root.classList.add('scene-ready');
  }

  function start() {
    if (running || document.hidden || !ready) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  /* ---- listeners ---- */
  const markDirty = () => { dirty = true; };
  new ResizeObserver(markDirty).observe(canvas);
  new ResizeObserver(markDirty).observe(document.body);
  addEventListener('scroll', () => { scrollY = scrollY0(); }, { passive: true });
  addEventListener('load', markDirty);
  mqReduced.addEventListener('change', (e) => { reduced = e.matches; });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (finePointer) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  document.addEventListener('jobfocus', (e) => { focus.job = clamp(Math.round(e.detail?.index ?? 0), 0, 4); });
  document.addEventListener('skillfocus', (e) => { focus.skill = e.detail?.index ?? null; });
  document.addEventListener('projectfocus', (e) => { focus.project = e.detail?.index ?? null; });
  document.addEventListener('themechange', () => {
    applyTheme();
    if (ready) rebuildTextures();
  });

  /* ---- boot: wait for fonts so the first frame already has final textures ---- */
  applyTheme();
  loadFonts().then(() => {
    refresh();
    texMobile = ctx.mobile;
    ready = true;
    rebuildTextures();
    start();
  });
}
