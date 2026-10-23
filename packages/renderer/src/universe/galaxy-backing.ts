import { preparedVolumeCameraTransform } from '../volume/prepared-volume-runtime.js';
import { worldRotationCss } from '@cssearth/engine';
import { type PreparedGalaxyBacking } from '@cssearth/objects';
import type { VolumeCameraPublication } from '../volume/types.js';
import { writeStyle } from '../rendering/dom/retained-write.js';

/**
 * A galaxy's face-on backing image, fixed in its frame under the catalogue dots. The plane never changes: camera motion
 * turns one scene transform, so it costs the compositor, not a repaint.
 *
 * The plane is an `img`, which the browser composites as it is: the image is the layer. A box with a background image
 * is a layer the browser paints the image into, and Safari painted each plane's 2048-pixel image again on every frame
 * while the camera was inside the galaxy's disc and anything else on the page changed (one moving dataset billboard
 * was enough). Zooming out of Earth on the iPad, the three section planes took 26 ms of compositing a frame for about
 * 63 frames, from 0.05 pc to 250 pc; a native profile of that zoom has the browser's GPU process 1,579 ms inside
 * CoreGraphics image drawing with boxes, 1,500 of them in that stretch, and 86 ms with `img`, never more than 13 ms in
 * a half second. Interleaved runs of that zoom had 70 and 69 frames over 20 ms as background images and 16 and 8 as
 * `img` (2026-10-03). The two forms draw the same pixels in WebKit at three cameras; in Chromium they differ by one
 * level close up and in thin lines where the plane is drawn small.
 */
export function mountGalaxyBacking({ host, before, payload, resolveResource, unitScale, nativeFocalCss, atlasColumns = 1, coasting }: {
  host: HTMLElement; before: Node | null; payload: PreparedGalaxyBacking; resolveResource(path: string): string;
  unitScale?: number; nativeFocalCss?: string; atlasColumns?: number; coasting?: () => boolean;
}) {
  const document = host.ownerDocument, { style } = payload.leaf;
  // An img fills its box from its corner: the prepared leaf must ask for exactly that.
  if (style.backgroundSize !== `${style.width} ${style.height}` || style.backgroundPosition !== '0px 0px') {
    throw new TypeError(`${payload.id}: the backing leaf ${payload.leaf.texturePath} is drawn as an image filling its box; its backgroundSize must be "${style.width} ${style.height}" (got "${style.backgroundSize}") and its backgroundPosition "0px 0px" (got "${style.backgroundPosition}").`);
  }
  const root = document.createElement('div'), camera = document.createElement('div');
  const scene = document.createElement('div'), mesh = document.createElement('div');
  // An atlas shows one view as its box's background: a sliding image 16 views wide was rastered whole, at 8x, and
  // flickered the far galaxy on every drag in Chromium (2026-10-23).
  const atlas = atlasColumns > 1, node = atlas ? document.createElement('div') : document.createElement('img');
  root.className = 'css-volume-projection'; root.dataset.galaxyBacking = payload.id;
  // The projection's black backdrop would hide what lies behind the plane.
  root.style.background = 'transparent';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.style.willChange = 'transform';
  // What the volume stylesheet gives a leaf (`.css-volume-mesh s`), on the image itself.
  Object.assign(node.style, { display: 'block', position: 'absolute', left: '0', top: '0', transformOrigin: '0 0',
    width: style.width, height: style.height, transform: style.transform });
  const show = (url: string) => {
    if (!atlas) { if (node.getAttribute('src') !== url) (node as HTMLImageElement).src = url; }
    else writeStyle(node, 'backgroundImage', `url("${url.replace(/["\\\n\r]/gu, character => `\\${character}`)}")`);
  };
  if (!atlas) Object.assign(node, { alt: '', draggable: false, decoding: 'async' });
  else Object.assign(node.style, { backgroundRepeat: 'no-repeat', backgroundSize: `${atlasColumns * 100}% 100%`, backgroundPosition: '0% 0%' });
  if (atlas) node.dataset.volumeSidePlane = '';
  // Built, an image is given its source directly; `show` compares against the one it last wrote.
  if (atlas) show(resolveResource(payload.leaf.texturePath)); else (node as HTMLImageElement).src = resolveResource(payload.leaf.texturePath);
  mesh.append(node); scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  let perspective = '', origin = '', transform = '';
  return Object.freeze({ root,
    setPlaneTransform(transform: string) { writeStyle(node, 'transform', transform); },
    /** Which atlas view the box shows; its owner holds the view through a coast. */
    setFrame(index: number) { writeStyle(node, 'backgroundPosition', `${format(index / (atlasColumns - 1) * 100)}% 0%`); },
    setOpacity(opacity: number) { writeStyle(node, 'opacity', String(opacity)); },
    /** Draw another image of the same box on the plane (a volume bank's selected dataset, galaxy-backing.ts `datasets`);
     * returns its url. */
    setTexture(texturePath: string) {
      const url = resolveResource(texturePath);
      show(url);
      return url;
    },
    publish(publication: VolumeCameraPublication) {
    const view = preparedVolumeCameraTransform(publication, payload.frame, unitScale);
    const [x, y] = publication.viewport.principalOffsetPixels;
    // Written on change: this publishes every camera frame (motion-freezes-membership.md).
    const nextPerspective = nativeFocalCss ?? `${format(view.focalPixels)}px`, nextOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    const translation = view.translationCssPixels.map((value, index) => nativeFocalCss && index === 2
      ? `calc(${nativeFocalCss} + ${format(value - view.focalPixels)}px)` : `${format(value)}px`);
    const nextTransform = `translate3d(${translation.join(',')}) ${worldRotationCss(view.rotation)}`;
    if (nextPerspective !== perspective && !coasting?.()) camera.style.perspective = perspective = nextPerspective;
    if (nextOrigin !== origin && !coasting?.()) camera.style.perspectiveOrigin = origin = nextOrigin;
    if (nextTransform !== transform) scene.style.transform = transform = nextTransform;
  }, destroy() { root.remove(); } });
}

function format(value: number): string { return String(Number(value.toFixed(6))); }
