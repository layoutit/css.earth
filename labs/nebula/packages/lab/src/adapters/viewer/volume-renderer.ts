/** Canonical cssEarth retained-volume binding shared by the lab's prepared viewers. */
import type { VolumeViewerBackend } from '@cssearth/volume-viewer/scene/backend';
import { mountPreparedCssVolume } from '../../../../../../../src/renderers/css/volume/prepared-volume-runtime';
import { validatePreparedCssVolume } from '../../../../../../../src/renderers/css/volume/validation';
import type { PreparedCssVolume, VolumeCameraPublication } from '../../../../../../../src/renderers/css/volume/types';
import { shapeCloudOrthographicCamera } from './shape-cloud-camera';
export const volumeRenderer: VolumeViewerBackend<PreparedCssVolume, VolumeCameraPublication> = {
  validateBank: validatePreparedCssVolume,
  resources: bank => bank.resources,
  frame: bank => bank.frame,
  texturePaths: bank => (['x', 'y', 'z'] as const).flatMap(axis => bank.stacks.find(stack => stack.axis === axis)!
    .leaves.map(leaf => leaf.texturePath)),
  mount(host, before, payload, resolveResource) {
    const mounted = mountPreparedCssVolume({ host, before, payload, resolveResource });
    const cameras = [...host.querySelectorAll<HTMLElement>('.css-volume-camera')];
    const scenes = [...host.querySelectorAll<HTMLElement>('.css-volume-scene')];
    const materials = mounted.roots.flatMap((axisRoot, index) => {
      const axis = (['x', 'y', 'z'] as const)[index]!, stack = payload.stacks.find(item => item.axis === axis)!;
      const nodes = [...axisRoot.querySelectorAll<HTMLElement>('.css-volume-mesh s')];
      if (nodes.length !== stack.leaves.length * 3) throw new Error('Compiler leaves do not match the prepared material layout.');
      return stack.leaves.map((leaf, leafIndex) => ({ nodes: nodes.slice(leafIndex * 3, leafIndex * 3 + 3), texturePath: leaf.texturePath }));
    });
    return { materials,
      publish(camera) {
        mounted.publish({ world: camera.publication.world, viewport: { focalPixels: camera.publication.viewport.focalPixels,
          principalOffsetPixels: camera.publication.viewport.principalOffsetPixels } });
        for (const node of cameras) node.style.perspective = 'none';
        for (const node of scenes) node.style.transform = camera.transform;
      },
      destroy() { mounted.destroy(); },
    };
  },
  camera: shapeCloudOrthographicCamera,
};
