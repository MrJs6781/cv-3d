import {
  BufferAttribute, BufferGeometry, Color, DoubleSide, LineSegments, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3,
} from 'three';

export const PANEL_W = 3.2;
export const PANEL_H = 2.0;
const RADIUS = 0.08;
const PAD = 0.06; // geometry margin so the SDF edge is never clipped by the quad

const PANEL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PANEL_FRAG = /* glsl */ `
uniform sampler2D uTexA, uTexB;
uniform vec2 uSize, uFull;
uniform float uRadius, uMix, uReveal, uOpacity, uHighlight;
uniform vec3 uLine, uRim, uAccent;
varying vec2 vUv;

float sdRoundRect(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - h + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (vUv - 0.5) * uFull;
  if (!gl_FrontFacing) p.x = -p.x; // back side reads un-mirrored
  vec2 uv = p / uSize + 0.5;

  float d = sdRoundRect(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-5);
  float shape = 1.0 - smoothstep(-aa, aa, d);

  vec4 tex = texture2D(uTexA, uv);
  if (uMix > 0.001) tex = mix(tex, texture2D(uTexB, uv), uMix);

  // ~1px border, lit from the top-left; accent when highlighted
  float w = aa * 1.6;
  float ring = smoothstep(-w - aa, -w + aa, d) * shape;
  float lit = smoothstep(-0.9, 0.9, dot(p / (0.5 * length(uSize)), vec2(-0.7071, 0.7071)) * 1.6);
  float ringA = clamp(ring * (0.35 + 0.65 * lit) + ring * uHighlight * 0.7, 0.0, 1.0);
  vec3 borderCol = mix(mix(uLine, uRim, lit * 0.7), uAccent, uHighlight);

  vec3 col = mix(tex.rgb, borderCol, ringA);
  float a = mix(max(tex.a, ringA), 1.0, uHighlight); // focused card is fully opaque
  col = mix(col, uAccent, 0.05 * uHighlight) * (1.0 + 0.06 * uHighlight);

  // bottom-to-top "compile" sweep with a glowing edge
  float t = uReveal * 1.06 - 0.03;
  float vis = 1.0 - smoothstep(t - 0.004, t, uv.y);
  float gate = smoothstep(0.0, 0.03, uReveal) * (1.0 - smoothstep(0.97, 1.0, uReveal));
  float glow = exp(-abs(uv.y - t) * 50.0) * gate;

  float alpha = max(a * shape * vis, glow * shape * 0.85);
  gl_FragColor = vec4(col + uAccent * glow * 1.2, alpha * uOpacity);
  #include <colorspace_fragment>
}`;

const LINE_VERT = /* glsl */ `
attribute float aAlpha;
varying float vA;
void main() {
  vA = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() {
  gl_FragColor = vec4(uColor, vA * uOpacity);
  #include <colorspace_fragment>
}`;

const geometry = new PlaneGeometry(PANEL_W + PAD * 2, PANEL_H + PAD * 2);

export function createPanel() {
  const uniforms = {
    uTexA: { value: null }, uTexB: { value: null },
    uSize: { value: new Vector2(PANEL_W, PANEL_H) },
    uFull: { value: new Vector2(PANEL_W + PAD * 2, PANEL_H + PAD * 2) },
    uRadius: { value: RADIUS },
    uMix: { value: 0 }, uReveal: { value: 0 }, uOpacity: { value: 1 }, uHighlight: { value: 0 },
    uLine: { value: new Color() }, uRim: { value: new Color() }, uAccent: { value: new Color() },
  };
  const mesh = new Mesh(geometry, new ShaderMaterial({
    uniforms, vertexShader: PANEL_VERT, fragmentShader: PANEL_FRAG,
    transparent: true, depthWrite: false, depthTest: false, side: DoubleSide,
  }));
  mesh.matrixAutoUpdate = false; // the scene calls updateMatrix() itself
  mesh.frustumCulled = false;
  return { mesh, u: uniforms, vis: 0 };
}

export function setPanelTheme(panel, theme) {
  panel.u.uLine.value.set(theme.line);
  panel.u.uRim.value.set(theme.ink);
  panel.u.uAccent.value.set(theme.accent);
}

// Lines linking the four corners of consecutive layers.
export function createConnectors(panelCount) {
  const segments = (panelCount - 1) * 4;
  const geo = new BufferGeometry();
  const pos = new BufferAttribute(new Float32Array(segments * 6), 3);
  const alpha = new BufferAttribute(new Float32Array(segments * 2), 1);
  geo.setAttribute('position', pos);
  geo.setAttribute('aAlpha', alpha);
  const uniforms = { uColor: { value: new Color() }, uOpacity: { value: 0.35 } };
  const lines = new LineSegments(geo, new ShaderMaterial({
    uniforms, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
    transparent: true, depthWrite: false, depthTest: false,
  }));
  lines.frustumCulled = false;
  lines.renderOrder = 20;
  return { lines, pos, alpha, uniforms };
}

export function setConnectorTheme(conn, theme) {
  conn.uniforms.uColor.value.set(theme.accent);
}

const HX = PANEL_W / 2 - 0.03;
const HY = PANEL_H / 2 - 0.03;
const CORNERS = [[-HX, -HY], [HX, -HY], [HX, HY], [-HX, HY]];
const tmp = new Vector3();

// Panels' mesh.matrix must be current. `amount` is the explode weight 0..1.
export function updateConnectors(conn, panels, amount) {
  const p = conn.pos.array;
  const a = conn.alpha.array;
  let v = 0;
  for (let i = 0; i < panels.length - 1; i++) {
    const va = amount * Math.min(panels[i].vis, panels[i + 1].vis);
    for (let c = 0; c < 4; c++) {
      for (let side = 0; side < 2; side++) {
        tmp.set(CORNERS[c][0], CORNERS[c][1], 0).applyMatrix4(panels[i + side].mesh.matrix);
        p[v * 3] = tmp.x; p[v * 3 + 1] = tmp.y; p[v * 3 + 2] = tmp.z;
        a[v++] = va;
      }
    }
  }
  conn.pos.needsUpdate = true;
  conn.alpha.needsUpdate = true;
  conn.lines.visible = amount > 0.004;
}
