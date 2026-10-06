import { catalogueDots, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog, type PreparedCatalogueDots } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { projectCatalogPosition } from './galaxy-catalog-layout.js';

interface Dot { readonly positionM: readonly number[]; readonly element: HTMLElement; transform: string }

/** The dots as the data worker hands them over (catalogue-dots-reader.ts), not a catalogue in its JSON form. */
const isDots = (value: unknown): value is PreparedCatalogueDots => typeof value === 'object' && value !== null && (value as { positionsM?: unknown }).positionsM instanceof Float64Array;

/** The spatial catalogues as the universe draws them: one unobtrusive dot for each sampled Local Group galaxy that has no
 * package of its own. A catalogue is data: its rows are never named, marked, picked or selected here. A galaxy, cluster or
 * nebula with a package is a body of the world context (prepared-world-context.ts), drawn and named like any other. */
export function mountPreparedGalaxyCatalog({ host, before, payload, clusters, galaxySample, nebulae }: {
  host: HTMLElement; before: Element; payload: unknown; clusters?: unknown; nebulae?: unknown; galaxySample?: unknown;
}) {
  const document = host.ownerDocument;
  // The page receives the dots alone (@cssearth/objects catalogue-dots.ts). A caller that holds the catalogues whole (a
  // test, a tool) passes them, and the same dots are read from them here.
  const read = (): PreparedCatalogueDots => {
    if (isDots(payload)) return payload;
    const catalog = parsePreparedGalaxyCatalog(payload);
    const clusterCatalog = clusters === undefined ? null : parsePreparedClusterCatalog(clusters);
    const nebulaCatalog = nebulae === undefined ? null : parsePreparedNebulaCatalog(nebulae);
    for (const other of [clusterCatalog, nebulaCatalog]) if (other && (other.frame.referenceFrame !== catalog.frame.referenceFrame || other.frame.epochJdTt !== catalog.frame.epochJdTt)) throw new TypeError('Prepared catalogues must share a reference frame and epoch.');
    return catalogueDots(catalog, galaxySample, clusterCatalog?.objects.length ?? 0);
  };
  const catalog = read();
  const root = document.createElement('div');
  root.className = 'prepared-galaxy-catalog';
  // Zero-size root at the stage centre, children placed from it (world-context.css).
  host.insertBefore(root, before);
  const fader = createOpacityFader(document.defaultView!, undefined, { hideAtZero: true });
  // Membership is a prepared scientific fact, never a runtime distance cut. A row with a package is drawn by the world context.
  const dots: Dot[] = catalog.ids.map((id, index) => {
    const element = document.createElement('span');
    element.dataset.galaxyDot = id;
    element.style.cssText = 'opacity:0;visibility:hidden';
    root.append(element);
    return { positionM: [catalog.positionsM[index * 3]!, catalog.positionsM[index * 3 + 1]!, catalog.positionsM[index * 3 + 2]!], element, transform: '' };
  });
  root.dataset.catalogueCount = String(dots.length);
  let destroyed = false, dormant = false;
  return Object.freeze({ root, catalog,
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number) {
      if (destroyed) return;
      if (world.referenceFrame !== catalog.frame.referenceFrame || world.epochJdTt !== catalog.frame.epochJdTt) {
        throw new TypeError('Galaxy catalogue and observer must share a reference frame and epoch.');
      }
      const alpha = Math.max(0, Math.min(1, opacity)) * .4;
      // The dots sleep with their fade.
      if (alpha === 0) { if (dormant) return; dormant = true; } else dormant = false;
      const width = viewport.widthPixels ?? host.clientWidth, height = viewport.heightPixels ?? host.clientHeight;
      for (const dot of dots) {
        const point = width > 0 && height > 0 ? projectCatalogPosition(dot.positionM, world, viewport) : null;
        const visible = point !== null && Math.abs(point.x) <= width / 2 + 4 && Math.abs(point.y) <= height / 2 + 4;
        if (visible) {
          // Never read back from the style (a read serialises it). Hundredths of a pixel: a finer text is a write the
          // page serialises to the same value.
          const transform = `translate(${Math.round(point.x * 100) / 100}px,${Math.round(point.y * 100) / 100}px) translate(-50%,-50%)`;
          if (transform !== dot.transform) { dot.element.style.transform = transform; dot.transform = transform; }
        }
        fader.set(dot.element, visible ? alpha : 0, 200);
      }
    },
    /** While the camera coasts a dot that fades out keeps its box; it is hidden once the coast stops
     * (docs/performance/motion-freezes-membership.md). */
    setCoasting(active: boolean) { fader.holdHiding(active); },
    inspect() { return { count: dots.length, clusterCount: catalog.clusterCount }; },
    destroy() {
      if (destroyed) return; destroyed = true; fader.destroy();
      root.remove();
    },
  });
}
