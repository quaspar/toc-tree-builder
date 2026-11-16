import type { ClrMap } from './types';

export type ClrDef = readonly [key: string, title: string, question: string];

/** Categories of Legitimate Reservation that apply to a single entity. */
export const CLR_NODE: readonly ClrDef[] = [
  ['clarity', 'Clarity', 'Would someone else understand this statement the same way?'],
  ['existence', 'Entity existence', 'Does this actually exist in our reality? Can we verify it?'],
];

/** Categories of Legitimate Reservation that apply to a cause → effect arrow. */
export const CLR_EDGE: readonly ClrDef[] = [
  ['clarity', 'Clarity', 'Does the connection make sense when read aloud?'],
  ['causality', 'Causality existence', 'Does the cause really produce the effect?'],
  ['insufficiency', 'Cause insufficiency', 'Is something else needed for the effect? (add it with AND)'],
  ['additional', 'Additional cause', 'Could another, independent cause also produce this effect?'],
  ['reversal', 'Cause–effect reversal', 'Is the arrow pointing the right way?'],
  ['predicted', 'Predicted effect existence', 'If the cause were true, what else should we see — and do we?'],
  ['tautology', 'Tautology', 'Is the effect being used as the only proof of the cause?'],
];

export const hasRaised = (clr: ClrMap | undefined | null): boolean => !!clr && Object.values(clr).includes('raised');

/** unchecked → ok → raised → unchecked */
export function cycleClr(clr: ClrMap, key: string): void {
  const s = clr[key];
  if (!s) clr[key] = 'ok';
  else if (s === 'ok') clr[key] = 'raised';
  else delete clr[key];
}
