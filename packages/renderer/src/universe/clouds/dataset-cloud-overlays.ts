import type { VolumeCameraPublication } from '../../volume/types.js';
import { mountCloudOverlay } from './cloud-points.js';

/** The existing cloud renderer, selected with a volume bank's actual displayed dataset. Retired clouds retain their
 * coast signal until it stops, so dataset changes never remove resident DOM during inertia. This owns no rendering. */
export function createDatasetCloudOverlays({ host, before, urls, resolveResource }: {
  host: HTMLElement; before: Node; urls: Readonly<Record<string, readonly string[]>>; resolveResource(path: string): string;
}) {
  let selected: string | null = null, coasting = false;
  let layers: ReturnType<typeof mountCloudOverlay>[] = [], retiring: ReturnType<typeof mountCloudOverlay>[] = [];
  return {
    publish(dataset: string, publication: VolumeCameraPublication, opacity: number) {
      if (dataset !== selected) {
        for (const layer of layers) { layer.retire(); if (coasting) retiring.push(layer); }
        selected = dataset;
        layers = (Object.hasOwn(urls, dataset) ? urls[dataset]! : []).map(url => {
          const layer = mountCloudOverlay({ host, before, url, resolveResource });
          layer.setCoasting(coasting);
          return layer;
        });
      }
      for (const layer of layers) layer.publish(publication, opacity);
    },
    setCoasting(active: boolean) {
      coasting = active;
      for (const layer of [...layers, ...retiring]) layer.setCoasting(active);
      if (!active) retiring = [];
    },
    destroy() {
      for (const layer of [...layers, ...retiring]) layer.destroy();
      layers = []; retiring = []; selected = null;
    },
  };
}
