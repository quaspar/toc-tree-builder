/** Bounded snapshot-based undo/redo stack. Snapshots are opaque strings. */
export class History {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  constructor(private limit = 300) {}

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  /** Record the state *before* a change. Clears redo. */
  push(snapshot: string): void {
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }
  dropLast(): void { this.undoStack.pop(); }

  /** Given the current state, return the state to restore (or null). */
  undo(current: string): string | null {
    const s = this.undoStack.pop();
    if (s == null) return null;
    this.redoStack.push(current);
    return s;
  }
  redo(current: string): string | null {
    const s = this.redoStack.pop();
    if (s == null) return null;
    this.undoStack.push(current);
    return s;
  }
}
