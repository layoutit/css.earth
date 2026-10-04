import { cssCameraAxesFromOrientation } from '@cssearth/engine';
import type { VolumeCameraPublication } from '../volume/types.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** A warp holds while it changes no dot's size by more than this factor: a turn's projective map stretches the painted discs
 * with its centres, and a larger turn grows the dots on one side of the view past their size. */
const MAX_WARP_STRETCH = 1.1;

type Matrix3 = [number, number, number, number, number, number, number, number, number];
const multiply = (a: Matrix3, b: Matrix3): Matrix3 => [0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => {
  const row = Math.floor(index / 3) * 3, column = index % 3;
  return a[row]! * b[column]! + a[row + 1]! * b[column + 3]! + a[row + 2]! * b[column + 6]!;
}) as Matrix3;
/** Screen pixels (from the view's top left) to a camera direction, and back: `camera = axes · world`. */
const unproject = (focal: number, cx: number, cy: number): Matrix3 => [1 / focal, 0, -cx / focal, 0, 1 / focal, -cy / focal, 0, 0, -1];
const project = (focal: number, cx: number, cy: number): Matrix3 => [focal, 0, -cx, 0, focal, -cy, 0, 0, -1];
/** The camera axes as a matrix taking world directions to camera ones, and its transpose. */
const axesMatrix = (r: readonly number[]): Matrix3 => [r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!];
const transpose = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** A camera's turn and lens: what one warp of the screen can undo. Its travel is not part of it. */
export const cameraRest = ({ world, viewport }: VolumeCameraPublication): readonly number[] =>
  [...world.pose.orientationXyzw, viewport.focalPixels, ...viewport.principalOffsetPixels, viewport.widthPixels ?? 0, viewport.heightPixels ?? 0];
export const sameRest = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Why a field is asked to repaint: the field that repainted was travelling (no warp will slide these paints, so they
 * leave the margin out), or it painted the exact frame that follows a pause. */
export interface PointLayerRepaint { readonly travelling: boolean; readonly settled: boolean }
/** A dot field as its layer sees it. */
export interface PointLayerMember {
  /** Whether its dots show: a hidden field is not repainted for the others. */
  shown(): boolean;
  /** The turn and lens its paint was made at and the margin it painted, or null before its first paint. */
  painted(): { readonly rest: readonly number[]; readonly overscan: number } | null;
  /** Repaint now from this camera: another field of the layer did, and one warp cannot hold both paints. */
  repaint(publication: VolumeCameraPublication, reason: PointLayerRepaint): void;
}
/** One owner's place in a layer: its group, after the groups mounted before it. */
export interface PointLayerSlot { readonly layer: PointLayer; readonly group: SVGGElement; release(): void }
export interface PointLayer {
  readonly root: HTMLElement; readonly svg: SVGSVGElement;
  slot(): PointLayerSlot;
  /** A field that paints into this layer; returns its leave. */
  join(member: PointLayerMember): () => void;
  /** Whether a paint made at this turn and lens is one of the layer's current paints. */
  holds(rest: readonly number[]): boolean;
  /** The layer's paints are right as they are for this camera. */
  unwarp(): void;
  /** Move the layer's paints to this camera by one warp; false when a warp cannot (they must repaint). */
  warpTo(publication: VolumeCameraPublication): boolean;
  /** `member` painted from this camera. A paint at a new turn or lens repaints the layer's other showing fields. */
  painted(member: PointLayerMember, publication: VolumeCameraPublication, reason: PointLayerRepaint): void;
}

const layers = new WeakMap<Node, PointLayer>();

/** A place for dots in `host` before `before`: in the dot layer that already ends there, or in a new one. Dot fields
 * mounted next to each other share one svg, so they are one compositing layer and one raster when they repaint. On the
 * iPad each bank's own layer was a view-sized backing store (10.5 MB, and as much again for its parent): at the Milky
 * Way ten banks held 202 MB of layers and left 37 and 77 frames over 20 ms in 690, where three shared layers hold 130 MB
 * and left 25 and 25 (interleaved runs, 2026-10-03).
 * Anything mounted between two banks keeps them in separate layers, so the stacking order is the mount order, as it was.
 *
 * The layer owns the warp, since one transform moves every field in it. A turn or a change of lens moves all far
 * points by the same projective map of the screen: while every showing field's paint is from the same turn and lens and
 * covers the view, the layer moves them as one. A field that repaints at a new turn or lens ends that: the layer goes
 * back to no warp, and its other showing fields repaint from the same camera. */
export function pointLayerSlot(host: HTMLElement, before?: Node | null): PointLayerSlot {
  const previous = before ? before.previousSibling : host.lastChild;
  return ((previous && layers.get(previous)) ?? createLayer(host, before ?? null)).slot();
}

function createLayer(host: HTMLElement, before: Node | null): PointLayer {
  const document = host.ownerDocument;
  const root = document.createElement('div'); root.className = 'point-layer'; root.ariaHidden = 'true';
  // The overscan paints past the svg's own box and a warp moves it; the root clips both to the view.
  Object.assign(root.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none' });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  // The dots are their own layer: a rewrite repaints them alone, not the viewport layer they would otherwise paint into
  // (on M31 the viewport repainted about twice a frame, 2026-09-30), and a turn's warp moves that layer on the compositor.
  Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible', transformOrigin: '0 0', willChange: 'transform' });
  root.append(svg);
  host.insertBefore(root, before);
  const members = new Set<PointLayerMember>();
  let groups = 0, warp = '';
  // The camera the layer's paints are from: every showing field painted at this turn and lens.
  let epoch: { rest: readonly number[]; axes: Matrix3; focal: number; cx: number; cy: number; width: number; height: number } | null = null;
  // The last camera a warp was asked for, and its answer: every field of the layer asks on the same frame.
  let asked: readonly number[] | null = null, answer = false;
  const setWarp = (value: string) => { if (warp !== value) { svg.style.transform = value; warp = value; } };
  const layer: PointLayer = {
    root, svg,
    slot() {
      const group = document.createElementNS(SVG_NS, 'g');
      svg.append(group); groups++;
      let released = false;
      return { layer, group, release() { if (released) return; released = true; group.remove(); if (--groups === 0) { layers.delete(root); root.remove(); } } };
    },
    join(member) { members.add(member); return () => { members.delete(member); }; },
    holds: rest => epoch !== null && sameRest(rest, epoch.rest),
    unwarp() { setWarp(''); },
    warpTo(publication) {
      if (!epoch) return false;
      const rest = cameraRest(publication);
      if (sameRest(rest, epoch.rest)) { setWarp(''); return true; }
      if (asked && sameRest(rest, asked)) return answer;
      asked = rest; answer = false;
      const { viewport } = publication, width = viewport.widthPixels ?? 0, height = viewport.heightPixels ?? 0;
      if (!(width > 0 && height > 0) || width !== epoch.width || height !== epoch.height) return false;
      // The warp shows only what was painted: the least margin any showing field painted bounds it.
      let margin = Infinity;
      for (const member of members) {
        const paint = member.shown() ? member.painted() : null;
        if (!paint) continue;
        if (!sameRest(paint.rest, epoch.rest)) return false;
        margin = Math.min(margin, paint.overscan);
      }
      if (margin === Infinity) return false;
      const cx = width / 2 + viewport.principalOffsetPixels[0], cy = height / 2 + viewport.principalOffsetPixels[1];
      const turn = multiply(axesMatrix(cssCameraAxesFromOrientation(publication.world.pose.orientationXyzw)), transpose(epoch.axes));
      const forward = multiply(project(viewport.focalPixels, cx, cy), multiply(turn, unproject(epoch.focal, epoch.cx, epoch.cy)));
      const back = multiply(project(epoch.focal, epoch.cx, epoch.cy), multiply(transpose(turn), unproject(viewport.focalPixels, cx, cy)));
      const source = (x: number, y: number) => { const w = back[6] * x + back[7] * y + back[8];
        return [(back[0] * x + back[1] * y + back[2]) / w, (back[3] * x + back[4] * y + back[5]) / w, w] as const; };
      // The warp moves discs as well as centres: where it magnifies, a painted dot grows. It holds only while every dot
      // in the view keeps its size within MAX_WARP_STRETCH; a projective map's stretch is largest at the view's corners.
      const covered = [[0, 0], [width, 0], [0, height], [width, height]].every(([x, y]) => {
        const [px, py, w] = source(x!, y!);
        if (!(w > 0)) return false;
        const [ax, ay] = source(x! + 1, y!), [bx, by] = source(x!, y! + 1);
        const stretch = [Math.hypot(ax - px, ay - py), Math.hypot(bx - px, by - py)];
        if (stretch.some(value => !(value >= 1 / MAX_WARP_STRETCH && value <= MAX_WARP_STRETCH))) return false;
        return px >= -margin * width && px <= (1 + margin) * width && py >= -margin * height && py <= (1 + margin) * height;
      });
      if (!covered) return false;
      const f = (value: number) => Number(value.toPrecision(10));
      setWarp(`matrix3d(${f(forward[0])},${f(forward[3])},0,${f(forward[6])},${f(forward[1])},${f(forward[4])},0,${f(forward[7])},0,0,1,0,${f(forward[2])},${f(forward[5])},0,${f(forward[8])})`);
      return answer = true;
    },
    painted(member, publication, reason) {
      const rest = cameraRest(publication);
      setWarp(''); asked = null;
      if (epoch && sameRest(rest, epoch.rest)) return;
      const { viewport } = publication, width = viewport.widthPixels ?? 0, height = viewport.heightPixels ?? 0;
      epoch = { rest, axes: axesMatrix(cssCameraAxesFromOrientation(publication.world.pose.orientationXyzw)), focal: viewport.focalPixels,
        cx: width / 2 + viewport.principalOffsetPixels[0], cy: height / 2 + viewport.principalOffsetPixels[1], width, height };
      // The others' paints are from another turn or lens, and no warp is left to move them: they follow, from this camera.
      // Each lands in this same epoch, so none asks the rest again.
      for (const other of members) {
        if (other === member || !other.shown()) continue;
        const paint = other.painted();
        if (paint && !sameRest(paint.rest, rest)) other.repaint(publication, reason);
      }
    },
  };
  layers.set(root, layer);
  return layer;
}
