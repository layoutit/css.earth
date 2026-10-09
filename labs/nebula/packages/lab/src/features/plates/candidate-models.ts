/** Lab-only published 3D models of a plate object (ignored scratch, `src/objects/<owner>/.local/candidates/models/`),
 * mounted in the shared viewer beside the bank: point clouds as points, meshes as flat-shaded triangles, and the
 * forward-shock sphere as three dashed circles. Every place arrives in arcseconds from the expansion centre (east,
 * north, toward the Sun) at the object's distance, and is laid in the mounted bank's own frame. Nothing here ships. */
import type { DensityVolumeFrame } from '@cssearth/objects';
import { preparedVolumeCameraTransform } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';
import { worldRotationCss } from '@cssearth/engine';

/** A prepared model as `prepare-candidate-models.mts` writes it. Places are arcseconds: east, north, toward the Sun. */
export interface CandidateModel {
  id: string; label: string; kind: 'measured' | 'simulation' | 'illustration'; color: string; credit: string; citation: string; placement: string;
  points?: number[]; vertices?: number[]; faces?: number[];
}
export interface CandidateModelSummary { id: string; label: string; kind: CandidateModel['kind']; color: string; credit: string; citation: string; placement: string; outerRing: boolean; jets: boolean;
  verdict?: { kind: 'per paper' | 'verified by fit' | 'ambiguous'; text: string } }
/** The picture a model is textured from: projected along Earth's line of sight (`textures.py`), or flat color. */
export type CandidateTexture = 'nircam' | 'miri' | 'chandra' | 'none';
/** One chosen model (or all, as a debug view) replaces the bank; none shows the bank. */
export interface CandidateModelState { ids: string[]; shock: boolean; texture: CandidateTexture | 'auto' }
/** The X-ray surfaces take Chandra under Auto; the rest take the bank's Webb NIRCam picture. */
const XRAY = new Set(['delaney-fe', 'delaney-hetg', 'mf-iron', 'orlando-2021-c']);
export const autoTexture = (id: string): CandidateTexture => XRAY.has(id) ? 'chandra' : 'nircam';
interface Texture { cell?: number; columns?: number; width?: number; height?: number; atlasUrl?: string; colors?: string[] }

const ARCSEC = Math.PI / 648000, CSS_PER_UNIT = 50, TRIANGLE_PX = 16;

/** The frame's local vector of a displacement given in arcseconds east, north and toward the Sun. */
export function arcsecToLocal(frame: Pick<DensityVolumeFrame, 'originM' | 'localToReferenceXyzw' | 'metersPerUnit'>) {
  const [ox, oy, oz] = frame.originM as [number, number, number], distance = Math.hypot(ox, oy, oz);
  const u = [ox / distance, oy / distance, oz / distance], ra = Math.atan2(u[1]!, u[0]!), dec = Math.asin(u[2]!);
  const east = [-Math.sin(ra), Math.cos(ra), 0], north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const metres = distance * ARCSEC, [qx, qy, qz, qw] = frame.localToReferenceXyzw as [number, number, number, number];
  // The frame's quaternion turns local into reference; its conjugate turns back.
  const toLocal = (d: number[]) => {
    const x = -qx, y = -qy, z = -qz;
    const ix = qw * d[0]! + y * d[2]! - z * d[1]!, iy = qw * d[1]! + z * d[0]! - x * d[2]!, iz = qw * d[2]! + x * d[1]! - y * d[0]!, iw = -x * d[0]! - y * d[1]! - z * d[2]!;
    return [ix * qw - iw * x - iy * z + iz * y, iy * qw - iw * y - iz * x + ix * z, iz * qw - iw * z - ix * y + iy * x].map(value => value * metres / frame.metersPerUnit);
  };
  const e = toLocal(east), n = toLocal(north), t = toLocal(u.map(value => -value));
  return (east: number, north: number, toward: number): [number, number, number] =>
    [0, 1, 2].map(axis => east * e[axis]! + north * n[axis]! + toward * t[axis]!) as [number, number, number];
}

/** PolyCSS stores local vectors in [y,x,z] order at 50 CSS pixels a unit (`prepareOverlayGeometry`). */
const css = (local: readonly number[]) => [local[1]! * CSS_PER_UNIT, local[0]! * CSS_PER_UNIT, local[2]! * CSS_PER_UNIT];

function shade(hex: string, factor: number) {
  const value = Number.parseInt(hex.slice(1), 16), channel = (shift: number) => Math.round(Math.min(255, ((value >> shift) & 255) * factor));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

/** One mounted layer of a model: its own projection root, following the shared camera like the original plane. */
function mountLayer(host: HTMLElement, before: Node, frame: DensityVolumeFrame, id: string) {
  const document = host.ownerDocument;
  const root = document.createElement('div'), camera = document.createElement('div'), scene = document.createElement('div'), mesh = document.createElement('div');
  root.className = 'css-volume-projection candidate-model-projection'; root.dataset.candidateModel = id;
  root.style.background = 'transparent'; root.style.pointerEvents = 'none';
  camera.className = 'css-volume-camera'; scene.className = 'css-volume-scene'; mesh.className = 'css-volume-mesh';
  scene.append(mesh); camera.append(scene); root.append(camera); host.insertBefore(root, before);
  return { root, mesh, publish(publication: VolumeCameraPublication) {
    const transform = preparedVolumeCameraTransform(publication, frame, CSS_PER_UNIT);
    camera.style.perspective = `${transform.focalPixels}px`;
    const [x, y] = publication.viewport.principalOffsetPixels;
    camera.style.perspectiveOrigin = `calc(50% + ${x}px) calc(50% + ${y}px)`;
    scene.style.transform = `translate3d(${transform.translationCssPixels.map(value => `${value}px`).join(',')}) ${worldRotationCss(transform.rotation)}`;
  } };
}

/** A point drawn as three crossed squares, so it reads from any side. */
function appendPoints(mesh: HTMLElement, places: number[], toLocal: ReturnType<typeof arcsecToLocal>, color: string, sizePx: number, colors?: string[]) {
  const document = mesh.ownerDocument, half = sizePx / 2, fragment = document.createDocumentFragment();
  for (let index = 0; index + 2 < places.length; index += 3) {
    const [x, y, z] = css(toLocal(places[index]!, places[index + 1]!, places[index + 2]!));
    for (const turn of ['', ' rotateY(90deg)', ' rotateX(90deg)']) {
      const node = document.createElement('s');
      node.style.width = `${sizePx}px`; node.style.height = `${sizePx}px`; node.style.background = colors?.[index / 3] ?? color;
      node.style.transformOrigin = `${half}px ${half}px`;
      node.style.transform = `translate3d(${(x - half).toFixed(2)}px,${(y - half).toFixed(2)}px,${z.toFixed(2)}px)${turn}`;
      fragment.append(node);
    }
  }
  mesh.append(fragment);
}

/** Triangles as CSS border triangles, each mapped onto its three corners, flat-shaded by a light from the viewer's side. */
function appendTriangles(mesh: HTMLElement, vertices: number[], faces: number[], toLocal: ReturnType<typeof arcsecToLocal>, color: string, texture?: Texture) {
  const document = mesh.ownerDocument, fragment = document.createDocumentFragment(), places: number[][] = [];
  for (let index = 0; index + 2 < vertices.length; index += 3) places.push(css(toLocal(vertices[index]!, vertices[index + 1]!, vertices[index + 2]!)));
  const light = css(toLocal(-.35, .45, .82)), lightLength = Math.hypot(...light);
  for (let index = 0; index + 2 < faces.length; index += 3) {
    const p0 = places[faces[index]!], p1 = places[faces[index + 1]!], p2 = places[faces[index + 2]!];
    if (!p0 || !p1 || !p2) continue;
    const a = p1.map((value, axis) => value - p0[axis]!), b = p2.map((value, axis) => value - p0[axis]!);
    const normal = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!], length = Math.hypot(...normal);
    if (!(length > 1e-9)) continue;
    const n = normal.map(value => value / length), lambert = Math.abs(n.reduce((sum, value, axis) => sum + value * light[axis]!, 0) / lightLength);
    const node = document.createElement('s'), atlas = texture?.atlasUrl && texture.cell && texture.columns ? texture : null, size = atlas ? atlas.cell! : TRIANGLE_PX;
    if (atlas) {
      // The triangle's own atlas cell: the picture along Earth's sight line, clear outside the triangle.
      const face = index / 3, column = face % atlas.columns!, row = Math.floor(face / atlas.columns!);
      node.style.width = `${size}px`; node.style.height = `${size}px`; node.style.backgroundImage = `url(${JSON.stringify(atlas.atlasUrl)})`;
      node.style.backgroundSize = `${atlas.width}px ${atlas.height}px`; node.style.backgroundPosition = `${-column * size}px ${-row * size}px`;
    } else {
      node.style.width = '0'; node.style.height = '0';
      node.style.borderTop = `${TRIANGLE_PX}px solid ${shade(color, .35 + .75 * lambert)}`; node.style.borderRight = `${TRIANGLE_PX}px solid transparent`;
    }
    const m = [a[0]! / size, a[1]! / size, a[2]! / size, 0, b[0]! / size, b[1]! / size, b[2]! / size, 0,
      n[0]!, n[1]!, n[2]!, 0, p0[0]!, p0[1]!, p0[2]!, 1];
    node.style.transform = `matrix3d(${m.map(value => Number(value.toFixed(5))).join(',')})`;
    fragment.append(node);
  }
  mesh.append(fragment);
}

/** The forward shock: a sphere of `radiusArcsec`, drawn as its sky circle and two meridians, dashed. */
function appendShock(mesh: HTMLElement, radiusArcsec: number, toLocal: ReturnType<typeof arcsecToLocal>) {
  const places: number[] = [], steps = 180;
  for (let step = 0; step < steps; step++) {
    if (step % 3 === 2) continue;
    const angle = 2 * Math.PI * step / steps, c = Math.cos(angle) * radiusArcsec, s = Math.sin(angle) * radiusArcsec;
    places.push(c, s, 0);
    if (step % 2 === 0) places.push(c, 0, s, 0, c, s);
  }
  appendPoints(mesh, places, toLocal, '#f0c27a', 2.4);
}

/** The lab's model layers for one mounted bank. */
export function createCandidateModels() {
  const layers = new Map<string, ReturnType<typeof mountLayer>>(), cache = new Map<string, Promise<CandidateModel>>(), textures = new Map<string, Promise<Texture>>();
  const query = (object: string, id: string, texture: string, part: string) => `/__nebula/plate-candidate-texture?object=${encodeURIComponent(object)}&id=${encodeURIComponent(id)}&texture=${texture}&part=${part}`;
  /** A model's texture: point colors, or a mesh's atlas, decoded before its triangles mount. */
  const loadTexture = (object: string, id: string, texture: string) => {
    const key = `${object}\n${id}\n${texture}`;
    if (!textures.has(key)) textures.set(key, (async () => {
      const response = await fetch(query(object, id, texture, 'json'), { cache: 'no-store' }), body = await response.json() as Texture & { atlas?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      if (body.atlas) { const url = query(object, id, texture, 'png'), image = new Image(); image.src = url; await image.decode(); body.atlasUrl = url; }
      return body;
    })().catch((failure: unknown) => { textures.delete(key); throw failure; }));
    return textures.get(key)!;
  };
  let shock: ReturnType<typeof mountLayer> | null = null, context: { host: HTMLElement; before: Node; frame: DensityVolumeFrame; object: string } | null = null;
  let last: VolumeCameraPublication | null = null;
  const load = (object: string, id: string) => {
    const key = `${object}\n${id}`;
    if (!cache.has(key)) cache.set(key, fetch(`/__nebula/plate-candidate-model?object=${encodeURIComponent(object)}&id=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async response => { const body = await response.json() as CandidateModel & { error?: string }; if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`); return body; })
      .catch((failure: unknown) => { cache.delete(key); throw failure; }));
    return cache.get(key)!;
  };
  return {
    /** Show exactly `state.ids` with their textures, the shock sphere when asked; a chosen model replaces the bank. */
    async set(state: CandidateModelState, next: { host: HTMLElement; before: Node; frame: DensityVolumeFrame; object: string; current(): boolean }) {
      if (context && (context.frame !== next.frame || context.object !== next.object)) this.clear();
      context = next;
      const toLocal = arcsecToLocal(next.frame);
      next.host.dataset.candidateBank = state.ids.length ? 'hidden' : 'shown';
      if (state.shock && !shock) { shock = mountLayer(next.host, next.before, next.frame, 'shock-153'); appendShock(shock.mesh, 153, toLocal); if (last) shock.publish(last); }
      if (!state.shock && shock) { shock.root.remove(); shock = null; }
      const keys = state.ids.map(id => `${id}:${state.texture === 'auto' ? autoTexture(id) : state.texture}`);
      for (const [key, layer] of layers) if (!keys.includes(key)) { layer.root.remove(); layers.delete(key); }
      for (const key of keys) {
        if (layers.has(key)) continue;
        const [id, textureName] = key.split(':') as [string, CandidateTexture];
        const model = await load(next.object, id), texture = textureName === 'none' ? undefined : await loadTexture(next.object, id, textureName);
        if (!next.current() || layers.has(key) || !keys.includes(key)) continue;
        const started = performance.now(), layer = mountLayer(next.host, next.before, next.frame, id);
        layer.root.dataset.candidateTexture = textureName;
        if (model.vertices && model.faces) appendTriangles(layer.mesh, model.vertices, model.faces, toLocal, model.color, texture);
        if (model.points) appendPoints(layer.mesh, model.points, toLocal, model.color, 2, texture?.colors);
        layer.root.dataset.candidateModelNodes = String(layer.mesh.childElementCount);
        layer.root.dataset.candidateBuildMs = (performance.now() - started).toFixed(0);
        layers.set(key, layer); if (last) layer.publish(last);
      }
    },
    publish(publication: VolumeCameraPublication) { last = publication; shock?.publish(publication); for (const layer of layers.values()) layer.publish(publication); },
    clear() { shock?.root.remove(); shock = null; for (const layer of layers.values()) layer.root.remove(); layers.clear(); if (context) delete context.host.dataset.candidateBank; context = null; last = null; },
  };
}
