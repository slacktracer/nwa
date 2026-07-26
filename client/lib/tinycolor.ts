// TinyColor v1.0.0 — ESM port
// https://github.com/bgrins/TinyColor — Brian Grinstead, MIT License

interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }

const math = Math;
const mathRound = math.round;
const mathMin = math.min;
const mathMax = math.max;

function bound01(n: number, max: number): number {
  if (n < 0) n = 0;
  if (n > max) n = max;
  return n;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r = bound01(r, 255) / 255;
  g = bound01(g, 255) / 255;
  b = bound01(b, 255) / 255;
  const max = mathMax(r, g, b);
  const min = mathMin(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: mathRound(r * 255), g: mathRound(g * 255), b: mathRound(b * 255) };
}

function inputToRgb(color: string): RGB | null {
  const hsla = /^hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*([\d.]+))?\s*\)$/;
  const match = color.match(hsla);
  if (!match) return null;
  const h = (parseInt(match[1], 10) % 360) / 360;
  const s = parseInt(match[2], 10) / 100;
  const l = parseInt(match[3], 10) / 100;
  return hslToRgb(h, s, l);
}

export default function tinycolor(color: string): {
  saturate(amount?: number): { toString(): string } | null;
  desaturate(amount?: number): { toString(): string } | null;
  toString(): string;
} {
  const rgb = inputToRgb(color);
  if (!rgb) {
    return {
      toString: () => color,
      saturate: () => null,
      desaturate: () => null,
    };
  }
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  function toHslString(h: number, s: number, l: number): string {
    return `hsl(${Math.round(h * 360)},${Math.round(s * 100)}%,${Math.round(l * 100)}%)`;
  }

  function adjustSaturation(targetS: number): { toString(): string } {
    return { toString: () => toHslString(hsl.h, targetS, hsl.l) };
  }

  return {
    toString: () => toHslString(hsl.h, hsl.s, hsl.l),
    saturate(amount = 10) {
      const s = mathMin(1, hsl.s + amount / 100);
      return adjustSaturation(s);
    },
    desaturate(amount = 10) {
      const s = mathMax(0, hsl.s - amount / 100);
      return adjustSaturation(s);
    },
  };
}
