import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Dot centres are written as whole numbers of this fraction of a pixel, and the paths' group scales them back: an
 * integer is the cheapest number to turn into text, and an eighth of a pixel is still below what shows. */
const SUBPIXELS = 8;
/** Every dot's text is two pieces looked up instead of formatted: `M<x> ` and `<y>h0` for whole eighths of a pixel up to
 * this far from the view's centre (2,048 px, past the view and its turn margin on screens up to about 2,900 CSS px wide);
 * farther, the text is formatted. Joining two looked-up strings built 20,000 dots' text in 0.55 ms where formatting took
 * 1.49 ms (Node 24, 2026-09-30), with the same text. The tables are built once, on first use (about 1.5 MB). */
const TABLE_REACH = 2048 * SUBPIXELS;
let moveText: readonly string[] | null = null, lineText: readonly string[] | null = null;
const moveTable = () => moveText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `M${index - TABLE_REACH} `);
const lineTable = () => lineText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `${index - TABLE_REACH}h0`);

/** The svg every part of a point field paints into: one layer, so the parts of a stacked bank (catalogue-points.ts) cost
 * one raster when they repaint, not one each. */
export function mountPointPathSvg(host: HTMLElement) {
  const svg = host.ownerDocument.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.position = 'absolute'; svg.style.inset = '0';
  host.append(svg);
  return svg;
}

/** A fixed palette of retained paths. Each projected point remains a circular
 * disc; no per-point elements or native drop-shadow commands are needed. A dot is a zero-length line with round caps,
 * `M x y h0`, stroked as wide as the dot: a fifth of the text of two arcs, and no curve to rasterise. A field of several
 * parts gives each its own group in one svg (`into`); the group's opacity dims its part. */
export function mountPointPaths(host: HTMLElement, palette: readonly string[], into?: SVGSVGElement) {
  const document = host.ownerDocument;
  const svg = into ?? mountPointPathSvg(host);
  const part = document.createElementNS(SVG_NS, 'g'), group = document.createElementNS(SVG_NS, 'g');
  part.append(group); svg.append(part);
  // What every dot path shares is said once, on their group: a path carries only its colour, width and dots.
  group.setAttribute('fill', 'none'); group.setAttribute('stroke-linecap', 'round');
  const paths = new Map([...new Set(palette)].map(color => {
    const path = document.createElementNS(SVG_NS, 'path');
    // A paint is `#rrggbbaa@radius` (batched-spatial-points.ts pointPaint): the path strokes its colour.
    path.setAttribute('stroke', color.split('@')[0]!); group.append(path);
    const entry = { path, text: '', published: '', width: 0 };
    return [color, entry] as const;
  }));
  const entries = [...paths.values()], indexOf = new Map([...paths.keys()].map((color, index) => [color, index]));
  let origin = '', move: readonly string[] = [], line: readonly string[] = [];
  return {
    /** The paths' svg: a camera turn can move what it painted as one warp (batched-spatial-points.ts). */
    svg,
    /** This palette's group: its opacity dims these paths alone. */
    part,
    residentElements: paths.size + (into ? 2 : 3),
    /** A dot colour's path, stroked as wide as its dots: resolved once for each point before any frame, so a frame only
     * adds positions. One path strokes all its dots at one width, so a paint (a colour at a radius) is one size. */
    entry(color: string, radius: number) {
      const index = indexOf.get(color);
      if (index === undefined) throw new TypeError(`Point colour ${color} is absent from the prepared paint palette.`);
      const entry = entries[index]!, width = radius * 2 * SUBPIXELS;
      if (entry.width && entry.width !== width) throw new TypeError(`Point colour ${color} is drawn ${entry.width / SUBPIXELS} px wide; a dot of it asks for ${width / SUBPIXELS} px.`);
      if (!entry.width) { entry.width = width; entry.path.setAttribute('stroke-width', String(width)); }
      return index;
    },
    begin(viewport: WorldCameraViewport) {
      const next = `translate(${(viewport.widthPixels ?? 0) / 2} ${(viewport.heightPixels ?? 0) / 2}) scale(${1 / SUBPIXELS})`;
      if (origin !== next) { group.setAttribute('transform', next); origin = next; }
      for (const entry of paths.values()) entry.text = '';
      move = moveTable(); line = lineTable();
    },
    /** A dot of the path `entry` returned, at x, y pixels from the view's centre. */
    add(index: number, x: number, y: number) {
      const ix = Math.round(x * SUBPIXELS), iy = Math.round(y * SUBPIXELS);
      entries[index]!.text += ix >= -TABLE_REACH && ix <= TABLE_REACH && iy >= -TABLE_REACH && iy <= TABLE_REACH
        ? move[ix + TABLE_REACH]! + line[iy + TABLE_REACH]! : `M${ix} ${iy}h0`;
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.text;
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
      }
    },
  };
}
