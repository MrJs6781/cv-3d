// Pure pose maths: no three, no DOM. Poses are in group space.
export const CHAPTERS = 6;
export const LAYERS = 8;

// Nominal formation footprint (world units) used to fit the group to the .stage rect.
export const WIDTH = [4.2, 6.8, 11.9, 4.0, 8.4, 3.3];
export const HEIGHT = [3.4, 4.4, 5.0, 7.3, 3.0, 2.5];
// Connector-line visibility per chapter.
export const LINES = [0.3, 1, 0, 0, 0, 0];

const GROUP_ROT = [
  [-0.5, 0.62, 0],
  [-0.32, 0.95, 0.02],
  [-0.08, -0.18, 0],
  [-0.04, -0.12, 0],
  [-0.06, 0, 0],
  [-0.45, 0.35, 0],
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

export const makePose = () => ({ p: [0, 0, 0], r: [0, 0, 0], s: 1, o: 1, mix: 0, hl: 0 });

function set(out, px, py, pz, rx, ry, rz, s, o, mix, hl) {
  out.p[0] = px; out.p[1] = py; out.p[2] = pz;
  out.r[0] = rx; out.r[1] = ry; out.r[2] = rz;
  out.s = s; out.o = o; out.mix = mix; out.hl = hl;
  return out;
}

const hide = (out, mix) => set(out, 0, 0, -1.5, 0, 0, 0, 0.001, 0, mix, 0);

// Group rotation for a chapter. Ship sways slowly instead of a full turn so the
// chapter blend never has to unwind an unbounded angle.
export function groupRot(chapter, t, out) {
  const c = clamp(chapter | 0, 0, CHAPTERS - 1);
  out[0] = GROUP_ROT[c][0];
  out[1] = GROUP_ROT[c][1] + (c === 5 ? Math.sin(t * 0.25) * 0.55 : 0);
  out[2] = GROUP_ROT[c][2];
  return out;
}

export function pose(chapter, layer, ctx, out = makePose()) {
  const c = clamp(chapter | 0, 0, CHAPTERS - 1);
  const i = clamp(layer | 0, 0, LAYERS - 1);
  const job = clamp(num(ctx.job, 0), 0, 4);
  const intro = num(ctx.intro, 1);
  const spread = (gap) => (3.5 - i) * gap; // layer 0 (UI) sits in front

  switch (c) {
    case 0:
      return set(out, 0, 0, spread(0.22 * intro), 0, 0, 0, 1, 1, 0, 0);
    case 1:
      return set(out, 0, 0, spread(0.85), 0, 0, 0, 1, 1, 0, 0);
    case 2: {
      if (i > 5) return hide(out, 0);
      const focused = ctx.skill != null;
      const hit = focused && ctx.skill === i;
      return set(out, ((i % 3) - 1) * 3.4, (0.5 - ((i / 3) | 0)) * 2.2, hit ? 0.6 : 0,
        0, 0, 0, hit ? 0.92 * 1.06 : 0.92, focused && !hit ? 0.45 : 1, 0, hit ? 1 : 0);
    }
    case 3: {
      if (i > 4) return hide(out, 1);
      const d = i - job;
      const ad = Math.abs(d);
      return set(out, 0, -d * 1.65, d === 0 ? 0.6 : -0.9 * ad, 0.25 * d, 0, 0,
        d === 0 ? 1.08 : ad === 1 ? 0.86 : 0.76, ad > 2 ? 0 : 1 - 0.42 * ad, 1, d === 0 ? 1 : 0);
    }
    case 4: {
      if (i < 5) return set(out, 0, 0, -4 + (4 - i) * 0.1, 0, 0, 0, 1, 0.12, 0, 0);
      const k = i - 5;
      const f = ctx.project;
      let slot = k - 1;
      if (f != null) slot = k === f ? 0 : (k < f ? (k === 0 ? -1 : 1) : (f === 0 && k === 1 ? -1 : 1));
      const hit = f != null && k === f;
      return set(out, slot * 2.3, 0, hit ? 0.5 : slot === 0 ? 0 : -0.6, 0, -slot * 0.42, 0,
        hit ? 1.1 : 1, 1, 1, hit ? 1 : 0);
    }
    default:
      return set(out, 0, 0, spread(0.05), 0, 0, 0, 0.9, 1, 0, 0);
  }
}
