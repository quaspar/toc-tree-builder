import type { CrtNode } from './types';

export const NODE_W = 210, LH = 17, TOP = 24, BOT = 12, MIN_H = 58;
export const FONT = '13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

export interface Geo { lines: string[]; ph: boolean; w: number; h: number }
export type TextWidth = (s: string) => number;

/** Fallback when no canvas is available (tests, very old browsers): ~6.6px per char at 13px. */
export const approxWidth: TextWidth = s => s.length * 6.6;

let widthFn: TextWidth | null = null;
function canvasWidth(): TextWidth {
  if (widthFn) return widthFn;
  let ctx: CanvasRenderingContext2D | null = null;
  try { ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null; } catch { ctx = null; }
  if (ctx) { ctx.font = FONT; const c = ctx; widthFn = s => c.measureText(s).width; }
  else widthFn = approxWidth;
  return widthFn;
}

export function wrap(text: string, max: number, width: TextWidth = canvasWidth()): { lines: string[]; ph: boolean } {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: ['Double-click to write…'], ph: true };
  const lines: string[] = [];
  let cur = '';
  for (let w of words) {
    while (width(w) > max) {
      let i = w.length;
      while (i > 1 && width(w.slice(0, i)) > max) i--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, i));
      w = w.slice(i);
    }
    if (!w) continue;
    const t = cur ? cur + ' ' + w : w;
    if (width(t) <= max) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return { lines, ph: false };
}

export function measure(n: Pick<CrtNode, 'text'>, width?: TextWidth): Geo {
  const r = wrap(n.text, NODE_W - 24, width);
  return { ...r, w: NODE_W, h: Math.max(MIN_H, TOP + r.lines.length * LH + BOT) };
}

/** Point where the segment from a's centre towards b leaves a's box (with a small gap). */
export function clip(a: { x: number; y: number }, ga: { w: number; h: number }, b: { x: number; y: number }) {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (!dx && !dy) dy = -1;
  const hw = ga.w / 2 + 3, hh = ga.h / 2 + 3;
  const t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: a.x + dx * t, y: a.y + dy * t };
}
