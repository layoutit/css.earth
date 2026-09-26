import { preparedVolumeCameraTransform } from './prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import type { PreparedVolumeMountOptions, VolumeCameraPublication } from './types.js';

/** Fixed prepared image geometry in the volume's physical frame. */
export function mountPreparedVolumePlanes(options: PreparedVolumeMountOptions) {
  const create = options.createElement ?? ((tag: string) => options.host.ownerDocument.createElement(tag));
  const root = create('div'), camera = create('div'), scene = create('div'), mesh = create('div');
  root.className = 'css-volume-projection'; root.dataset.volumePlanes = '';
  root.style.background = 'transparent';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.style.willChange = 'transform';
  const leaves = options.payload.detailPlanes!.map(leaf => {
    const node = create('s');
    node.dataset.volumePlane = leaf.id;
    Object.assign(node.style, { position: 'absolute', left: '0', top: '0', display: 'block', pointerEvents: 'none',
      transformOrigin: '0 0', backfaceVisibility: 'visible', backgroundRepeat: 'no-repeat', textDecoration: 'none', ...leaf.style,
      backgroundImage: `url("${escapeUrl(options.resolveResource(leaf.texturePath))}")` });
    mesh.append(node); return node;
  });
  scene.append(mesh); camera.append(scene); root.append(camera); options.host.insertBefore(root, options.before);
  return { publish(publication: VolumeCameraPublication) {
    const transform = preparedVolumeCameraTransform(publication, options.payload.frame, options.unitScale);
    const translation = transform.translationCssPixels.map((value, axis) => options.nativeFocalCss && axis === 2
      ? `calc(${options.nativeFocalCss} + ${format(value - transform.focalPixels)}px)` : `${format(value)}px`);
    camera.style.perspective = options.nativeFocalCss ?? `${format(transform.focalPixels)}px`;
    const [x, y] = publication.viewport.principalOffsetPixels;
    camera.style.perspectiveOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    scene.style.transform = `translate3d(${translation.join(',')}) ${worldRotationCss(transform.rotation)}`;
  }, setPresentation(payload: PreparedVolumeMountOptions['payload']) {
    payload.detailPlanes!.forEach((leaf, index) => {
      leaves[index]!.style.backgroundSize = leaf.style.backgroundSize ?? '';
      leaves[index]!.style.backgroundPosition = leaf.style.backgroundPosition ?? '';
      leaves[index]!.style.backgroundImage = `url("${escapeUrl(options.resolveResource(leaf.texturePath))}")`;
    });
  }, destroy() { root.remove(); } };
}
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
function format(value: number): string { return String(Number(value.toFixed(6))); }
