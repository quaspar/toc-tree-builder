import type { App } from './app';
import type { Analysis } from '../model/analysis';
import { groupsInto, unreachedUdes } from '../model/analysis';
import { CLR_EDGE, CLR_NODE, cycleClr, hasRaised, type ClrDef } from '../model/clr';
import { reverseEdge, setAnd, normalizeAnd } from '../model/tree';
import type { ClrMap, CrtEdge, CrtNode, NodeType } from '../model/types';
import { esc, short, uid } from '../model/util';
import { $ } from './dom';

export function setupInspector(app: App, openHelp: () => void): () => void {
  const insp = $<HTMLElement>('#insp');
  const q = <T extends HTMLElement = HTMLElement>(s: string) => insp.querySelector<T>(s);

  const ref = (id: string) => {
    const n = app.find(id);
    return n ? `<a data-goto="${n.id}">[${n.num}] ${esc(short(n.text, 90))}</a>` : '?';
  };
  const ifThen = (edges: CrtEdge[], targetId: string) =>
    `<div class="reading"><span class="kw">IF</span> ${edges.map(e => ref(e.from)).join(' <span class="kw">AND</span> ')} <span class="kw">THEN</span> ${ref(targetId)}</div>`;
  const clrRows = (list: readonly ClrDef[], obj: ClrMap) => list.map(([k, t, qq]) => {
    const s = obj?.[k] || '';
    return `<div class="clr"><button data-clr="${k}" class="${s}" title="Click to cycle: unchecked → OK → reservation raised">${s === 'ok' ? '✓' : s === 'raised' ? '!' : '○'}</button><div><b>${t}</b><small>${qq}</small></div></div>`;
  }).join('');

  const bindClr = (obj: { clr: ClrMap }) => {
    insp.querySelectorAll<HTMLButtonElement>('[data-clr]').forEach(b => {
      b.onclick = () => app.mutate(() => cycleClr(obj.clr, b.dataset.clr!));
    });
  };
  const bindText = (elm: HTMLTextAreaElement, obj: CrtNode, field: 'text' | 'notes', rerender: boolean) => {
    let commit: (() => void) | null = null;
    elm.addEventListener('focus', () => { commit = app.beginTextEdit(); });
    elm.addEventListener('input', () => {
      commit?.();
      obj[field] = elm.value;
      if (rerender) app.render();
      app.saveSoon();
    });
  };

  function render(): void {
    const an = app.analyze();
    const e = app.selEdge ? app.findE(app.selEdge) : undefined;
    if (e) return edgeInspector(e, an);
    if (app.selNodes.size === 1) { const n = app.find([...app.selNodes][0]); if (n) return nodeInspector(n, an); }
    if (app.selNodes.size > 1) return multiInspector(an);
    treeInspector(an);
  }

  function nodeInspector(n: CrtNode, an: Analysis): void {
    const ins = groupsInto(n.id, an), outs = an.out.get(n.id) || [];
    const isRoot = an.roots.has(n.id);
    const reach = an.reach.get(n.id) ?? 0;
    insp.innerHTML = `
      <h3>Entity [${n.num}]${isRoot ? ' · root cause' : ''}</h3>
      <label>Statement<textarea id="iText" rows="4" placeholder="Present tense, factual, one idea">${esc(n.text)}</textarea></label>
      <label>Type<select id="iType">
        <option value="entity">Entity (intermediate effect / cause)</option>
        <option value="ude">UDE — undesirable effect</option>
        <option value="assumption">Assumption / explanatory note</option></select></label>
      <label class="chk"><input type="checkbox" id="iCore" ${n.core ? 'checked' : ''}> Mark as core problem</label>
      ${isRoot && an.udes.length ? `<p class="hintp">Reaches ${reach} of ${an.udes.length} UDEs (${Math.round(reach / an.udes.length * 100)}%).</p>` : ''}
      <h4>Caused by</h4>
      ${ins.length ? ins.map(g => ifThen(g, n.id)).join('') : `<p class="hintp">${n.type === 'assumption' ? 'No causes.' : 'No causes yet — this is a root (or still unexplored). Drag the bottom dot to add a cause.'}</p>`}
      <h4>Leads to</h4>
      ${outs.length ? `<ul class="plain">${outs.map(e => `<li>→ ${ref(e.to)}</li>`).join('')}</ul>` : `<p class="hintp">No effects. Drag the top dot to add one.</p>`}
      <h4>Scrutiny (CLR)</h4>${clrRows(CLR_NODE, n.clr)}
      <label>Notes / evidence<textarea id="iNotes" rows="3">${esc(n.notes)}</textarea></label>
      <div class="row">${isRoot ? `<button id="iHl" class="${app.highlightRoot === n.id ? 'on' : ''}">Highlight reach</button>` : ''}<button id="iDel" class="danger">Delete entity</button></div>`;
    const type = q<HTMLSelectElement>('#iType')!;
    type.value = n.type;
    bindText(q<HTMLTextAreaElement>('#iText')!, n, 'text', true);
    bindText(q<HTMLTextAreaElement>('#iNotes')!, n, 'notes', false);
    type.onchange = () => app.mutate(() => { n.type = type.value as NodeType; });
    const core = q<HTMLInputElement>('#iCore')!;
    core.onchange = () => app.mutate(() => { n.core = core.checked; });
    q('#iDel')!.onclick = () => app.deleteSelection();
    const hl = q('#iHl');
    if (hl) hl.onclick = () => { app.highlightRoot = app.highlightRoot === n.id ? null : n.id; app.renderAll(); };
    bindClr(n);
  }

  function edgeInspector(e: CrtEdge, an: Analysis): void {
    const into = an.inc.get(e.to) || [];
    const grp = e.andGroup ? into.filter(x => x.andGroup === e.andGroup) : [e];
    const others = into.filter(x => x.id !== e.id);
    const from = app.find(e.from)!, to = app.find(e.to)!;
    insp.innerHTML = `
      <h3>Cause → effect</h3>
      <p class="hintp">Read it aloud:</p>${ifThen(grp, e.to)}
      <h4>Logical AND</h4>
      ${others.length ? `<p class="hintp">Tick the other causes that are only sufficient <i>together</i> with [${from.num}].</p>
        ${others.map(o => `<label class="andopt"><input type="checkbox" data-and="${o.id}" ${e.andGroup && o.andGroup === e.andGroup ? 'checked' : ''}><span>[${app.find(o.from)!.num}] ${esc(short(app.find(o.from)!.text, 80))}</span></label>`).join('')}`
        : `<p class="hintp">This is the only arrow into [${to.num}]. If the cause is insufficient on its own, add the missing cause (drag the bottom dot of [${to.num}]) and tie them here.</p>`}
      <h4>Scrutiny (CLR)</h4>${clrRows(CLR_EDGE, e.clr)}
      <div class="row"><button id="eRev">Reverse arrow</button><button id="eDel" class="danger">Delete arrow</button></div>`;
    insp.querySelectorAll<HTMLInputElement>('[data-and]').forEach(cb => {
      cb.onchange = () => { const o = app.findE(cb.dataset.and!); if (o) app.mutate(() => setAnd(app.tree, e, o, cb.checked)); };
    });
    q('#eRev')!.onclick = () => app.mutate(() => reverseEdge(app.tree, e));
    q('#eDel')!.onclick = () => app.deleteSelection();
    bindClr(e);
  }

  function multiInspector(an: Analysis): void {
    const ids = [...app.selNodes];
    const targets = new Map<string, CrtEdge[]>();
    ids.forEach(id => (an.out.get(id) || []).forEach(e => { if (!targets.has(e.to)) targets.set(e.to, []); targets.get(e.to)!.push(e); }));
    const common = [...targets.entries()].filter(([, es]) => es.length >= 2);
    insp.innerHTML = `
      <h3>${ids.length} entities selected</h3>
      ${common.length ? `<h4>Combine as AND</h4><p class="hintp">These selected causes share an effect. Tie their arrows so they read “IF A AND B THEN C”.</p>
        ${common.map(([t]) => `<div class="row" style="margin-top:6px"><button data-andinto="${t}">AND into [${app.find(t)!.num}] ${esc(short(app.find(t)!.text, 34))}</button></div>`).join('')}` : ''}
      <h4>Set type</h4>
      <div class="row" style="margin-top:4px"><button data-type="ude">UDE</button><button data-type="entity">Entity</button><button data-type="assumption">Assumption</button></div>
      <div class="row"><button id="mDel" class="danger">Delete selected</button></div>
      <p class="hintp" style="margin-top:14px">Drag any selected entity to move them together.</p>`;
    insp.querySelectorAll<HTMLButtonElement>('[data-andinto]').forEach(b => {
      b.onclick = () => app.mutate(() => {
        const g = uid();
        targets.get(b.dataset.andinto!)!.forEach(e => { e.andGroup = g; });
        normalizeAnd(app.tree);
      });
    });
    insp.querySelectorAll<HTMLButtonElement>('[data-type]').forEach(b => {
      b.onclick = () => app.mutate(() => ids.forEach(id => { const n = app.find(id); if (n) n.type = b.dataset.type as NodeType; }));
    });
    q('#mDel')!.onclick = () => app.deleteSelection();
  }

  function treeInspector(an: Analysis): void {
    const tree = app.tree, U = an.udes.length;
    const roots = [...an.roots].map(id => app.find(id)!).sort((a, b) => (an.reach.get(b.id)! - an.reach.get(a.id)!) || a.num - b.num);
    const raisedN = tree.nodes.filter(n => hasRaised(n.clr)), raisedE = tree.edges.filter(e => hasRaised(e.clr));
    const unreached = unreachedUdes(an);
    const attention: string[] = [];
    an.udeNoCause.forEach(u => attention.push(`UDE ${ref(u.id)} has no causes yet.`));
    an.isolated.filter(n => n.type !== 'ude').forEach(n => attention.push(`${ref(n.id)} is not connected.`));
    raisedN.forEach(n => attention.push(`Reservation raised on ${ref(n.id)}.`));
    raisedE.forEach(e => attention.push(`Reservation raised on arrow <a data-gotoedge="${e.id}" data-goto="">[${app.find(e.from)?.num}] → [${app.find(e.to)?.num}]</a>.`));
    insp.innerHTML = `
      <h3>${esc(tree.name)}</h3>
      <div class="stats">
        <div class="stat"><b>${tree.nodes.length}</b><span>entities</span></div>
        <div class="stat"><b>${U}</b><span>UDEs</span></div>
        <div class="stat"><b>${an.roots.size}</b><span>root causes</span></div>
      </div>
      <h4>Root causes by UDE reach</h4>
      ${roots.length ? roots.map(r => {
        const c = an.reach.get(r.id)!, p = U ? Math.round(c / U * 100) : 0;
        return `<div class="rootrow"><div class="txt">${ref(r.id)}<br><small>${c}/${U} UDEs · ${p}%${r.core ? ' · <b>core problem</b>' : ''}</small><div class="bar"><i style="width:${p}%"></i></div></div>
          <button data-hl="${r.id}" class="${app.highlightRoot === r.id ? 'on' : ''}" title="Highlight what this causes">Show</button>
          <button data-core="${r.id}" class="${r.core ? 'on' : ''}" title="Mark as core problem">Core</button></div>`;
      }).join('') : '<p class="hintp">No root causes yet. Connect entities with arrows; entities without causes become roots.</p>'}
      ${U && unreached.length ? `<p class="hintp">${unreached.length} UDE(s) not yet traced back to any root cause.</p>` : ''}
      <p class="hintp">Rule of thumb: the core problem is the root cause that leads to most of the UDEs, typically ≥ 70%.</p>
      <h4>Needs attention</h4>
      ${attention.length ? `<ul class="plain">${attention.map(a => `<li>${a}</li>`).join('')}</ul>` : '<p class="hintp">Nothing flagged.</p>'}
      <h4>How to build</h4>
      <ol class="steps">
        <li>Add your UDEs (top of the tree).</li>
        <li>From each UDE drag its bottom dot to add a cause; ask “why does this exist?”</li>
        <li>Click arrows, read the IF…THEN aloud, check each reservation.</li>
        <li>Tie insufficient causes together with AND.</li>
        <li>Continue down to root causes and pick the core problem.</li>
      </ol>
      <div class="row"><button id="tHelp">Full help</button></div>`;
    insp.querySelectorAll<HTMLButtonElement>('[data-hl]').forEach(b => {
      b.onclick = () => { app.highlightRoot = app.highlightRoot === b.dataset.hl ? null : b.dataset.hl!; app.renderAll(); };
    });
    insp.querySelectorAll<HTMLButtonElement>('[data-core]').forEach(b => {
      b.onclick = () => app.mutate(() => { const n = app.find(b.dataset.core!); if (n) n.core = !n.core; });
    });
    q('#tHelp')!.onclick = openHelp;
  }

  insp.addEventListener('click', ev => {
    const a = (ev.target as Element).closest<HTMLElement>('[data-goto]');
    if (!a) return;
    ev.preventDefault();
    if (a.dataset.gotoedge) { app.selEdge = a.dataset.gotoedge; app.selNodes = new Set(); app.renderAll(); return; }
    const n = app.find(a.dataset.goto!);
    if (!n) return;
    app.selNodes = new Set([n.id]); app.selEdge = null; app.renderAll(); app.centerOn(n);
  });

  return render;
}
