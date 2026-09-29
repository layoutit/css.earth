import type { WorldCameraViewport } from '../navigation/world-camera.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A fixed palette of retained paths. Each projected point remains a circular
 * disc; no per-point elements or native drop-shadow commands are needed. */
export function mountPointPaths(host: HTMLElement, palette: readonly string[]) {
  const document = host.ownerDocument;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.style.position = 'absolute'; svg.style.inset = '0';
  const group = document.createElementNS(SVG_NS, 'g'); svg.append(group);
  const paths = new Map([...new Set(palette)].map(color => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', color); group.append(path);
    const entry = { path, circles: [] as string[], published: '' };
    return [color, entry] as const;
  }));
  host.append(svg);
  let origin = '';
  return {
    residentElements: paths.size + 2,
    begin(viewport: WorldCameraViewport) {
      const next = `translate(${(viewport.widthPixels ?? 0) / 2} ${(viewport.heightPixels ?? 0) / 2})`;
      if (origin !== next) { group.setAttribute('transform', next); origin = next; }
      for (const entry of paths.values()) entry.circles.length = 0;
    },
    point(x: number, y: number, radius: number, color: string) {
      const entry = paths.get(color);
      if (!entry) throw new TypeError(`Point colour ${color} is absent from the prepared paint palette.`);
      const r = radius.toFixed(3), diameter = (radius * 2).toFixed(3);
      entry.circles.push(`M${(x-radius).toFixed(3)} ${y.toFixed(3)}a${r} ${r} 0 1 0 ${diameter} 0a${r} ${r} 0 1 0 -${diameter} 0Z`);
    },
    commit() {
      for (const entry of paths.values()) {
        const next = entry.circles.join('');
        if (entry.published !== next) { entry.path.setAttribute('d', next); entry.published = next; }
      }
    },
  };
}
