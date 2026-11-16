import type { CrtEdge, CrtNode, NodeType, Tree } from './types';
import { uid } from './util';

export function newTree(name?: string): Tree {
  const now = Date.now();
  return { id: uid(), name: name || 'Untitled tree', nodes: [], edges: [], nextNum: 1, view: null, updated: now, created: now };
}

export function mkNode(t: Tree, type: NodeType, text: string, x = 0, y = 0): CrtNode {
  const n: CrtNode = { id: uid(), num: t.nextNum++, type, text, x, y, core: false, notes: '', clr: {} };
  t.nodes.push(n);
  return n;
}

export function mkEdge(t: Tree, from: CrtNode | string, to: CrtNode | string, andGroup: string | null = null): CrtEdge {
  const e: CrtEdge = {
    id: uid(),
    from: typeof from === 'string' ? from : from.id,
    to: typeof to === 'string' ? to : to.id,
    andGroup,
    clr: {},
  };
  t.edges.push(e);
  return e;
}

/** Adds an arrow cause → effect unless it is a self-loop or a duplicate. */
export function addEdge(t: Tree, from: string, to: string): CrtEdge | null {
  if (from === to) return null;
  if (t.edges.some(e => e.from === from && e.to === to)) return null;
  return mkEdge(t, from, to);
}

/** An AND group only makes sense with ≥ 2 arrows into the same effect; dissolve the rest. */
export function normalizeAnd(t: Tree): void {
  const c = new Map<string, number>();
  t.edges.forEach(e => {
    if (e.andGroup) {
      const k = e.to + '|' + e.andGroup;
      c.set(k, (c.get(k) || 0) + 1);
    }
  });
  t.edges.forEach(e => {
    if (e.andGroup && (c.get(e.to + '|' + e.andGroup) ?? 0) < 2) e.andGroup = null;
  });
}

/** Tie arrow `o` into the AND group of arrow `e` (merging groups), or untie it. */
export function setAnd(t: Tree, e: CrtEdge, o: CrtEdge, on: boolean): void {
  if (on) {
    const g = e.andGroup || o.andGroup || uid();
    const og = o.andGroup, eg = e.andGroup;
    t.edges.forEach(x => {
      if (x.to === e.to && x.andGroup && (x.andGroup === og || x.andGroup === eg)) x.andGroup = g;
    });
    e.andGroup = g;
    o.andGroup = g;
  } else o.andGroup = null;
  normalizeAnd(t);
}

export function deleteNodes(t: Tree, ids: Set<string>): void {
  t.nodes = t.nodes.filter(n => !ids.has(n.id));
  t.edges = t.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
  normalizeAnd(t);
}

export function deleteEdge(t: Tree, id: string): void {
  t.edges = t.edges.filter(e => e.id !== id);
  normalizeAnd(t);
}

export function reverseEdge(t: Tree, e: CrtEdge): void {
  [e.from, e.to] = [e.to, e.from];
  e.andGroup = null;
  normalizeAnd(t);
}

/** Deep copy with a fresh id; node/edge ids may stay the same since they are scoped to the tree. */
export function cloneTree(t: Tree, name?: string): Tree {
  const c: Tree = JSON.parse(JSON.stringify(t));
  const now = Date.now();
  c.id = uid();
  c.name = name ?? t.name + ' (copy)';
  c.created = now;
  c.updated = now;
  return c;
}
