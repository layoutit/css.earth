import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Dot centres are rounded to this fraction of a pixel: an eighth is below what shows, and few enough places that every
 * coordinate's text is looked up (TABLE_REACH). They are written in pixels, and no group scales them. Until 2026-10-04
 * they were whole eighths under a group scaled by 1/8, and Chrome on a GPU drew those dots eight times as wide while a
 * turn warped the layer (point-layer.ts): under a transform with perspective it sizes a round cap as if no group scaled
 * the path down. A bare dot layer photographed under 24 turns of up to 4 degrees (Chrome 154, Metal) held 65 to 69 times
 * its light at rest under 17 of them at 390 by 604 and 3x, and under 21 at 1,440 by 900 and 2x; written in pixels it
 * held 1.03 to 1.31 times under all 24, which is the warp's own stretch and resampling. The pixels are longer text: a
 * dot is 18 characters where it was 13, and setting 10,000 dots' text took 0.80 ms a frame where it took 0.63 (Chrome)
 * and 1.5 to 1.7 where it took 1.3 to 1.4 (WebKit on the same Mac). */
const SUBPIXELS = 8;
/** A dot is a round-capped line this long, in pixels: far below what shows, and not zero. WebKit paints a zero-length
 * subpath's cap itself and then strokes the path, so a translucent dot was painted twice: a dot at alpha 0.6 read 214 of
 * 255 in Safari where Chromium read 153, and overlapping dots of one path added up. Any length above zero strokes once,
 * in both, and without WebKit's extra fill per dot: on the iPad the nearby universe's compositing went from 3.2 to 1.5 ms
 * a frame and the Milky Way's from 4.1 to 2.8 to 3.4 (2026-10-03). */
const DOT = 'h.01';
/** A whole number of eighths as pixels, without the zero before a fraction: `-.125`, `12.5`. */
const pixels = (eighths: number) => String(eighths / SUBPIXELS).replace(/^(-?)0\./, '$1.');
/** Every dot's text is two pieces looked up instead of formatted: `M<x> ` and `<y>h.01` for each eighth of a pixel up to
 * this far from the view's centre (2,048 px, past the view and its turn margin on screens up to about 2,900 CSS px wide);
 * farther, the text is formatted. Joining two looked-up strings built 20,000 dots' text in 0.55 ms where formatting took
 * 1.49 ms (Node 24, 2026-09-30), with the same text. The tables are built once, on first use (65,538 strings, 652,600 characters). */
const TABLE_REACH = 2048 * SUBPIXELS;
let moveText: readonly string[] | null = null, lineText: readonly string[] | null = null;
const moveTable = () => moveText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `M${pixels(index - TABLE_REACH)} `);
const lineTable = () => lineText ??= Array.from({ length: 2 * TABLE_REACH + 1 }, (_, index) => `${pixels(index - TABLE_REACH)}${DOT}`);

/** A fixed palette of retained paths. Each projected point remains a circular
 * disc; no per-point elements or native drop-shadow commands are needed. A dot is a near-zero-length line with round caps,
 * `M x y h.01` (DOT), stroked as wide as the dot: a fifth of the text of two arcs, and no curve to rasterise. Each part of a
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
      const entry = entries[index]!, width = radius * 2;
      if (entry.width && entry.width !== width) throw new TypeError(`Point color ${color} is drawn ${entry.width} px wide; a dot of it asks for ${width} px.`);
      if (!entry.width) { entry.width = width; entry.path.setAttribute('stroke-width', String(width)); }
      return index;
    },
    begin(viewport: WorldCameraViewport) {
      const next = `translate(${(viewport.widthPixels ?? 0) / 2} ${(viewport.heightPixels ?? 0) / 2})`;
      if (origin !== next) { group.setAttribute('transform', next); origin = next; }
      for (const entry of paths.values()) entry.text = '';
      move = moveTable(); line = lineTable();
    },
    /** A dot of the path `entry` returned, at x, y pixels from the view's centre. */
    add(index: number, x: number, y: number) {
      const ix = Math.round(x * SUBPIXELS), iy = Math.round(y * SUBPIXELS);
      entries[index]!.text += ix >= -TABLE_REACH && ix <= TABLE_REACH && iy >= -TABLE_REACH && iy <= TABLE_REACH
        ? move[ix + TABLE_REACH]! + line[iy + TABLE_REACH]! : `M${pixels(ix)} ${pixels(iy)}${DOT}`;
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.text;
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
      }
    },
  };
}
