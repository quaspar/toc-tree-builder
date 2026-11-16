import type { App } from './app';
import { exampleTree } from '../model/example';
import { exportAllJson } from '../model/io';
import { STORAGE_KEY } from '../model/repository';
import { esc } from '../model/util';
import { $, download, toast } from './dom';

const svgIcon = (d: string) =>
  `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  rename: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  dup: svgIcon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  del: svgIcon('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>'),
};

export function relTime(ts: number, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

export interface Library {
  render(): void;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
}

/**
 * Side panel listing every stored tree. Switching trees happens here without any export/import:
 * click a tree to open it; rename, duplicate and delete in place.
 */
export function setupLibrary(app: App, importFile: () => void): Library {
  const panel = $<HTMLElement>('#library'), list = $<HTMLUListElement>('#libList');
  const search = $<HTMLInputElement>('#libSearch'), foot = $<HTMLElement>('#libFoot');
  let renaming: string | null = null;

  const isOpen = () => panel.classList.contains('open');

  function render(): void {
    if (!isOpen() || renaming) return;
    const qv = search.value.trim().toLowerCase();
    const all = app.repo.list();
    const items = qv ? all.filter(t => t.name.toLowerCase().includes(qv)) : all;
    list.innerHTML = items.length ? items.map(t => `
      <li data-tree="${t.id}" class="${t.current ? 'current' : ''}" tabindex="0" aria-current="${t.current}">
        <div class="meta">
          <div class="nm" title="${esc(t.name)}">${esc(t.name)}</div>
          <div class="sub">${t.entities} ${t.entities === 1 ? 'entity' : 'entities'} · ${t.udes} UDE${t.udes === 1 ? '' : 's'} · ${relTime(t.updated)}</div>
        </div>
        <div class="acts">
          <button data-act="rename" title="Rename" aria-label="Rename">${ICON.rename}</button>
          <button data-act="dup" title="Duplicate" aria-label="Duplicate">${ICON.dup}</button>
          <button data-act="del" class="danger" title="Delete" aria-label="Delete">${ICON.del}</button>
        </div>
      </li>`).join('') : `<li class="empty">No trees match “${esc(qv)}”.</li>`;
    let bytes = 0;
    try { bytes = (localStorage.getItem(STORAGE_KEY) || '').length * 2; } catch { /* ignore */ }
    foot.innerHTML = `${all.length} tree${all.length === 1 ? '' : 's'} saved in this browser (${(bytes / 1024).toFixed(0)} KB). Nothing leaves your machine — use <b>Export all</b> for backups.`;
  }

  function open(): void {
    panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
    render();
    setTimeout(() => search.focus(), 0);
  }
  function close(): void {
    panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
    renaming = null; search.value = '';
    if (panel.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }
  const toggle = () => (isOpen() ? close() : open());

  function openTree(id: string): void {
    if (id !== app.tree.id) app.open(id);
    close();
  }

  function startRename(li: HTMLElement): void {
    const id = li.dataset.tree!, t = app.repo.get(id);
    if (!t) return;
    renaming = id;
    const nm = li.querySelector<HTMLElement>('.nm')!;
    nm.innerHTML = `<input type="text" class="rename" aria-label="New name">`;
    const input = nm.querySelector<HTMLInputElement>('input')!;
    input.value = t.name;
    input.focus(); input.select();
    let done = false;
    const finish = (commit: boolean) => {
      if (done) return; done = true;
      renaming = null;
      if (commit && input.value.trim() && input.value.trim() !== t.name) {
        app.repo.rename(id, input.value);
        app.save(false);
        app.renderTreeBar();
        if (id === app.tree.id) app.hooks.renderInspector();
      }
      render();
    };
    input.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') finish(true);
      else if (ev.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', ev => ev.stopPropagation());
  }

  function remove(id: string): void {
    const t = app.repo.get(id);
    if (!t) return;
    const wasCurrent = id === app.tree.id;
    const wasOnly = app.repo.count === 1;
    const deleted = app.repo.remove(id)!;
    // deleting the only tree leaves an empty placeholder; drop it again on undo if still unused
    const placeholder = wasOnly ? app.repo.data.currentId : null;
    app.forgetHistory(id);
    if (wasCurrent) app.open(app.repo.data.currentId!); else { app.save(false); app.renderAll(); }
    render();
    toast(`Deleted “${deleted.name}”`, {
      label: 'Undo',
      run: () => {
        app.repo.data.trees[deleted.id] = deleted;
        const ph = placeholder ? app.repo.get(placeholder) : undefined;
        if (ph && !ph.nodes.length) delete app.repo.data.trees[ph.id];
        if (wasCurrent) app.open(deleted.id); else { app.save(false); app.renderAll(); }
        render();
      },
    }, 9000);
  }

  list.addEventListener('click', ev => {
    const li = (ev.target as Element).closest<HTMLElement>('li[data-tree]');
    if (!li) return;
    const id = li.dataset.tree!;
    const act = (ev.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'rename') startRename(li);
    else if (act === 'dup') { const c = app.repo.duplicate(id); app.open(c.id); render(); toast(`Created “${c.name}”`); }
    else if (act === 'del') remove(id);
    else if (renaming !== id) openTree(id);
  });
  list.addEventListener('dblclick', ev => {
    const li = (ev.target as Element).closest<HTMLElement>('li[data-tree]');
    if (li && (ev.target as Element).closest('.nm')) { ev.preventDefault(); startRename(li); }
  });
  list.addEventListener('keydown', ev => {
    const li = (ev.target as Element).closest<HTMLElement>('li[data-tree]');
    if (!li || ev.target !== li) return;
    if (ev.key === 'Enter') { ev.preventDefault(); openTree(li.dataset.tree!); }
    else if (ev.key === 'F2') { ev.preventDefault(); startRename(li); }
    else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      const sib = (ev.key === 'ArrowDown' ? li.nextElementSibling : li.previousElementSibling) as HTMLElement | null;
      sib?.focus();
    }
  });
  search.addEventListener('input', render);
  search.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('li[data-tree]');
      if (first) openTree(first.dataset.tree!);
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault(); list.querySelector<HTMLElement>('li[data-tree]')?.focus();
    } else if (ev.key === 'Escape') { ev.stopPropagation(); close(); }
  });

  $('#bTrees').onclick = toggle;
  $('#bLibClose').onclick = close;
  $('#bNewTree').onclick = () => {
    const t = app.repo.create('New tree');
    app.open(t.id); close();
    const name = $<HTMLInputElement>('#treeName'); name.focus(); name.select();
  };
  $('#bExampleTree').onclick = () => { const t = app.repo.add(exampleTree()); app.open(t.id); close(); };
  $('#bLibImport').onclick = importFile;
  $('#bExpAll').onclick = () => {
    app.flush();
    const stamp = new Date().toISOString().slice(0, 10);
    download(`crt-trees-${stamp}.json`, new Blob([exportAllJson(Object.values(app.repo.data.trees))], { type: 'application/json' }));
  };
  // close when clicking on the canvas behind the panel
  app.svg.addEventListener('pointerdown', () => { if (isOpen()) close(); });

  return { render, open, close, toggle, isOpen };
}
