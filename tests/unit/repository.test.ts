import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEY, TreeRepository } from '../../src/model/repository';
import { mkNode, newTree } from '../../src/model/tree';
import { MemoryStorage } from './helpers';

const seed = () => { const t = newTree('Seed'); mkNode(t, 'ude', 'x'); return t; };

describe('TreeRepository', () => {
  let s: MemoryStorage, repo: TreeRepository;
  beforeEach(() => { s = new MemoryStorage(); repo = new TreeRepository(s, seed); });

  it('seeds an example on first run and persists in the original format', () => {
    expect(repo.load()).toEqual({ firstRun: true, storageOk: true, recovered: false });
    expect(repo.count).toBe(1);
    expect(repo.current.name).toBe('Seed');
    expect(repo.persist()).toBe(true);
    const raw = JSON.parse(s.getItem(STORAGE_KEY)!);
    expect(Object.keys(raw)).toEqual(['trees', 'currentId']);
    expect(raw.trees[raw.currentId].name).toBe('Seed');
  });

  it('loads stored trees and keeps ids and the current selection', () => {
    repo.load();
    const b = repo.create('B');
    repo.select(b.id);
    repo.persist();
    const again = new TreeRepository(s, seed);
    expect(again.load().firstRun).toBe(false);
    expect(again.count).toBe(2);
    expect(again.current.id).toBe(b.id);
  });

  it('falls back to an existing tree when currentId is stale', () => {
    s.setItem(STORAGE_KEY, JSON.stringify({ currentId: 'gone', trees: { a: { id: 'a', name: 'A', nodes: [], edges: [] } } }));
    repo.load();
    expect(repo.current.id).toBe('a');
  });

  it('keeps a copy of unreadable data instead of overwriting it', () => {
    s.setItem(STORAGE_KEY, '{not json');
    const r = repo.load();
    expect(r.recovered).toBe(true);
    expect(repo.current.name).toBe('Seed');
    const backup = s.keys().find(k => k.startsWith(STORAGE_KEY + '-unreadable-'));
    expect(backup && s.getItem(backup)).toBe('{not json');
  });

  it('skips individual broken trees', () => {
    s.setItem(STORAGE_KEY, JSON.stringify({ currentId: 'a', trees: { a: { name: 'A', nodes: [], edges: [] }, b: { name: 'broken' } } }));
    repo.load();
    expect(repo.ids()).toEqual(['a']);
  });

  it('reports storage failures', () => {
    repo.load();
    s.failWrites = true;
    expect(repo.persist()).toBe(false);
    expect(new TreeRepository(null, seed).load().storageOk).toBe(false);
  });

  it('lists trees most recently edited first', () => {
    repo.load();
    const a = repo.create('A'), b = repo.create('B');
    a.updated = 10; b.updated = 20; repo.current.updated = 5;
    expect(repo.list().map(t => t.name)).toEqual(['B', 'A', 'Seed']);
    repo.touch(a.id);
    expect(repo.list()[0].name).toBe('A');
    expect(repo.list().find(t => t.name === 'Seed')).toMatchObject({ entities: 1, udes: 1, current: true });
  });

  it('creates unique names, duplicates and renames', () => {
    repo.load();
    expect(repo.create('Seed').name).toBe('Seed (2)');
    expect(repo.create('Seed').name).toBe('Seed (3)');
    const d = repo.duplicate(repo.current.id);
    expect(d.name).toBe('Seed (copy)');
    expect(d.nodes).toHaveLength(1);
    expect(d.nodes).not.toBe(repo.current.nodes);
    repo.rename(d.id, '   ');
    expect(repo.get(d.id)!.name).toBe('Untitled tree');
    repo.rename(d.id, ' Sales ');
    expect(repo.get(d.id)!.name).toBe('Sales');
  });

  it('removing the current tree selects the most recent remaining one', () => {
    repo.load();
    const a = repo.create('A'), b = repo.create('B');
    a.updated = 100; b.updated = 50; repo.current.updated = 1;
    repo.select(b.id);
    expect(repo.remove(b.id)!.name).toBe('B');
    expect(repo.current.id).toBe(a.id);
    expect(repo.remove('nope')).toBeUndefined();
  });

  it('removing the last tree leaves an empty one', () => {
    repo.load();
    const only = repo.current.id;
    repo.remove(only);
    expect(repo.count).toBe(1);
    expect(repo.current.id).not.toBe(only);
    expect(repo.current.nodes).toHaveLength(0);
  });

  it('adopts changes from another tab but keeps its own selection', () => {
    repo.load();
    const mine = repo.create('Mine');
    repo.select(mine.id);
    repo.persist();
    const other = new TreeRepository(s, seed);
    other.load();
    other.create('From other tab');
    other.select(other.list().find(t => t.name === 'Seed')!.id);
    other.persist();
    let calls = 0;
    repo.onExternalChange(() => calls++);
    expect(repo.applyExternal(s.getItem(STORAGE_KEY))).toBe(true);
    expect(calls).toBe(1);
    expect(repo.count).toBe(3);
    expect(repo.current.id).toBe(mine.id);
    expect(repo.applyExternal(null)).toBe(false);
    expect(repo.applyExternal('garbage')).toBe(false);
  });
});
