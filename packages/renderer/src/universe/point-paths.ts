import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
    const entry = { path, circles: [] as string[], published: '', width: 0, publishedWidth: 0 };
    return [color, entry] as const;
  }));
  host.append(svg);
  let origin = '';
  return {
    /** The paths' svg: a camera turn can move what it painted as one warp (batched-spatial-points.ts). */
    svg,
    residentElements: paths.size + 2,
    begin(viewport: WorldCameraViewport) {
      const next = `translate(${(viewport.widthPixels ?? 0) / 2} ${(viewport.heightPixels ?? 0) / 2})`;
      if (origin !== next) { group.setAttribute('transform', next); origin = next; }
      for (const entry of paths.values()) entry.circles.length = 0;
    },
    point(x: number, y: number, radius: number, color: string) {
      const entry = paths.get(color);
      if (!entry) throw new TypeError(`Point colour ${color} is absent from the prepared paint palette.`);
      // One path strokes all its dots at one width: the dots of a colour share their size.
      const width = Number((radius * 2).toFixed(3));
      if (entry.circles.length && entry.width !== width) throw new TypeError(`Point colour ${color} is drawn ${entry.width} px wide; a dot of it asks for ${width} px.`);
      entry.width = width;
      entry.circles.push(`M${x.toFixed(3)} ${y.toFixed(3)}h0`);
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.circles.join('');
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
        if (entry.circles.length && entry.publishedWidth !== entry.width) { entry.path.setAttribute('stroke-width', String(entry.width)); entry.publishedWidth = entry.width; }
      }
    },
  };
}
