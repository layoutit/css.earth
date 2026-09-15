/** cssEarth image-bank/volume binding for retained contribution inspection. */
import type { InspectionMountBackend } from '@cssearth/volume-viewer/scene/inspection-banks';
import { mountPreparedCssImageLayers } from '../../../../../../../src/renderers/css/image-layers/prepared-image-layer-runtime';
import type { PreparedCssImageLayers } from '../../../../../../../src/renderers/css/image-layers/loader';
import { mountPreparedCssVolume } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
function imageBank(payload: PreparedCssVolume | PreparedCssImageLayers): PreparedCssImageLayers {
  if (!('bankViews' in payload) || !Array.isArray(payload.bankViews)) throw new TypeError('Missing prepared image-bank views.');
  return payload;
}
export function inspectionRenderer(isImage: boolean): InspectionMountBackend<PreparedCssVolume | PreparedCssImageLayers, VolumeCameraPublication> {
  return {
    leaves: payload => payload.stacks.flatMap(stack => stack.leaves),
    mount(host, before, payload, resolveResource, overlays) {
      const options = { host, before, payload, resolveResource };
      const instance = isImage ? mountPreparedCssImageLayers({ ...options, payload: imageBank(payload) }) : mountPreparedCssVolume(options);
      const roots = 'root' in instance ? [...instance.root.querySelectorAll<HTMLElement>('[data-image-layer-axis]')] : instance.roots;
      const banks = payload.stacks.map((stack, index) => {
        const nodes = [...roots[index]!.querySelectorAll<HTMLElement>('.css-volume-mesh s')], copies = isImage ? 1 : 3;
        return { axis: stack.axis, root: roots[index]!, leaves: stack.leaves.map((leaf, leafIndex) => ({
          id: leaf.id, nodes: nodes.slice(leafIndex * copies, (leafIndex + 1) * copies), detail: leaf.id.endsWith('detail'),
        })) };
      });
      const overlayMeshes = overlays ? roots.map(root => {
        const scene = root.querySelector<HTMLElement>('.css-volume-scene');
        if (!scene) throw new TypeError('Prepared density scene is missing its retained scene node.');
        const mesh = host.ownerDocument.createElement('div'); mesh.className = 'css-volume-mesh'; mesh.dataset.overlayMesh = 'true'; scene.append(mesh); return mesh;
      }) : [];
      return { banks, overlayMeshes, publish: publication => instance.publish(publication), destroy: () => instance.destroy() };
    },
  };
}
