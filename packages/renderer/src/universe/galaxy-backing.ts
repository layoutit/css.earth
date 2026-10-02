import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '../navigation/world-camera-math.js';
import { type PreparedGalaxyBacking } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';

/**
 * A galaxy's face-on backing image, fixed in its frame under the catalogue dots. The plane never changes: camera motion
 * turns one scene transform, so it costs the compositor, not a repaint.
 */
export function mountGalaxyBacking({ host, before, payload, resolveResource }: {
  host: HTMLElement; before: Node | null; payload: PreparedGalaxyBacking; resolveResource(path: string): string;
}) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div');
  const scene = document.createElement('div'), mesh = document.createElement('div'), node = document.createElement('s');
  root.className = 'css-volume-projection'; root.dataset.galaxyBacking = payload.id;
  // The projection's black backdrop would hide what lies behind the plane.
  root.style.background = 'transparent';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.style.willChange = 'transform';
  Object.assign(node.style, { ...payload.leaf.style, textDecoration: 'none',
    backgroundImage: `url("${resolveResource(payload.leaf.texturePath).replace(/["\\\n\r]/gu, character => `\\${character}`)}")` });
  mesh.append(node); scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  let perspective = '', origin = '', transform = '';
  return Object.freeze({ root, publish(publication: VolumeCameraPublication) {
    const view = preparedVolumeCameraTransform(publication, payload.frame);
    const [x, y] = publication.viewport.principalOffsetPixels;
    // Written on change: this publishes every camera frame (motion-freezes-membership.md).
    const nextPerspective = `${format(view.focalPixels)}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const nextTransform = `translate3d(${view.translationCssPixels.map(value => `${format(value)}px`).join(',')}) ${worldRotationCss(view.rotation)}`;
    if (nextPerspective !== perspective) camera.style.perspective = perspective = nextPerspective;
    if (nextOrigin !== origin) camera.style.perspectiveOrigin = origin = nextOrigin;
    if (nextTransform !== transform) scene.style.transform = transform = nextTransform;
  }, destroy() { root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
