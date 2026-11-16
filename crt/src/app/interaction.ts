import type { App } from './app';
import { addEdge, mkNode } from '../model/tree';
import { svgEl } from './dom';

type Pt = { x: number; y: number };
type Drag =
  | { mode: 'connect'; from: string; dir: 'up' | 'down'; line: SVGElement; start: Pt; over: string | null }
  | { mode: 'move'; start: Pt; orig: Map<string, Pt>; moved: boolean }
  | { mode: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { mode: 'marquee'; start: Pt; rect: SVGElement; end?: Pt };

export interface KeyActions {
  isModalOpen(): boolean;
  closeModal(): void;
  isLibraryOpen(): boolean;
  closeLibrary(): void;
  toggleLibrary(): void;
}

export function setupInteraction(app: App, keys: KeyActions): void {
  const { svg, vp, ov } = app;
  let drag: Drag | null = null;

  svg.addEventListener('pointerdown', ev => {
    if (ev.button !== 0) return;
    const t = ev.target as Element;
    const handle = t.closest<SVGElement>('[data-handle]'), nodeEl = t.closest<SVGElement>('[data-node]'), edgeEl = t.closest<SVGElement>('[data-edge]');
    const w = app.toWorld(ev.clientX, ev.clientY);
    svg.setPointerCapture?.(ev.pointerId);
    if (handle) {
      const n = app.find(handle.dataset.handle!)!, g = app.geo.get(n.id)!, dir = handle.dataset.dir as 'up' | 'down';
      const sx = n.x, sy = dir === 'up' ? n.y - g.h / 2 : n.y + g.h / 2;
      const line = svgEl('line', { class: 'temp', x1: sx, y1: sy, x2: w.x, y2: w.y });
      ov.append(line);
      drag = { mode: 'connect', from: n.id, dir, line, start: w, over: null };
      return;
    }
    if (nodeEl) {
      const id = nodeEl.dataset.node!;
      if (ev.shiftKey) {
        if (app.selNodes.has(id)) app.selNodes.delete(id); else app.selNodes.add(id);
        app.selEdge = null; app.renderAll(); drag = null; return;
      }
      if (!app.selNodes.has(id)) { app.selNodes = new Set([id]); app.selEdge = null; app.hooks.renderInspector(); }
      drag = { mode: 'move', start: w, orig: new Map([...app.selNodes].map(i => { const n = app.find(i)!; return [i, { x: n.x, y: n.y }]; })), moved: false };
      app.render(); return;
    }
    if (edgeEl) { app.selEdge = edgeEl.dataset.edge!; app.selNodes = new Set(); app.renderAll(); drag = null; return; }
    if (ev.shiftKey) {
      const rect = svgEl('rect', { class: 'marquee', x: w.x, y: w.y, width: 0, height: 0 });
      ov.append(rect); drag = { mode: 'marquee', start: w, rect }; return;
    }
    drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, vx: app.view.x, vy: app.view.y, moved: false };
    svg.classList.add('panning');
  });

  svg.addEventListener('pointermove', ev => {
    if (!drag) return;
    const w = app.toWorld(ev.clientX, ev.clientY);
    if (drag.mode === 'connect') {
      drag.line.setAttribute('x2', String(w.x)); drag.line.setAttribute('y2', String(w.y));
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<SVGElement>('[data-node]');
      const id = over && over.dataset.node !== drag.from ? over.dataset.node! : null;
      if (id !== drag.over) {
        vp.querySelectorAll('.dropTarget').forEach(x => x.classList.remove('dropTarget'));
        if (id && over) over.classList.add('dropTarget');
        drag.over = id;
      }
    } else if (drag.mode === 'move') {
      const dx = w.x - drag.start.x, dy = w.y - drag.start.y;
      if (!drag.moved && Math.hypot(dx, dy) * app.view.k < 3) return;
      if (!drag.moved) { app.checkpoint(); drag.moved = true; }
      drag.orig.forEach((o, id) => { const n = app.find(id); if (n) { n.x = o.x + dx; n.y = o.y + dy; } });
      app.render();
    } else if (drag.mode === 'pan') {
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 3) drag.moved = true;
      app.view.x = drag.vx + dx; app.view.y = drag.vy + dy; app.applyView();
    } else if (drag.mode === 'marquee') {
      const x = Math.min(w.x, drag.start.x), y = Math.min(w.y, drag.start.y);
      drag.rect.setAttribute('x', String(x)); drag.rect.setAttribute('y', String(y));
      drag.rect.setAttribute('width', String(Math.abs(w.x - drag.start.x))); drag.rect.setAttribute('height', String(Math.abs(w.y - drag.start.y)));
      drag.end = w;
    }
  });

  svg.addEventListener('pointerup', ev => {
    if (!drag) return;
    const d = drag; drag = null;
    svg.classList.remove('panning');
    const w = app.toWorld(ev.clientX, ev.clientY);
    if (d.mode === 'connect') {
      d.line.remove();
      const target = d.over;
      if (target) {
        app.checkpoint();
        const e = d.dir === 'up' ? addEdge(app.tree, d.from, target) : addEdge(app.tree, target, d.from);
        if (!e) { app.dropCheckpoint(); app.render(); return; }
        app.selEdge = e.id; app.selNodes = new Set(); app.save(); app.renderAll();
      } else if (Math.hypot(w.x - d.start.x, w.y - d.start.y) * app.view.k > 30) {
        app.checkpoint();
        const n = mkNode(app.tree, 'entity', '', w.x, w.y);
        if (d.dir === 'up') addEdge(app.tree, d.from, n.id); else addEdge(app.tree, n.id, d.from);
        app.selNodes = new Set([n.id]); app.selEdge = null; app.save(); app.renderAll(); app.focusText();
      } else app.render();
    } else if (d.mode === 'move') {
      if (d.moved) app.save();
    } else if (d.mode === 'pan') {
      if (!d.moved) { app.clearSelection(); app.renderAll(); }
      else app.saveViewSoon();
    } else if (d.mode === 'marquee') {
      d.rect.remove();
      if (d.end) {
        const x0 = Math.min(d.start.x, d.end.x), x1 = Math.max(d.start.x, d.end.x), y0 = Math.min(d.start.y, d.end.y), y1 = Math.max(d.start.y, d.end.y);
        app.tree.nodes.forEach(n => { if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) app.selNodes.add(n.id); });
        app.selEdge = null; app.renderAll();
      }
    }
  });

  svg.addEventListener('pointercancel', () => {
    if (drag?.mode === 'connect') drag.line.remove();
    if (drag?.mode === 'marquee') drag.rect.remove();
    drag = null; svg.classList.remove('panning'); app.render();
  });

  svg.addEventListener('dblclick', ev => {
    const t = ev.target as Element;
    const nodeEl = t.closest<SVGElement>('[data-node]');
    if (nodeEl) { app.selNodes = new Set([nodeEl.dataset.node!]); app.selEdge = null; app.renderAll(); app.focusText(); return; }
    if (t.closest('[data-edge]')) return;
    const w = app.toWorld(ev.clientX, ev.clientY);
    app.addNode('entity', w.x, w.y);
  });

  svg.addEventListener('wheel', ev => {
    ev.preventDefault();
    const r = svg.getBoundingClientRect();
    const f = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015));
    app.zoomBy(f, ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });

  document.addEventListener('keydown', ev => {
    const active = document.activeElement as HTMLElement | null;
    const typing = !!active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName);
    const mod = ev.ctrlKey || ev.metaKey;
    if (typing) { if (ev.key === 'Escape') active!.blur(); return; }
    if (mod && ev.key.toLowerCase() === 'z') { ev.preventDefault(); if (ev.shiftKey) app.redo(); else app.undo(); return; }
    if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); app.redo(); return; }
    if (mod || ev.altKey) return;
    if (ev.key === 'Escape') {
      if (keys.isModalOpen()) return keys.closeModal();
      if (keys.isLibraryOpen()) return keys.closeLibrary();
      app.clearSelection(); app.renderAll();
      return;
    }
    if (keys.isModalOpen()) return;
    const k = ev.key.toLowerCase();
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); app.deleteSelection(); }
    else if (k === 'n') { ev.preventDefault(); app.addAtCenter('entity'); }
    else if (k === 'u') { ev.preventDefault(); app.addAtCenter('ude'); }
    else if (k === 't') { ev.preventDefault(); keys.toggleLibrary(); }
    else if (k === 'f') app.fit();
    else if (ev.key === 'Enter' && app.selNodes.size === 1) { ev.preventDefault(); app.focusText(); }
  });
}
