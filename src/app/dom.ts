export const NS = 'http://www.w3.org/2000/svg';

export function $<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const e = root.querySelector<T>(sel);
  if (!e) throw new Error('Missing element ' + sel);
  return e;
}

export function svgEl(tag: string, attrs: Record<string, string | number | null | undefined> = {}, text?: string | number): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = String(text);
  return e;
}

export function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

let toastT: ReturnType<typeof setTimeout> | undefined;
/** Small transient message at the bottom, optionally with one action button (e.g. Undo). */
export function toast(msg: string, action?: { label: string; run: () => void }, ms = 7000): void {
  const box = $('#toast'), btn = $<HTMLButtonElement>('#toastBtn');
  $('#toastMsg').textContent = msg;
  btn.hidden = !action;
  btn.textContent = action?.label ?? '';
  btn.onclick = action ? () => { action.run(); hide(); } : null;
  box.classList.add('show');
  clearTimeout(toastT);
  const hide = () => box.classList.remove('show');
  toastT = setTimeout(hide, ms);
}
