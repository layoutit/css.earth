import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Dot centres are written as whole numbers of this fraction of a pixel, and the paths' group scales them back: an
 * integer is the cheapest number to turn into text, and an eighth of a pixel is still below what shows. */
const SUBPIXELS = 8;
/** A dot is a round-capped line this long, in eighths of a pixel: 0.0125 px, far below what shows, and not zero. WebKit
 * paints a zero-length subpath's cap itself and then strokes the path, so a translucent dot was painted twice: a dot at
 * alpha 0.6 read 214 of 255 in Safari where Chromium read 153, and overlapping dots of one path added up. Any length
 * above zero strokes once, in both, and without WebKit's extra fill per dot: on the iPad the nearby universe's
 * compositing went from 3.2 to 1.5 ms a frame and the Milky Way's from 4.1 to 2.8 to 3.4 (2026-10-03). */
const DOT = 'h.1';
/** Every dot's text is two pieces looked up instead of formatted: `M<x> ` and `<y>h.1` for whole eighths of a pixel up to
 * this far from the view's centre (2,048 px, past the view and its turn margin on screens up to about 2,900 CSS px wide);
 * farther, the text is formatted. Joining two looked-up strings built 20,000 dots' text in 0.55 ms where formatting took
 * 1.49 ms (Node 24, 2026-09-30), with the same text. The tables are built once, on first use (about 1.5 MB). */
const TABLE_REACH = 2048 * SUBPIXELS;
let moveText: readonly string[] | null = null, lineText: readonly string[] | null = null;
const moveTable = () => moveText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `M${index - TABLE_REACH} `);
const lineTable = () => lineText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `${index - TABLE_REACH}${DOT}`);

/** A fixed palette of retained paths. Each projected point remains a circular
 * disc; no per-point elements or native drop-shadow commands are needed. A dot is a near-zero-length line with round caps,
 * `M x y h.1` (DOT), stroked as wide as the dot: a fifth of the text of two arcs, and no curve to rasterise. Each part of a
 * field is its own group in the field's group of a dot layer's svg (point-layer.ts); the group's opacity dims its part. */
export function mountPointPaths(host: SVGElement, palette: readonly string[]) {
  const document = host.ownerDocument;
  const part = document.createElementNS(SVG_NS, 'g'), group = document.createElementNS(SVG_NS, 'g');
  part.append(group); host.append(part);
  const paths = new Map([...new Set(palette)].map(color => {
    const path = document.createElementNS(SVG_NS, 'path');
    // A paint is `#rrggbbaa@radius` (batched-spatial-points.ts pointPaint): the path strokes its color.
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color.split('@')[0]!); path.setAttribute('stroke-linecap', 'round'); group.append(path);
    const entry = { path, text: '', published: '', width: 0 };
    return [color, entry] as const;
  }));
  const entries = [...paths.values()], indexOf = new Map([...paths.keys()].map((color, index) => [color, index]));
  let origin = '', move: readonly string[] = [], line: readonly string[] = [];
  return {
    /** This palette's group: its opacity dims these paths alone. */
    part,
    residentElements: paths.size + 2,
    /** A dot color's path, stroked as wide as its dots: resolved once for each point before any frame, so a frame only
     * adds positions. One path strokes all its dots at one width, so a paint (a color at a radius) is one size. */
    entry(color: string, radius: number) {
      const index = indexOf.get(color);
      if (index === undefined) throw new TypeError(`Point color ${color} is absent from the prepared paint palette.`);
      const entry = entries[index]!, width = radius * 2 * SUBPIXELS;
      if (entry.width && entry.width !== width) throw new TypeError(`Point color ${color} is drawn ${entry.width / SUBPIXELS} px wide; a dot of it asks for ${width / SUBPIXELS} px.`);
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
        ? move[ix + TABLE_REACH]! + line[iy + TABLE_REACH]! : `M${ix} ${iy}${DOT}`;
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.text;
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
      }
    },
  };
}
