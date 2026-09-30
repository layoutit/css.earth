import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Dot centres are written as whole numbers of this fraction of a pixel, and the paths' group scales them back: an
 * integer is the cheapest number to turn into text, and an eighth of a pixel is still below what shows. */
const SUBPIXELS = 8;

/** A fixed palette of retained paths. Each projected point remains a circular
 * disc; no per-point elements or native drop-shadow commands are needed. A dot is a zero-length line with round caps,
 * `M x y h0`, stroked as wide as the dot: a fifth of the text of two arcs, and no curve to rasterise. */
export function mountPointPaths(host: HTMLElement, palette: readonly string[]) {
  const document = host.ownerDocument;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.position = 'absolute'; svg.style.inset = '0';
  const group = document.createElementNS(SVG_NS, 'g'); svg.append(group);
  const paths = new Map([...new Set(palette)].map(color => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', color); path.setAttribute('stroke-linecap', 'round'); group.append(path);
    const entry = { path, circles: [] as string[], published: '', width: 0 };
    return [color, entry] as const;
  }));
  const entries = [...paths.values()], indexOf = new Map([...paths.keys()].map((color, index) => [color, index]));
  host.append(svg);
  let origin = '';
  return {
    /** The paths' svg: a camera turn can move what it painted as one warp (batched-spatial-points.ts). */
    svg,
    residentElements: paths.size + 2,
    /** A dot colour's path, stroked as wide as its dots: resolved once for each point before any frame, so a frame only
     * adds positions. One path strokes all its dots at one width, so the dots of a colour share their size. */
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
      for (const entry of paths.values()) entry.circles.length = 0;
    },
    /** A dot of the path `entry` returned, at x, y pixels from the view's centre. */
    add(index: number, x: number, y: number) {
      entries[index]!.circles.push(`M${Math.round(x * SUBPIXELS)} ${Math.round(y * SUBPIXELS)}h0`);
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.circles.join('');
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
      }
    },
  };
}
