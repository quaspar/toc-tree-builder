import type { CrtEdge, CrtNode, NodeType, Tree, View } from '../model/types';
import { analyze, type Analysis } from '../model/analysis';
import { hasRaised } from '../model/clr';
import { LH, TOP, BOT, clip, measure, type Geo } from '../model/geometry';
import { mkNode, normalizeAnd } from '../model/tree';
import { clamp } from '../model/util';
import type { TreeRepository } from '../model/repository';
import { $, svgEl } from './dom';
import { History } from './history';

export interface Hooks {
  renderInspector(): void;
  renderLibrary(): void;
}

/**
 * Runtime state of the editor for the currently open tree, plus rendering of the SVG canvas.
 * Persistence goes through the TreeRepository; every tree has its own undo history.
 */
export class App {
  readonly svg = $<SVGSVGElement>('#svg');
  readonly vp = $<SVGGElement>('#vp');
  readonly ov = $<SVGGElement>('#ov');
  readonly wrapEl = $<HTMLDivElement>('#canvasWrap');

  tree!: Tree;
  selNodes = new Set<string>();
  selEdge: string | null = null;
  highlightRoot: string | null = null;
  view: View = { x: 0, y: 0, k: 1 };
  readonly geo = new Map<string, Geo>();
  private histories = new Map<string, History>();
  hooks: Hooks = { renderInspector() {}, renderLibrary() {} };

  private saveT: ReturnType<typeof setTimeout> | undefined;
  private viewT: ReturnType<typeof setTimeout> | undefined;
  private storageBroken = false;

  constructor(readonly repo: TreeRepository) {}

  /* ---------- lookup ---------- */
  find = (id: string): CrtNode | undefined => this.tree.nodes.find(n => n.id === id);
  findE = (id: string): CrtEdge | undefined => this.tree.edges.find(e => e.id === id);
  analyze(): Analysis { return analyze(this.tree); }

  /* ---------- persistence ---------- */
  /** Persist now. `edit` marks the current tree as modified (vs. only the viewport changing). */
  save(edit = true): void {
    clearTimeout(this.saveT);
    if (edit) this.repo.touch(this.tree.id);
    if (this.repo.persist()) {
      this.storageBroken = false;
      this.setStatus('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      this.storageBroken = true;
      this.setStatus('NOT SAVED — browser storage unavailable. Export JSON!', true);
    }
    if (edit) this.hooks.renderLibrary();
  }
  saveSoon(): void { clearTimeout(this.saveT); this.saveT = setTimeout(() => this.save(), 350); }
  saveViewSoon(): void { clearTimeout(this.viewT); this.viewT = setTimeout(() => this.save(false), 600); }
  flush(): void {
    clearTimeout(this.saveT); clearTimeout(this.viewT);
    this.repo.persist();
  }
  setStatus(t: string, bad = false): void {
    if (this.storageBroken && !bad) return;
    const s = $('#status'); s.textContent = t; s.classList.toggle('bad', bad);
  }

  /* ---------- undo / redo (per tree) ---------- */
  get history(): History {
    let h = this.histories.get(this.tree.id);
    if (!h) { h = new History(); this.histories.set(this.tree.id, h); }
    return h;
  }
  private snap(): string { return JSON.stringify({ nodes: this.tree.nodes, edges: this.tree.edges, nextNum: this.tree.nextNum }); }
  private restore(s: string): void {
    const o = JSON.parse(s);
    this.tree.nodes = o.nodes; this.tree.edges = o.edges; this.tree.nextNum = o.nextNum;
  }
  checkpoint(): void { this.history.push(this.snap()); this.updateUndo(); }
  /** Discard the last checkpoint (the action it guarded turned out to be a no-op). */
  dropCheckpoint(): void { this.history.dropLast(); this.updateUndo(); }
  /** Lazily checkpoint once per focus of a text field. */
  beginTextEdit(): () => void {
    let pending: string | null = this.snap();
    return () => { if (pending) { this.history.push(pending); pending = null; this.updateUndo(); } };
  }
  undo(): void {
    const s = this.history.undo(this.snap()); if (s == null) return;
    this.restore(s); this.cleanSel(); this.save(); this.renderAll();
  }
  redo(): void {
    const s = this.history.redo(this.snap()); if (s == null) return;
    this.restore(s); this.cleanSel(); this.save(); this.renderAll();
  }
  updateUndo(): void {
    $<HTMLButtonElement>('#bUndo').disabled = !this.history.canUndo;
    $<HTMLButtonElement>('#bRedo').disabled = !this.history.canRedo;
  }
  forgetHistory(id?: string): void { if (id) this.histories.delete(id); else this.histories.clear(); }
  cleanSel(): void {
    this.selNodes = new Set([...this.selNodes].filter(id => this.find(id)));
    if (this.selEdge && !this.findE(this.selEdge)) this.selEdge = null;
    if (this.highlightRoot && !this.find(this.highlightRoot)) this.highlightRoot = null;
  }
  clearSelection(): void { this.selNodes = new Set(); this.selEdge = null; this.highlightRoot = null; }

  /* ---------- switching trees ---------- */
  open(id: string): void {
    if (this.tree && this.tree.id !== id) this.flush();
    this.tree = this.repo.select(id);
    this.clearSelection();
    this.save(false);
    this.render();
    if (this.tree.view) { this.view = { ...this.tree.view }; this.applyView(); } else this.fit();
    this.renderAll();
    const hash = '#tree=' + encodeURIComponent(id);
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }
  /** Re-read the current tree object after the repository's data was replaced (other tab). */
  reattach(): void {
    const prev = this.tree;
    const key = (t: Tree) => JSON.stringify([t.name, t.nodes, t.edges]);
    this.tree = this.repo.current;
    if (prev && prev.id === this.tree.id && key(prev) === key(this.tree)) {
      // only other trees changed: keep history, selection and focus untouched
      this.renderTreeBar(); this.hooks.renderLibrary();
      return;
    }
    this.forgetHistory(this.tree.id);
    this.cleanSel();
    if (!prev || prev.id !== this.tree.id) {
      this.clearSelection();
      if (this.tree.view) { this.view = { ...this.tree.view }; this.applyView(); } else this.fit();
    }
    this.renderAll();
  }

  /* ---------- mutations ---------- */
  addNode(type: NodeType, x: number, y: number, text = ''): CrtNode {
    this.checkpoint();
    const n = mkNode(this.tree, type, text, x, y);
    this.selNodes = new Set([n.id]); this.selEdge = null;
    this.save(); this.renderAll(); this.focusText();
    return n;
  }
  addAtCenter(type: NodeType): void {
    const c = this.viewCenter();
    const j = () => (Math.random() - 0.5) * 60;
    this.addNode(type, c.x + j(), c.y + j());
  }
  deleteSelection(): void {
    if (this.selEdge) {
      this.checkpoint();
      const id = this.selEdge;
      this.tree.edges = this.tree.edges.filter(e => e.id !== id);
      this.selEdge = null;
    } else if (this.selNodes.size) {
      this.checkpoint();
      const s = this.selNodes;
      this.tree.nodes = this.tree.nodes.filter(n => !s.has(n.id));
      this.tree.edges = this.tree.edges.filter(e => !s.has(e.from) && !s.has(e.to));
      this.selNodes = new Set();
    } else return;
    normalizeAnd(this.tree); this.cleanSel(); this.save(); this.renderAll();
  }
  /** Run a mutation as one undoable step, then save and re-render. */
  mutate(fn: () => void): void { this.checkpoint(); fn(); this.save(); this.renderAll(); }
  focusText(): void {
    setTimeout(() => { const t = document.querySelector<HTMLTextAreaElement>('#iText'); if (t) { t.focus(); t.select(); } }, 0);
  }

  /* ---------- view ---------- */
  applyView(): void {
    const v = this.view, t = `translate(${v.x},${v.y}) scale(${v.k})`;
    this.vp.setAttribute('transform', t); this.ov.setAttribute('transform', t);
    this.wrapEl.style.backgroundSize = `${24 * v.k}px ${24 * v.k}px`;
    this.wrapEl.style.backgroundPosition = `${v.x}px ${v.y}px`;
    $('#zoomPct').textContent = Math.round(v.k * 100) + '%';
    this.tree.view = { ...v };
  }
  toWorld(cx: number, cy: number) {
    const r = this.svg.getBoundingClientRect();
    return { x: (cx - r.left - this.view.x) / this.view.k, y: (cy - r.top - this.view.y) / this.view.k };
  }
  viewCenter() { const r = this.svg.getBoundingClientRect(); return this.toWorld(r.left + r.width / 2, r.top + r.height / 2); }
  bounds() {
    if (!this.tree.nodes.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    this.tree.nodes.forEach(n => {
      const g = this.geo.get(n.id) || measure(n);
      x0 = Math.min(x0, n.x - g.w / 2); x1 = Math.max(x1, n.x + g.w / 2);
      y0 = Math.min(y0, n.y - g.h / 2); y1 = Math.max(y1, n.y + g.h / 2);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  fit(): void {
    const b = this.bounds(), r = this.svg.getBoundingClientRect();
    if (!b) { this.view = { x: r.width / 2, y: r.height / 2, k: 1 }; this.applyView(); return; }
    // extra bottom padding keeps the lowest row clear of the hint bar
    const pad = 60, padB = 60 + 50;
    const k = clamp(Math.min((r.width - pad * 2) / b.w, (r.height - pad - padB) / b.h), 0.15, 1.2);
    this.view = { k, x: r.width / 2 - (b.x + b.w / 2) * k, y: (r.height - padB + pad) / 2 - (b.y + b.h / 2) * k };
    this.applyView(); this.saveViewSoon();
  }
  zoomBy(f: number, cx?: number, cy?: number): void {
    const r = this.svg.getBoundingClientRect(), v = this.view;
    const mx = cx ?? r.width / 2, my = cy ?? r.height / 2;
    const k = clamp(v.k * f, 0.15, 3);
    v.x = mx - (mx - v.x) * k / v.k; v.y = my - (my - v.y) * k / v.k; v.k = k;
    this.applyView(); this.saveViewSoon();
  }
  centerOn(n: CrtNode): void {
    const r = this.svg.getBoundingClientRect();
    this.view.x = r.width / 2 - n.x * this.view.k; this.view.y = r.height / 2 - n.y * this.view.k;
    this.applyView(); this.saveViewSoon();
  }

  /* ---------- rendering ---------- */
  renderAll(): void { this.render(); this.hooks.renderInspector(); this.renderTreeBar(); this.updateUndo(); this.hooks.renderLibrary(); }

  renderTreeBar(): void {
    const name = $<HTMLInputElement>('#treeName');
    if (document.activeElement !== name) name.value = this.tree.name;
    $('#treeCount').textContent = String(this.repo.count);
    document.title = `${this.tree.name} · Current Reality Tree`;
  }

  render(): void {
    const tree = this.tree, map = new Map(tree.nodes.map(n => [n.id, n]));
    this.geo.clear(); tree.nodes.forEach(n => this.geo.set(n.id, measure(n)));
    const an = this.analyze();
    const hl = this.highlightRoot && map.has(this.highlightRoot) ? an.downstream(this.highlightRoot) : null;
    this.vp.textContent = '';
    const gE = svgEl('g'), gA = svgEl('g'), gN = svgEl('g');
    const ends = new Map<string, { p1: { x: number; y: number }; p2: { x: number; y: number } }>();
    for (const e of tree.edges) {
      const a = map.get(e.from), b = map.get(e.to); if (!a || !b) continue;
      const p1 = clip(a, this.geo.get(a.id)!, b), p2 = clip(b, this.geo.get(b.id)!, a);
      ends.set(e.id, { p1, p2 });
      const raised = hasRaised(e.clr), sel = this.selEdge === e.id;
      const dim = hl && !(hl.has(e.from) && hl.has(e.to));
      const g = svgEl('g', { class: 'edge' + (sel ? ' selected' : '') + (raised ? ' raised' : '') + (dim ? ' dim' : ''), 'data-edge': e.id });
      g.append(svgEl('line', { class: 'hit', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }));
      g.append(svgEl('line', { class: 'vis', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, 'marker-end': `url(#${sel ? 'arwSel' : raised ? 'arwWarn' : 'arw'})` }));
      gE.append(g);
    }
    // AND ellipses: one per (effect, group), drawn across the arrows near the effect
    const groups = new Map<string, CrtEdge[]>();
    tree.edges.forEach(e => {
      if (e.andGroup && ends.has(e.id)) { const k = e.to + '|' + e.andGroup; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); }
    });
    groups.forEach(list => {
      if (list.length < 2) return;
      const pts = list.map(e => {
        const { p1, p2 } = ends.get(e.id)!;
        const dx = p1.x - p2.x, dy = p1.y - p2.y, Ln = Math.hypot(dx, dy) || 1, d = Math.min(30, Ln * 0.45);
        return { x: p2.x + dx / Ln * d, y: p2.y + dy / Ln * d, ux: -dx / Ln, uy: -dy / Ln };
      });
      let ux = pts.reduce((s, p) => s + p.ux, 0), uy = pts.reduce((s, p) => s + p.uy, 0);
      const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const nx = -uy, ny = ux;
      const pr = pts.map(p => p.x * nx + p.y * ny), al = pts.reduce((s, p) => s + p.x * ux + p.y * uy, 0) / pts.length;
      const mn = Math.min(...pr), mx = Math.max(...pr), mid = (mn + mx) / 2;
      const cx = nx * mid + ux * al, cy = ny * mid + uy * al;
      const ang = Math.atan2(ny, nx) * 180 / Math.PI;
      const dim = hl && !list.every(e => hl.has(e.from) && hl.has(e.to));
      gA.append(svgEl('ellipse', { class: 'andE' + (dim ? ' dim' : ''), cx, cy, rx: (mx - mn) / 2 + 14, ry: 9, transform: `rotate(${ang} ${cx} ${cy})` }));
    });
    for (const n of tree.nodes) {
      const g = this.geo.get(n.id)!, x = n.x - g.w / 2, y = n.y - g.h / 2;
      const isRoot = an.roots.has(n.id);
      const cls = ['node', n.type];
      if (isRoot) cls.push('root');
      if (n.core) cls.push('core');
      if (this.selNodes.has(n.id)) cls.push('selected');
      if (hl && !hl.has(n.id)) cls.push('dim');
      const G = svgEl('g', { class: cls.join(' '), 'data-node': n.id, transform: `translate(${x},${y})` });
      G.append(svgEl('rect', { class: 'box', width: g.w, height: g.h, rx: n.type === 'assumption' ? 18 : 8 }));
      const tag = n.core ? 'CORE PROBLEM' : n.type === 'ude' ? 'UDE' : n.type === 'assumption' ? 'ASSUMPTION' : isRoot ? 'ROOT CAUSE' : '';
      if (tag) G.append(svgEl('text', { class: 'tag', x: g.w - 10, y: 16, 'text-anchor': 'end' }, tag));
      const off = (g.h - (TOP + g.lines.length * LH + BOT)) / 2;
      const T = svgEl('text', { class: 'txt' + (g.ph ? ' ph' : ''), 'text-anchor': 'middle' });
      g.lines.forEach((ln, i) => T.append(svgEl('tspan', { x: g.w / 2, y: TOP + off + 13 + i * LH }, ln)));
      G.append(T);
      if (hasRaised(n.clr)) G.append(svgEl('text', { class: 'warnm', x: g.w - 14, y: g.h - 6 }, '!'));
      G.append(svgEl('circle', { class: 'numc', cx: 0, cy: 0, r: 12 }));
      G.append(svgEl('text', { class: 'numt', x: 0, y: 4 }, n.num));
      G.append(svgEl('circle', { class: 'handle', cx: g.w / 2, cy: 0, r: 7, 'data-handle': n.id, 'data-dir': 'up' }));
      G.append(svgEl('circle', { class: 'handle', cx: g.w / 2, cy: g.h, r: 7, 'data-handle': n.id, 'data-dir': 'down' }));
      gN.append(G);
    }
    this.vp.append(gE, gA, gN);
  }
}
