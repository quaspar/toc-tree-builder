import { describe, expect, it } from 'vitest';
import { analyze, groupsInto, unreachedUdes } from '../../src/model/analysis';
import { cycleClr, hasRaised } from '../../src/model/clr';
import { exampleTree } from '../../src/model/example';
import { approxWidth, clip, measure, MIN_H, wrap } from '../../src/model/geometry';
import { layoutTree } from '../../src/model/layout';
import { addEdge, cloneTree, deleteNodes, mkEdge, mkNode, newTree, normalizeAnd, reverseEdge, setAnd } from '../../src/model/tree';
import type { ClrMap } from '../../src/model/types';
import { esc, short, slug } from '../../src/model/util';

function chain() {
  const t = newTree('t');
  const a = mkNode(t, 'entity', 'A'), b = mkNode(t, 'entity', 'B'), c = mkNode(t, 'ude', 'C'), d = mkNode(t, 'ude', 'D');
  mkEdge(t, a, c); mkEdge(t, b, c); mkEdge(t, c, d);
  return { t, a, b, c, d };
}

describe('tree operations', () => {
  it('numbers nodes sequentially', () => {
    const { a, b, c, d } = chain();
    expect([a.num, b.num, c.num, d.num]).toEqual([1, 2, 3, 4]);
  });

  it('addEdge rejects self loops and duplicates', () => {
    const { t, a, c } = chain();
    expect(addEdge(t, a.id, a.id)).toBeNull();
    expect(addEdge(t, a.id, c.id)).toBeNull();
    expect(addEdge(t, c.id, a.id)).not.toBeNull();
  });

  it('setAnd ties and unties arrows into the same effect', () => {
    const { t, c } = chain();
    const [e1, e2] = t.edges.filter(e => e.to === c.id);
    setAnd(t, e1, e2, true);
    expect(e1.andGroup).toBeTruthy();
    expect(e1.andGroup).toBe(e2.andGroup);
    setAnd(t, e1, e2, false);
    expect(e1.andGroup).toBeNull(); // a group of one is dissolved
    expect(e2.andGroup).toBeNull();
  });

  it('normalizeAnd dissolves groups with fewer than two arrows', () => {
    const { t, c } = chain();
    const [e1] = t.edges.filter(e => e.to === c.id);
    e1.andGroup = 'g';
    normalizeAnd(t);
    expect(e1.andGroup).toBeNull();
  });

  it('deleting a node removes its arrows and broken AND groups', () => {
    const { t, a, c } = chain();
    const [e1, e2] = t.edges.filter(e => e.to === c.id);
    setAnd(t, e1, e2, true);
    deleteNodes(t, new Set([a.id]));
    expect(t.nodes).toHaveLength(3);
    expect(t.edges).toHaveLength(2);
    expect(t.edges.every(e => e.andGroup === null)).toBe(true);
  });

  it('reverseEdge flips direction and leaves AND groups', () => {
    const { t, c } = chain();
    const [e1, e2] = t.edges.filter(e => e.to === c.id);
    setAnd(t, e1, e2, true);
    reverseEdge(t, e1);
    expect(e1.to).not.toBe(c.id);
    expect(e1.andGroup).toBeNull();
    expect(e2.andGroup).toBeNull();
  });

  it('cloneTree makes an independent deep copy with a new id', () => {
    const { t } = chain();
    const c = cloneTree(t);
    expect(c.id).not.toBe(t.id);
    expect(c.name).toBe('t (copy)');
    c.nodes[0].text = 'changed';
    expect(t.nodes[0].text).toBe('A');
  });
});

describe('analysis', () => {
  it('finds roots, UDE reach and AND groups', () => {
    const { t, a, b, c, d } = chain();
    const an = analyze(t);
    expect([...an.roots].sort()).toEqual([a.id, b.id].sort());
    expect(an.reach.get(a.id)).toBe(2);
    expect(an.udes.map(u => u.id)).toEqual([c.id, d.id]);
    expect(groupsInto(c.id, an)).toHaveLength(2);
    const [e1, e2] = t.edges.filter(e => e.to === c.id);
    setAnd(t, e1, e2, true);
    expect(groupsInto(c.id, analyze(t))).toHaveLength(1);
  });

  it('assumptions and isolated entities are not roots', () => {
    const t = newTree();
    const s = mkNode(t, 'assumption', 'S'), u = mkNode(t, 'ude', 'U'), lone = mkNode(t, 'entity', 'L');
    mkEdge(t, s, u);
    const an = analyze(t);
    expect(an.roots.size).toBe(0);
    expect(an.isolated.map(n => n.id)).toEqual([lone.id]);
    expect(unreachedUdes(an).map(n => n.id)).toEqual([u.id]);
  });

  it('tolerates loops', () => {
    const t = newTree();
    const a = mkNode(t, 'entity', 'A'), b = mkNode(t, 'ude', 'B');
    mkEdge(t, a, b); mkEdge(t, b, a);
    const an = analyze(t);
    expect(an.roots.size).toBe(0);
    expect(an.downstream(a.id).size).toBe(2);
  });

  it('the example has one root cause reaching every UDE', () => {
    const an = analyze(exampleTree());
    expect(an.udes).toHaveLength(3);
    const reach = [...an.roots].map(r => an.reach.get(r));
    expect(Math.max(...reach.map(Number))).toBe(3);
  });
});

describe('layout', () => {
  it('puts causes below their effects', () => {
    const { t, a, c, d } = chain();
    layoutTree(t, approxWidth);
    expect(a.y).toBeGreaterThan(c.y);
    expect(c.y).toBeGreaterThan(d.y);
  });

  it('pulls a causeless entity up next to its effect instead of the bottom row', () => {
    const t = newTree();
    const r1 = mkNode(t, 'entity', 'r1'), m1 = mkNode(t, 'entity', 'm1'), m2 = mkNode(t, 'entity', 'm2'), top = mkNode(t, 'ude', 'top');
    const late = mkNode(t, 'entity', 'late root');
    mkEdge(t, r1, m1); mkEdge(t, m1, m2); mkEdge(t, m2, top); mkEdge(t, late, top);
    layoutTree(t, approxWidth);
    expect(late.y).toBe(m2.y);
    expect(r1.y).toBeGreaterThan(late.y);
  });

  it('survives cycles', () => {
    const t = newTree();
    const a = mkNode(t, 'entity', 'A'), b = mkNode(t, 'entity', 'B');
    mkEdge(t, a, b); mkEdge(t, b, a);
    expect(() => layoutTree(t, approxWidth)).not.toThrow();
    expect(Number.isFinite(a.x + a.y + b.x + b.y)).toBe(true);
  });
});

describe('geometry', () => {
  it('wraps text and gives placeholders for empty text', () => {
    expect(wrap('', 100, approxWidth)).toEqual({ lines: ['Double-click to write…'], ph: true });
    const r = wrap('one two three four five six seven eight nine ten', 60, approxWidth);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines.join(' ')).toBe('one two three four five six seven eight nine ten');
  });
  it('breaks words longer than a line', () => {
    const r = wrap('x'.repeat(100), 66, approxWidth);
    expect(r.lines.every(l => l.length <= 10)).toBe(true);
    expect(r.lines.join('')).toBe('x'.repeat(100));
  });
  it('measures at least the minimum height', () => {
    expect(measure({ text: 'hi' }, approxWidth).h).toBe(MIN_H);
  });
  it('clips a line to the edge of a box', () => {
    expect(clip({ x: 0, y: 0 }, { w: 100, h: 50 }, { x: 0, y: -500 })).toEqual({ x: 0, y: -28 });
  });
});

describe('clr & utils', () => {
  it('cycles unchecked → ok → raised → unchecked', () => {
    const c: ClrMap = {};
    cycleClr(c, 'k'); expect(c.k).toBe('ok');
    cycleClr(c, 'k'); expect(c.k).toBe('raised'); expect(hasRaised(c)).toBe(true);
    cycleClr(c, 'k'); expect('k' in c).toBe(false);
  });
  it('escapes, shortens and slugs', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
    expect(short('  ')).toBe('(empty)');
    expect(short('abcdef', 4)).toBe('abc…');
    expect(slug('Röd Tråd: Q3/Q4!')).toBe('röd-tråd-q3-q4');
    expect(slug('!!!')).toBe('tree');
  });
});
