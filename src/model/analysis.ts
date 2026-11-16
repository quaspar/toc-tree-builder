import type { CrtEdge, CrtNode, Tree } from './types';

export interface Analysis {
  inc: Map<string, CrtEdge[]>;
  out: Map<string, CrtEdge[]>;
  roots: Set<string>;
  isolated: CrtNode[];
  udes: CrtNode[];
  /** root id → number of UDEs it reaches */
  reach: Map<string, number>;
  downstream: (id: string) => Set<string>;
  udeNoCause: CrtNode[];
}

export function analyze(tree: Tree): Analysis {
  const inc = new Map<string, CrtEdge[]>(), out = new Map<string, CrtEdge[]>();
  tree.nodes.forEach(n => { inc.set(n.id, []); out.set(n.id, []); });
  tree.edges.forEach(e => {
    if (inc.has(e.to) && out.has(e.from)) { inc.get(e.to)!.push(e); out.get(e.from)!.push(e); }
  });
  const roots = new Set<string>(), isolated: CrtNode[] = [];
  tree.nodes.forEach(n => {
    const i = inc.get(n.id)!.length, o = out.get(n.id)!.length;
    if (!i && !o) isolated.push(n);
    else if (!i && o && n.type !== 'assumption') roots.add(n.id);
  });
  const cache = new Map<string, Set<string>>();
  const downstream = (id: string): Set<string> => {
    const hit = cache.get(id);
    if (hit) return hit;
    const seen = new Set([id]), q = [id];
    while (q.length) {
      const c = q.shift()!;
      for (const e of out.get(c) || []) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); }
    }
    cache.set(id, seen);
    return seen;
  };
  const udes = tree.nodes.filter(n => n.type === 'ude');
  const reach = new Map<string, number>();
  roots.forEach(r => { const d = downstream(r); reach.set(r, udes.filter(u => d.has(u.id)).length); });
  const udeNoCause = udes.filter(u => !inc.get(u.id)!.length);
  return { inc, out, roots, isolated, udes, reach, downstream, udeNoCause };
}

/** Incoming arrows of a node grouped by AND group (ungrouped arrows form their own group). */
export function groupsInto(id: string, an: Analysis): CrtEdge[][] {
  const m = new Map<string, CrtEdge[]>();
  for (const e of an.inc.get(id) || []) {
    const k = e.andGroup || e.id;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(e);
  }
  return [...m.values()];
}

/** UDEs not reachable from any root cause. */
export function unreachedUdes(an: Analysis): CrtNode[] {
  return an.udes.filter(u => ![...an.roots].some(r => an.downstream(r).has(u.id)));
}
