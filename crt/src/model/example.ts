import type { Tree } from './types';
import { mkEdge, mkNode, newTree } from './tree';
import { layoutTree } from './layout';
import { uid } from './util';

export function exampleTree(): Tree {
  const t = newTree('Example: late deliveries');
  const n1 = mkNode(t, 'entity', 'Work centres are measured on local efficiency');
  const n2 = mkNode(t, 'entity', 'Supervisors want every resource busy all the time');
  const n3 = mkNode(t, 'entity', 'Material is released as soon as orders arrive');
  const n4 = mkNode(t, 'entity', 'The plant has a capacity constraint');
  const n5 = mkNode(t, 'entity', 'Work piles up in queues in front of the constraint');
  const n6 = mkNode(t, 'ude', 'WIP inventory is high');
  const n7 = mkNode(t, 'entity', 'Lead times are long and unpredictable');
  const n8 = mkNode(t, 'ude', 'Customers complain about late deliveries');
  const n9 = mkNode(t, 'entity', 'Late orders are expedited');
  const n10 = mkNode(t, 'ude', 'Overtime costs are high');
  n1.core = true;
  mkEdge(t, n1, n2); mkEdge(t, n2, n3);
  const g = uid(); mkEdge(t, n3, n5, g); mkEdge(t, n4, n5, g);
  mkEdge(t, n5, n6); mkEdge(t, n5, n7); mkEdge(t, n7, n8); mkEdge(t, n7, n9); mkEdge(t, n9, n10);
  layoutTree(t);
  return t;
}
