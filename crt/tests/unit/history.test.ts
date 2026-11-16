import { describe, expect, it } from 'vitest';
import { History } from '../../src/app/history';
import { relTime } from '../../src/app/library';

describe('History', () => {
  it('undoes and redoes snapshots', () => {
    const h = new History();
    expect(h.undo('s0')).toBeNull();
    h.push('s0');           // state before change → now s1
    h.push('s1');           // → now s2
    expect(h.undo('s2')).toBe('s1');
    expect(h.undo('s1')).toBe('s0');
    expect(h.canUndo).toBe(false);
    expect(h.redo('s0')).toBe('s1');
    h.push('s1');           // new change clears redo
    expect(h.canRedo).toBe(false);
  });
  it('is bounded', () => {
    const h = new History(3);
    ['a', 'b', 'c', 'd'].forEach(s => h.push(s));
    expect(h.undo('x')).toBe('d');
    expect(h.undo('d')).toBe('c');
    expect(h.undo('c')).toBe('b');
    expect(h.undo('b')).toBeNull();
  });
});

describe('relTime', () => {
  const now = 1_700_000_000_000;
  it('formats recent times', () => {
    expect(relTime(0, now)).toBe('never');
    expect(relTime(now - 10_000, now)).toBe('just now');
    expect(relTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(relTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(relTime(now - 26 * 3_600_000, now)).toBe('yesterday');
    expect(relTime(now - 3 * 86_400_000, now)).toBe('3 days ago');
  });
});
