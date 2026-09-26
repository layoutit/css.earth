/** cssEarth image-bank/volume binding for retained contribution inspection. */
import type { InspectionMountBackend } from '@cssearth/volume-viewer/scene/inspection-banks';
import { mountPreparedCssImageLayers } from '@cssearth/renderer/image-layers/prepared-image-layer-runtime.ts';
import type { PreparedCssImageLayers } from '@cssearth/renderer/image-layers/loader.ts';
import { mountPreparedCssVolume } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import type { PreparedCssVolume, VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
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
      let materialIndex = 0;
      const banks = payload.stacks.map((stack, index) => {
        const nodes = [...roots[index]!.querySelectorAll<HTMLElement>('.css-volume-mesh s')], copies = isImage ? 1 : 3;
        return { axis: stack.axis, root: roots[index]!, leaves: stack.leaves.map((leaf, leafIndex) => ({
          setTexture: 'setTexture' in instance ? ((index: number) => (url: string) => instance.setTexture(index, url))(materialIndex++) : undefined,
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
