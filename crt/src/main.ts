import './styles/main.css';
import { App } from './app/app';
import { $, download, toast } from './app/dom';
import { buildSvgString, svgToPng } from './app/exporters';
import { setupInspector } from './app/inspector';
import { setupInteraction } from './app/interaction';
import { setupLibrary } from './app/library';
import { exampleTree } from './model/example';
import { exportTreeJson, parseImport } from './model/io';
import { layoutTree } from './model/layout';
import { TreeRepository } from './model/repository';
import { slug } from './model/util';

let storage: Storage | null = null;
try { storage = window.localStorage; } catch { storage = null; }

const repo = new TreeRepository(storage, exampleTree);
const loaded = repo.load();
const app = new App(repo);

/* ---------- help modal ---------- */
const modal = $('#modal');
const openHelp = () => modal.classList.add('open');
const closeHelp = () => modal.classList.remove('open');
$('#bHelp').onclick = openHelp;
$('#bCloseHelp').onclick = closeHelp;
modal.onclick = e => { if ((e.target as Element).id === 'modal') closeHelp(); };

/* ---------- import ---------- */
const fileIn = $<HTMLInputElement>('#fileIn');
const importFile = () => fileIn.click();
fileIn.onchange = async () => {
  const f = fileIn.files?.[0];
  fileIn.value = '';
  if (!f) return;
  try {
    const trees = parseImport(await f.text(), f.name);
    trees.forEach(t => repo.add(t));
    app.open(trees[trees.length - 1].id);
    toast(trees.length === 1 ? `Imported “${trees[0].name}”` : `Imported ${trees.length} trees`);
  } catch (err) {
    alert('Could not import: ' + (err as Error).message);
  }
};

/* ---------- panels ---------- */
const renderInspector = setupInspector(app, openHelp);
const library = setupLibrary(app, importFile);
app.hooks = { renderInspector, renderLibrary: library.render };
setupInteraction(app, {
  isModalOpen: () => modal.classList.contains('open'),
  closeModal: closeHelp,
  isLibraryOpen: library.isOpen,
  closeLibrary: library.close,
  toggleLibrary: library.toggle,
});

/* ---------- header ---------- */
const nameIn = $<HTMLInputElement>('#treeName');
nameIn.addEventListener('input', () => {
  app.tree.name = nameIn.value || 'Untitled tree';
  app.saveSoon();
  renderInspector();
  document.title = `${app.tree.name} · Current Reality Tree`;
});
nameIn.addEventListener('change', () => app.renderTreeBar());
$('#bAddUde').onclick = () => app.addAtCenter('ude');
$('#bAddEnt').onclick = () => app.addAtCenter('entity');
$('#bAddAsm').onclick = () => app.addAtCenter('assumption');
$('#bUndo').onclick = () => app.undo();
$('#bRedo').onclick = () => app.redo();
$('#bLayout').onclick = () => {
  if (!app.tree.nodes.length) return;
  app.checkpoint(); layoutTree(app.tree); app.save(); app.render(); app.fit(); app.renderAll();
};
$('#bFit').onclick = () => app.fit();
$('#bZoomIn').onclick = () => app.zoomBy(1.2);
$('#bZoomOut').onclick = () => app.zoomBy(1 / 1.2);
$('#bImpJson').onclick = importFile;
$('#bExpJson').onclick = () =>
  download(slug(app.tree.name) + '.crt.json', new Blob([exportTreeJson(app.tree)], { type: 'application/json' }));
$('#bExpSvg').onclick = () => {
  const r = buildSvgString(app);
  if (!r) return alert('The tree is empty.');
  download(slug(app.tree.name) + '.svg', new Blob([r.s], { type: 'image/svg+xml' }));
};
$('#bExpPng').onclick = async () => {
  const r = buildSvgString(app);
  if (!r) return alert('The tree is empty.');
  try { download(slug(app.tree.name) + '.png', await svgToPng(r)); }
  catch { alert('PNG export failed in this browser — use SVG instead.'); }
};

/* ---------- deep links & other tabs ---------- */
const hashId = () => {
  const m = /^#tree=(.+)$/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
};
window.addEventListener('hashchange', () => {
  const id = hashId();
  if (id && id !== app.tree.id && repo.get(id)) app.open(id);
});
repo.listen(window);
repo.onExternalChange(() => app.reattach());
window.addEventListener('beforeunload', () => app.flush());
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') app.flush(); });

/* ---------- start ---------- */
const initial = hashId();
app.open(initial && repo.get(initial) ? initial : repo.data.currentId!);
if (!loaded.storageOk) app.setStatus('Browser storage unavailable — work will not persist. Use Export JSON.', true);
else if (loaded.recovered) toast('Stored trees could not be read. A copy was kept in localStorage; started with an example tree.', undefined, 15000);
if (loaded.firstRun) openHelp();

// handy for debugging and for end-to-end tests
(window as unknown as { crt: unknown }).crt = { app, repo };
