// Reads the --scene-* tokens from <html> (defined per theme in CSS), with spec fallbacks.
const FALLBACK = {
  dark: { surface: '#10131c', ink: '#e6e9f2', muted: '#5d6478', line: '#2a3042', accent: '#7aa2ff', accent2: '#b28cff', mint: '#6ee7d2', blend: 'additive' },
  light: { surface: '#ffffff', ink: '#11141b', muted: '#9aa1b1', line: '#d9dce4', accent: '#3355f0', accent2: '#7c4dff', mint: '#0f9f87', blend: 'normal' },
};
const COLOR_KEYS = ['surface', 'ink', 'muted', 'line', 'accent', 'accent2', 'mint'];

let normalizer;
// Canvas normalises any CSS colour syntax to #rrggbb (opaque input).
function toHex(value, fallback) {
  normalizer ||= document.createElement('canvas').getContext('2d');
  normalizer.fillStyle = '#000000';
  normalizer.fillStyle = value;
  const out = normalizer.fillStyle;
  if (out.startsWith('#')) return out;
  normalizer.fillStyle = fallback;
  return normalizer.fillStyle;
}

export function readTheme() {
  const root = document.documentElement;
  const name = root.dataset.theme === 'light' ? 'light' : 'dark';
  const style = getComputedStyle(root);
  const fb = FALLBACK[name];
  const get = (key) => style.getPropertyValue(`--scene-${key}`).trim() || fb[key];
  const theme = { name, blend: get('blend') === 'additive' ? 'additive' : 'normal' };
  for (const key of COLOR_KEYS) theme[key] = toHex(get(key), fb[key]);
  return theme;
}

const cache = new Map();
function parse(hex) {
  let rgb = cache.get(hex);
  if (!rgb) {
    rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    cache.set(hex, rgb);
  }
  return rgb;
}

export const rgba = (hex, a) => {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
};

// Readable text colour on top of a filled background colour.
export const onColor = (hex) => {
  const [r, g, b] = parse(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#0b0d12' : '#ffffff';
};
