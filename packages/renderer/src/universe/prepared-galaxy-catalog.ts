import { isPreparedCluster, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { projectCatalogPosition } from './galaxy-catalog-layout.js';

interface Dot { readonly object: PreparedCatalogObject; readonly element: HTMLElement; transform: string }

/** The spatial catalogues as the universe draws them: one unobtrusive dot for each sampled Local Group galaxy that has no
 * package of its own. A catalogue is data: its rows are never named, marked, picked or selected here. A galaxy, cluster or
 * nebula with a package is a body of the world context (prepared-world-context.ts), drawn and named like any other. */
export function mountPreparedGalaxyCatalog({ host, before, payload, clusters, galaxySample, nebulae }: {
  host: HTMLElement; before: Element; payload: unknown; clusters?: unknown; nebulae?: unknown; galaxySample?: unknown;
}) {
  const catalog = parsePreparedGalaxyCatalog(payload), document = host.ownerDocument;
  const clusterCatalog = clusters === undefined ? null : parsePreparedClusterCatalog(clusters);
  const nebulaCatalog = nebulae === undefined ? null : parsePreparedNebulaCatalog(nebulae);
  for (const other of [clusterCatalog, nebulaCatalog]) if (other && (other.frame.referenceFrame !== catalog.frame.referenceFrame || other.frame.epochJdTt !== catalog.frame.epochJdTt)) throw new TypeError('Prepared catalogues must share one frame and epoch.');
  let sampleIds: Set<string> | undefined;
  if (galaxySample !== undefined) {
    if (!galaxySample || typeof galaxySample !== 'object' || !('schema' in galaxySample) || galaxySample.schema !== 'cssearth-galaxy-display-sample@1' ||
        !('ids' in galaxySample) || !Array.isArray(galaxySample.ids) || galaxySample.ids.length > 48 ||
        !galaxySample.ids.every(id => typeof id === 'string' && catalog.objects.some(row => row.id === id && row.membership.group === 'local-group'))) throw new TypeError('Invalid baked galaxy sample.');
    sampleIds = new Set(galaxySample.ids);
  }
  const root = document.createElement('div');
  root.className = 'prepared-galaxy-catalog';
  // Zero-size root at the stage centre, children placed from it (world-context.css).
  host.insertBefore(root, before);
  const fader = createOpacityFader(document.defaultView!, undefined, { hideAtZero: true });
  // Membership is a prepared scientific fact, never a runtime distance cut. A row with a package is drawn by the world context.
  const dots: Dot[] = catalog.objects.filter(object => object.name && !object.detailedObjectId && object.membership.group === 'local-group' && (!sampleIds || sampleIds.has(object.id))).map(object => {
    const element = document.createElement('span');
    element.dataset.galaxyDot = object.id;
    element.style.cssText = 'opacity:0;visibility:hidden';
    root.append(element);
    return { object, element, transform: '' };
  });
  let destroyed = false, dormant = false;
  return Object.freeze({ root, catalog,
    /** The catalogue row `id` names, as data for whoever presents it. */
    resolve(id: string) { return [...catalog.objects, ...clusterCatalog?.objects ?? [], ...nebulaCatalog?.objects ?? []].find(object => object.id === id || (!isPreparedCluster(object) && object.detailedObjectId === id)) ?? null; },
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
        const point = width > 0 && height > 0 ? projectCatalogPosition(dot.object.positionM, world, viewport) : null;
        const visible = point !== null && Math.abs(point.x) <= width / 2 + 4 && Math.abs(point.y) <= height / 2 + 4;
        if (visible) {
          // Never read back from the style (a read serialises it).
          const transform = `translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
          if (transform !== dot.transform) { dot.element.style.transform = transform; dot.transform = transform; }
        }
        fader.set(dot.element, visible ? alpha : 0, 200);
      }
      root.dataset.catalogueCount = String(dots.length);
    },
    inspect() { return { count: dots.length, clusterCount: clusterCatalog?.objects.length ?? 0 }; },
    destroy() {
      if (destroyed) return; destroyed = true; fader.destroy();
      root.remove();
    },
  });
}
