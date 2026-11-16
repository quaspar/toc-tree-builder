import type { App } from './app';
import { NS } from './dom';

/** Light-theme styles inlined into exported SVG/PNG so they look the same everywhere. */
const EXPORT_CSS = `
text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.edge .vis{stroke:#4f4d48;stroke-width:1.6;fill:none}
.edge.raised .vis{stroke:#d97706;stroke-dasharray:6 4}
.andE{fill:none;stroke:#4f4d48;stroke-width:1.7}
.mk{fill:#4f4d48}.mk-sel{fill:#7c3aed}.mk-warn{fill:#d97706}
.node .box{fill:#fff;stroke:#8f8c84;stroke-width:1.3}
.node.ude .box{fill:#fff0e8;stroke:#c2410c;stroke-width:1.8}
.node.assumption .box{stroke-dasharray:5 4}
.node.root .box{stroke:#1d4ed8;stroke-width:2.2}
.node.core .box{stroke:#111;stroke-width:3.4}
.node .txt{font-size:13px;fill:#1c1c1e}
.node.assumption .txt{font-style:italic}
.node .txt.ph{fill:#6b6a70;font-style:italic}
.node .tag{font-size:9.5px;font-weight:700;letter-spacing:.07em;fill:#6b6a70}
.node.ude .tag{fill:#c2410c}.node.root .tag{fill:#1d4ed8}.node.core .tag{fill:#111}
.node .numc{fill:#fff;stroke:#8f8c84;stroke-width:1.2}
.node .numt{font-size:11px;font-weight:700;fill:#1c1c1e;text-anchor:middle}
.node .warnm{font-size:13px;font-weight:700;fill:#d97706}`;

export function buildSvgString(app: App): { s: string; W: number; H: number } | null {
  const keep = { selNodes: app.selNodes, selEdge: app.selEdge, highlightRoot: app.highlightRoot };
  app.selNodes = new Set(); app.selEdge = null; app.highlightRoot = null; app.render();
  const b = app.bounds(), pad = 30;
  const clone = app.vp.cloneNode(true) as SVGGElement;
  clone.removeAttribute('transform');
  clone.querySelectorAll('.hit,.handle').forEach(x => x.remove());
  Object.assign(app, keep); app.render();
  if (!b) return null;
  const W = Math.ceil(b.w + pad * 2), H = Math.ceil(b.h + pad * 2);
  const defs = document.querySelector('#defs')!.innerHTML;
  const s = `<svg xmlns="${NS}" width="${W}" height="${H}" viewBox="${b.x - pad} ${b.y - pad} ${W} ${H}"><style>${EXPORT_CSS}</style><defs>${defs}</defs><rect x="${b.x - pad}" y="${b.y - pad}" width="${W}" height="${H}" fill="#ffffff"/>${new XMLSerializer().serializeToString(clone)}</svg>`;
  return { s, W, H };
}

export function svgToPng(r: { s: string; W: number; H: number }, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = r.W * scale; c.height = r.H * scale;
        const x = c.getContext('2d')!;
        x.scale(scale, scale); x.drawImage(img, 0, 0);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error('Could not render SVG'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.s);
  });
}
