# Current Reality Tree builder

A frontend-only editor for **Current Reality Trees** (CRT), one of the logical trees of the
Theory of Constraints Thinking Process. There is no backend: every tree is stored in the
browser's `localStorage`.

**Live app:** https://crt-builder-ashy.vercel.app/
**Offline single file:** https://crt-builder-ashy.vercel.app/crt.html (save it and open from disk)

## Features

- Pannable/zoomable canvas. Double-click to add an entity; drag an entity's bottom dot to add a
  cause, its top dot to add an effect (drop on another entity to connect).
- Entity types: UDE, entity, assumption; automatic numbering; root causes detected automatically;
  mark the core problem.
- Logical AND (ellipse) between arrows into the same effect.
- IF … AND … THEN … reading of every connection.
- Categories of Legitimate Reservation per arrow and per entity, with a "Needs attention" list.
- Root-cause overview ranked by UDE reach (70% rule of thumb), with highlight of what a root reaches.
- Undo/redo, bottom-up auto-layout (loops tolerated), box select.
- Export JSON / SVG / PNG, import JSON.
- **Several trees.** The *☰ Trees* panel (key `T`) lists all trees with size and last edit. You
  can search, open, rename, duplicate and delete them (deleting can be undone), and back up every
  tree in one file. Each tree keeps its own viewport and undo history.
  `#tree=<id>` in the URL links to a specific tree, and open tabs stay in sync.

## Storage

Data lives under the localStorage key `crt-builder-v1` with the shape
`{ trees: { [id]: Tree }, currentId }`. This is exactly the format of the original single-file
`crt.html`, so JSON exports from either version import into the other. Storage is per origin:
trees created in a `file://` copy are not visible on the hosted site (and vice versa). Use
*Export all* there and *Import* here to move them.

If the stored data ever can't be parsed, a copy is kept under `crt-builder-v1-unreadable-<timestamp>`
instead of being overwritten.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
```

| Script                 | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run build`        | Type-check and build the site into `dist/`                       |
| `npm run build:single` | Build one self-contained `dist-single/index.html` (works offline) |
| `npm test`             | Unit tests (Vitest + jsdom)                                      |
| `npm run test:e2e`     | Browser tests (Playwright) against the built site; build first   |
| `npm run check`        | Type-check, unit tests and build                                 |
| `npm run build:vercel` | What Vercel runs: site build plus `dist/crt.html` offline copy    |

### Layout

```
src/
  model/        pure logic, no DOM: types, tree ops, analysis, layout, geometry, import/export,
                TreeRepository (all localStorage access)
  app/          UI: App (state, history, SVG rendering, viewport), inspector, library panel,
                pointer/keyboard interaction, SVG/PNG export
  main.ts       wiring
tests/unit      Vitest
tests/e2e       Playwright
```

## Deployment

Vercel, via its GitHub integration. The Vercel project `crt-builder` builds the repository root
using `vercel.json` (install `npm ci`, build `npm run build:vercel`, output `dist/`).
`build:vercel` builds the site and adds the single-file offline build as `dist/crt.html`.
Every push to `main` deploys to production; other branches and pull requests get preview URLs.

`.github/workflows/ci.yml` runs type-check, unit and e2e tests on every push to `main` and every pull request.
