export const uid = (): string => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const short = (s: string | null | undefined, n = 70): string => {
  const t = String(s || '').trim() || '(empty)';
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};
export const slug = (s: string): string =>
  (s || 'tree').toLowerCase().replace(/[^a-z0-9åäö]+/gi, '-').replace(/^-|-$/g, '') || 'tree';
