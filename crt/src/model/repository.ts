import type { StoreData, Tree } from './types';
import { cloneTree, newTree } from './tree';
import { normalizeTree } from './io';

/** Same key and shape as the original single-file crt.html, so data is interchangeable. */
export const STORAGE_KEY = 'crt-builder-v1';

export interface TreeSummary {
  id: string;
  name: string;
  entities: number;
  udes: number;
  updated: number;
  current: boolean;
}

export type LoadResult = { firstRun: boolean; storageOk: boolean; recovered: boolean };

/**
 * All trees live in one localStorage entry: { trees: {id: Tree}, currentId }.
 * The repository owns that object and is the only thing that reads or writes storage.
 */
export class TreeRepository {
  data: StoreData = { trees: {}, currentId: null };
  private listeners = new Set<() => void>();

  constructor(
    private storage: Storage | null,
    private seed: () => Tree,
    private key = STORAGE_KEY,
  ) {}

  load(): LoadResult {
    let raw: string | null = null, storageOk = true, recovered = false;
    try { raw = this.storage ? this.storage.getItem(this.key) : null; if (!this.storage) storageOk = false; }
    catch { storageOk = false; }
    const parsed = raw ? this.parse(raw) : null;
    if (raw && !parsed) {
      // never silently overwrite data we could not read: keep a copy next to it
      recovered = true;
      try { this.storage?.setItem(`${this.key}-unreadable-${Date.now()}`, raw); } catch { /* ignore */ }
    }
    if (parsed && Object.keys(parsed.trees).length) {
      this.data = parsed;
      if (!this.data.currentId || !this.data.trees[this.data.currentId]) this.data.currentId = this.ids()[0];
      return { firstRun: false, storageOk, recovered };
    }
    const t = this.seed();
    this.data = { trees: { [t.id]: t }, currentId: t.id };
    return { firstRun: !raw, storageOk, recovered };
  }

  /** Parse and sanitize a stored blob; skips individual trees that are broken. */
  private parse(raw: string): StoreData | null {
    try {
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || !o.trees || typeof o.trees !== 'object') return null;
      const trees: Record<string, Tree> = {};
      for (const [id, t] of Object.entries(o.trees)) {
        try {
          const nt = normalizeTree({ id, ...(t as object) }, { keepIdentity: true });
          trees[nt.id] = nt;
        } catch { /* skip broken tree */ }
      }
      return { trees, currentId: typeof o.currentId === 'string' ? o.currentId : null };
    } catch { return null; }
  }

  /** Write everything to storage. Returns false if the browser refused (quota, private mode…). */
  persist(): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(this.key, JSON.stringify(this.data)); return true; }
    catch { return false; }
  }

  ids(): string[] { return Object.keys(this.data.trees); }
  get(id: string): Tree | undefined { return this.data.trees[id]; }
  get current(): Tree { return this.data.trees[this.data.currentId!]; }
  get count(): number { return this.ids().length; }

  list(): TreeSummary[] {
    return Object.values(this.data.trees)
      .map(t => ({
        id: t.id,
        name: t.name,
        entities: t.nodes.length,
        udes: t.nodes.filter(n => n.type === 'ude').length,
        updated: t.updated || 0,
        current: t.id === this.data.currentId,
      }))
      .sort((a, b) => b.updated - a.updated || a.name.localeCompare(b.name));
  }

  select(id: string): Tree {
    if (!this.data.trees[id]) throw new Error('No such tree: ' + id);
    this.data.currentId = id;
    return this.current;
  }

  /** Make a tree name unique among existing trees: "Foo", "Foo (2)", "Foo (3)"… */
  uniqueName(name: string, exceptId?: string): string {
    const taken = new Set(Object.values(this.data.trees).filter(t => t.id !== exceptId).map(t => t.name));
    if (!taken.has(name)) return name;
    const base = name.replace(/ \(\d+\)$/, '');
    let i = 2;
    while (taken.has(`${base} (${i})`)) i++;
    return `${base} (${i})`;
  }

  add(tree: Tree): Tree {
    tree.name = this.uniqueName(tree.name);
    this.data.trees[tree.id] = tree;
    return tree;
  }

  create(name = 'New tree'): Tree { return this.add(newTree(name)); }

  duplicate(id: string): Tree {
    const src = this.data.trees[id];
    if (!src) throw new Error('No such tree: ' + id);
    return this.add(cloneTree(src));
  }

  rename(id: string, name: string): void {
    const t = this.data.trees[id];
    if (t) { t.name = name.trim() || 'Untitled tree'; t.updated = Date.now(); }
  }

  /**
   * Delete a tree. If it was the current one, the most recently edited remaining tree becomes
   * current. Deleting the last tree leaves a fresh empty one so the app always has a tree.
   * Returns the deleted tree so the caller can offer undo.
   */
  remove(id: string): Tree | undefined {
    const t = this.data.trees[id];
    if (!t) return undefined;
    delete this.data.trees[id];
    if (!this.count) this.create('Untitled tree');
    if (this.data.currentId === id || !this.data.trees[this.data.currentId!]) this.data.currentId = this.list()[0].id;
    return t;
  }

  /** Mark a tree as edited (drives "last edited" ordering in the library). */
  touch(id = this.data.currentId): void {
    const t = id ? this.data.trees[id] : undefined;
    if (t) t.updated = Date.now();
  }

  /**
   * Another tab wrote to the same key. Adopt its data; keep our current tree selected if it still exists.
   * Returns true if anything was applied.
   */
  applyExternal(raw: string | null): boolean {
    if (raw == null) return false;
    const parsed = this.parse(raw);
    if (!parsed || !Object.keys(parsed.trees).length) return false;
    const keep = this.data.currentId;
    this.data = parsed;
    this.data.currentId = keep && parsed.trees[keep] ? keep : this.list()[0].id;
    this.listeners.forEach(f => f());
    return true;
  }

  onExternalChange(f: () => void): () => void { this.listeners.add(f); return () => this.listeners.delete(f); }

  /** Wire up the browser's cross-tab `storage` event. */
  listen(win: Window): void {
    win.addEventListener('storage', ev => {
      if (ev.key === this.key && ev.storageArea === this.storage) this.applyExternal(ev.newValue);
    });
  }
}
