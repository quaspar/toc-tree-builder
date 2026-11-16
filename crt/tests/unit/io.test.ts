import { describe, expect, it } from 'vitest';
import { exportAllJson, exportTreeJson, normalizeTree, parseImport } from '../../src/model/io';
import { exampleTree } from '../../src/model/example';

describe('import / export', () => {
  it('round-trips a single tree export with a fresh id', () => {
    const t = exampleTree();
    const [back] = parseImport(exportTreeJson(t));
    expect(back.id).not.toBe(t.id);
    expect(back.name).toBe(t.name);
    expect(back.nodes).toEqual(t.nodes);
    expect(back.edges).toEqual(t.edges);
    expect(back.nextNum).toBe(t.nextNum);
  });

  it('reads an all-trees backup (array) and a raw store dump (object)', () => {
    const a = exampleTree(), b = exampleTree();
    expect(parseImport(exportAllJson([a, b]))).toHaveLength(2);
    expect(parseImport(JSON.stringify({ trees: { [a.id]: a, [b.id]: b }, currentId: a.id }))).toHaveLength(2);
  });

  it('accepts a bare tree and fills in missing fields', () => {
    const [t] = parseImport(JSON.stringify({
      nodes: [{ id: 1, text: 'a' }, { id: 2, type: 'ude', num: 5 }, { id: 2, text: 'dup id' }],
      edges: [{ from: 1, to: 2 }, { from: 1, to: 'missing' }],
    }), 'mine.crt.json');
    expect(t.name).toBe('mine');
    expect(t.nodes.map(n => n.num)).toEqual([6, 5, 7]);
    expect(t.nextNum).toBe(8);
    expect(new Set(t.nodes.map(n => n.id)).size).toBe(3);
    expect(t.nodes[0]).toMatchObject({ id: '1', type: 'entity', core: false, notes: '', clr: {} });
    expect(t.edges).toHaveLength(1);
    expect(t.edges[0]).toMatchObject({ from: '1', to: '2', andGroup: null, clr: {} });
  });

  it('drops invalid CLR values and views', () => {
    const t = normalizeTree({ nodes: [{ id: 'a', clr: { clarity: 'ok', x: 'maybe' } }], edges: [], view: { x: 1, y: 2, k: 0 } });
    expect(t.nodes[0].clr).toEqual({ clarity: 'ok' });
    expect(t.view).toBeNull();
  });

  it('rejects files without trees', () => {
    expect(() => parseImport('nope')).toThrow(/valid JSON/);
    expect(() => parseImport('{"hello":1}')).toThrow(/No tree/);
    expect(() => parseImport('{"tree":{"nodes":1}}')).toThrow(/Invalid/);
  });
});
