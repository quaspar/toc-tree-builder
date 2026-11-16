import type { CrtEdge, CrtNode, NodeType, Tree, View } from './types';
import { newTree } from './tree';
import { uid } from './util';

export const FILE_FORMAT = 'crt-builder';

const NODE_TYPES: NodeType[] = ['entity', 'ude', 'assumption'];

function cleanClr(v: unknown): Record<string, 'ok' | 'raised'> {
  const out: Record<string, 'ok' | 'raised'> = {};
  if (v && typeof v === 'object') for (const [k, s] of Object.entries(v)) if (s === 'ok' || s === 'raised') out[k] = s;
  return out;
}

function cleanView(v: unknown): View | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const x = Number(o.x), y = Number(o.y), k = Number(o.k);
  return [x, y, k].every(Number.isFinite) && k > 0 ? { x, y, k } : null;
}

/**
 * Turn anything tree-shaped into a valid Tree. Keeps id/name/timestamps when `keepIdentity`
 * (used when loading our own storage); otherwise assigns a fresh id (used for imports).
 */
export function normalizeTree(raw: unknown, opts: { keepIdentity?: boolean; fallbackName?: string } = {}): Tree {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid tree format');
  const t = raw as Record<string, unknown>;
  if (!Array.isArray(t.nodes) || !Array.isArray(t.edges)) throw new Error('Invalid tree format');
  const base = newTree(typeof t.name === 'string' && t.name.trim() ? t.name : opts.fallbackName);
  if (opts.keepIdentity) {
    if (typeof t.id === 'string' && t.id) base.id = t.id;
    if (Number.isFinite(t.updated)) base.updated = t.updated as number;
    if (Number.isFinite(t.created)) base.created = t.created as number;
  }
  const seen = new Set<string>();
  const nodes: CrtNode[] = [];
  for (const r of t.nodes as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    let id = r.id != null && r.id !== '' ? String(r.id) : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    nodes.push({
      id,
      num: Number.isInteger(r.num) && (r.num as number) > 0 ? (r.num as number) : 0,
      type: NODE_TYPES.includes(r.type as NodeType) ? (r.type as NodeType) : 'entity',
      text: typeof r.text === 'string' ? r.text : '',
      x: Number(r.x) || 0,
      y: Number(r.y) || 0,
      core: !!r.core,
      notes: typeof r.notes === 'string' ? r.notes : '',
      clr: cleanClr(r.clr),
    });
  }
  let next = Math.max(0, ...nodes.map(n => n.num)) + 1;
  nodes.forEach(n => { if (!n.num) n.num = next++; });
  const storedNext = Number(t.nextNum);
  base.nextNum = Number.isInteger(storedNext) && storedNext >= next ? storedNext : next;
  const ids = new Set(nodes.map(n => n.id));
  const edges: CrtEdge[] = [];
  for (const r of t.edges as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const from = String(r.from), to = String(r.to);
    if (!ids.has(from) || !ids.has(to)) continue;
    edges.push({
      id: r.id != null && r.id !== '' ? String(r.id) : uid(),
      from, to,
      andGroup: r.andGroup ? String(r.andGroup) : null,
      clr: cleanClr(r.clr),
    });
  }
  base.nodes = nodes;
  base.edges = edges;
  base.view = cleanView(t.view);
  return base;
}

/** Accepts a single-tree export, an all-trees backup, a raw store dump, or a bare tree. */
export function parseImport(text: string, fileName = 'Imported tree'): Tree[] {
  let o: unknown;
  try { o = JSON.parse(text); } catch { throw new Error('File is not valid JSON'); }
  if (!o || typeof o !== 'object') throw new Error('No tree found in file');
  const r = o as Record<string, unknown>;
  const list: unknown[] = r.tree ? [r.tree]
    : Array.isArray(r.trees) ? r.trees
    : r.trees && typeof r.trees === 'object' ? Object.values(r.trees)
    : r.nodes ? [r] : [];
  if (!list.length) throw new Error('No tree found in file');
  return list.map(t => normalizeTree(t, { fallbackName: fileName.replace(/\.(crt\.)?json$/i, '') }));
}

export function exportTreeJson(tree: Tree): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, tree }, null, 2);
}

export function exportAllJson(trees: Tree[]): string {
  return JSON.stringify({ format: FILE_FORMAT, version: 1, exported: new Date().toISOString(), trees }, null, 2);
}
