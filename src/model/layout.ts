import type { Tree } from './types';
import { MIN_H, NODE_W, measure, type TextWidth } from './geometry';

/**
 * Bottom-up layered layout: causes below effects. Loops are tolerated (back-edges are cut).
 * Causeless entities are pulled up to sit just below their nearest effect, so a root cause is
 * not pinned to the bottom row where its arrow would cross the rest of the tree.
 */
export function layoutTree(t: Tree, width?: TextWidth): void {
  const ids = t.nodes.map(n => n.id), byId = new Map(t.nodes.map(n => [n.id, n]));
  const parents = new Map<string, string[]>(ids.map(i => [i, []]));
  const kids = new Map<string, string[]>(ids.map(i => [i, []]));
  t.edges.forEach(e => {
    if (byId.has(e.from) && byId.has(e.to)) { parents.get(e.to)!.push(e.from); kids.get(e.from)!.push(e.to); }
  });
  const lvl = new Map<string, number>(), visiting = new Set<string>();
  const L = (id: string): number => {
    if (lvl.has(id)) return lvl.get(id)!;
    if (visiting.has(id)) return 0; // loop: cut back-edge
    visiting.add(id);
    let m = 0;
    for (const p of parents.get(id)!) m = Math.max(m, L(p) + 1);
    visiting.delete(id);
    lvl.set(id, m);
    return m;
  };
  ids.forEach(L);
  [...ids].sort((a, b) => lvl.get(b)! - lvl.get(a)!).forEach(id => {
    if (!parents.get(id)!.length && kids.get(id)!.length)
      lvl.set(id, Math.max(0, Math.min(...kids.get(id)!.map(k => lvl.get(k)!)) - 1));
  });
  const maxL = Math.max(0, ...lvl.values());
  const layers: string[][] = Array.from({ length: maxL + 1 }, () => []);
  ids.forEach(id => layers[lvl.get(id)!].push(id));
  const gap = NODE_W + 44, pos = new Map<string, number>();
  const place = (layer: string[]) => layer.forEach((id, i) => pos.set(id, (i - (layer.length - 1) / 2) * gap));
  layers.forEach(l => { l.sort((a, b) => byId.get(a)!.x - byId.get(b)!.x); place(l); });
  const bary = (id: string, nb: Map<string, string[]>) => {
    const xs = nb.get(id)!.filter(x => pos.has(x)).map(x => pos.get(x)!);
    return xs.length ? xs.reduce((a, b) => a + b) / xs.length : pos.get(id)!;
  };
  for (let it = 0; it < 6; it++) {
    for (let i = 1; i <= maxL; i++) {
      const l = layers[i], k = new Map(l.map(id => [id, bary(id, parents)]));
      l.sort((a, b) => k.get(a)! - k.get(b)!); place(l);
    }
    for (let i = maxL - 1; i >= 0; i--) {
      const l = layers[i], k = new Map(l.map(id => [id, bary(id, kids)]));
      l.sort((a, b) => k.get(a)! - k.get(b)!); place(l);
    }
  }
  const layerH = (l: string[]) => Math.max(MIN_H, ...l.map(id => measure(byId.get(id)!, width).h));
  let y = 0;
  layers.forEach((l, i) => {
    const h = layerH(l);
    if (i > 0) y -= layerH(layers[i - 1]) / 2 + h / 2 + 64;
    l.forEach(id => { const n = byId.get(id)!; n.x = pos.get(id)!; n.y = y; });
  });
}
