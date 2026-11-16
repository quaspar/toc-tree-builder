export type NodeType = 'entity' | 'ude' | 'assumption';
export type ClrState = 'ok' | 'raised';
export type ClrMap = Record<string, ClrState>;

export interface CrtNode {
  id: string;
  num: number;
  type: NodeType;
  text: string;
  x: number;
  y: number;
  core: boolean;
  notes: string;
  clr: ClrMap;
}

export interface CrtEdge {
  id: string;
  from: string;
  to: string;
  andGroup: string | null;
  clr: ClrMap;
}

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface Tree {
  id: string;
  name: string;
  nodes: CrtNode[];
  edges: CrtEdge[];
  nextNum: number;
  view: View | null;
  updated: number;
  created?: number;
}

/** Shape persisted in localStorage under STORAGE_KEY. Identical to the original single-file app. */
export interface StoreData {
  trees: Record<string, Tree>;
  currentId: string | null;
}
