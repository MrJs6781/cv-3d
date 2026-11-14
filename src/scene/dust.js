import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, NormalBlending, Points, ShaderMaterial } from 'three';

const VERT = /* glsl */ `
uniform float uTime, uScroll, uPR;
attribute vec4 aSeed; // speed, phase, size, tint
varying float vA;
varying float vTint;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.07 * aSeed.x + aSeed.y * 6.283) * 0.6;
  p.z += cos(uTime * 0.05 + aSeed.y * 6.283) * 0.4;
  p.y = mod(p.y + uTime * 0.05 * (0.4 + aSeed.x) + uScroll * (0.3 + aSeed.x * 0.5) + 6.0, 12.0) - 6.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.5 + aSeed.z * 2.5) * uPR * (14.0 / -mv.z);
  vA = (0.35 + 0.65 * aSeed.x) * (1.0 - smoothstep(4.5, 6.0, abs(p.y)));
  vTint = step(0.72, aSeed.w);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uOpacity;
varying float vA;
varying float vTint;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, r);
  gl_FragColor = vec4(mix(uColA, uColB, vTint), a * a * vA * uOpacity);
  #include <colorspace_fragment>
}`;

export function createDust(count) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 18;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    for (let c = 0; c < 4; c++) seed[i * 4 + c] = Math.random();
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));

  const uniforms = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uPR: { value: 1 }, uOpacity: { value: 0.5 },
    uColA: { value: new Color() }, uColB: { value: new Color() },
  };
  const material = new ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: false,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;

  return {
    points,
    update(time, scrollY) {
      uniforms.uTime.value = time;
      uniforms.uScroll.value = scrollY * 0.002;
    },
    setPixelRatio(v) { uniforms.uPR.value = v; },
    setTheme(theme) {
      const additive = theme.blend === 'additive';
      material.blending = additive ? AdditiveBlending : NormalBlending;
      material.needsUpdate = true;
      uniforms.uColA.value.set(theme.ink);
      uniforms.uColB.value.set(theme.accent);
      uniforms.uOpacity.value = additive ? 0.5 : 0.4;
    },
  };
}
