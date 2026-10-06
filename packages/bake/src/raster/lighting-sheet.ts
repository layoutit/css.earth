/**
 * The one sheet a sphere's lighting is published as: every phase of the Sun in one image. The flood-lit frame a body shows
 * with shadows off stays beside it as its own file, at the size and under the name it has always had, so the view every
 * page opens on is the same pixels.
 *
 * A frame depends on one number, the angle between the Sun and the camera; the page turns the frame about the view axis
 * for the rest. The frames are spaced evenly in that angle, where an even step in the light's view z spends most frames
 * near quarter phase and leaves the crescent and gibbous ends coarse. Measured for the shared sphere law against the exact
 * frame at 920 px across, over 60 phases, in alpha levels of 255 over the body (2026-10-06, the PR that introduced this
 * sheet): the 256 frames of 1024 px this replaced, even in z and delivered as 32 files of 7.0 MB, were off by at most 24
 * and 1.38 rms; these 128 frames of 256 px are off by at most 9 and 0.90 rms in one file of 0.6 MB. 96 frames gave 12 and
 * 1.17, 64 frames 16 and 1.73. Below 256 px the disc's edge reaches into the body: 192 px gave 27 at most, 128 px 96.
 */
export const LIGHTING_SHEET = Object.freeze({
  frameCount: 128,
  /** The pixels a frame gives the overlay's box. */
  frameSize: 256,
  /** Pixels around each frame: the lit disc is wider than the box, and its overhang ends inside its own tile, so the page's
   * sampling at the box's edge reads this frame and never its neighbour. */
  margin: 4,
  columns: 16,
  /** The lit disc reaches past the fitted silhouette to cover the mesh's edge (packages/bake/src/baking/lambert-raster.ts). */
  radiusScale: 0.505,
  sheetFile: 'lighting-sheet.webp',
  shadowlessFile: 'lighting-2x-shadowless.webp',
});

/** The light's view-space z of a frame: -1 with the Sun behind the body, 1 with it behind the camera. */
export function lightingSheetViewZ(frame: number): number {
  const { frameCount } = LIGHTING_SHEET;
  if (!Number.isInteger(frame) || frame < 0 || frame >= frameCount) throw new RangeError(`Lighting frame ${frame} is outside the sheet's ${frameCount} frames.`);
  return frame === 0 ? -1 : frame === frameCount - 1 ? 1 : -Math.cos(Math.PI * frame / (frameCount - 1));
}

const pixels = (value: number) => `${Number(value.toFixed(4))}px`;

/** The pixel size of the sheet and of one tile (a frame with its margin). */
export function lightingSheetLayout() {
  const { frameCount, frameSize, margin, columns } = LIGHTING_SHEET, tile = frameSize + 2 * margin, rowCount = Math.ceil(frameCount / columns);
  return { tile, rowCount, width: columns * tile, height: rowCount * tile };
}

/** A frame's CSS address in the sheet for an overlay `presentationSize` CSS pixels across. */
export function lightingSheetAddress(frame: number, presentationSize: number) {
  const { frameSize, margin, columns } = LIGHTING_SHEET, { tile, rowCount } = lightingSheetLayout(), scale = presentationSize / frameSize;
  return { backgroundPosition: `${pixels(-((frame % columns) * tile + margin) * scale)} ${pixels(-(Math.floor(frame / columns) * tile + margin) * scale)}`,
    backgroundSize: `${pixels(columns * tile * scale)} ${pixels(rowCount * tile * scale)}` };
}

/** The flood-lit frame's pixel size: twice the overlay's CSS size rounded up to a power of two, a frame pixel for each
 * device pixel of a 2x screen (1024 px for the 460 px overlay of most bodies, 512 px for a 256 px one). */
export function lightingShadowlessSize(presentationSize: number): number {
  if (!(presentationSize > 0)) throw new RangeError(`A lighting overlay needs a positive size, not ${presentationSize}.`);
  return 2 * 2 ** Math.ceil(Math.log2(presentationSize));
}

/** The flood-lit frame's CSS address in its own file: the whole image over the overlay's box. */
export function lightingShadowlessAddress(presentationSize: number) {
  return { backgroundPosition: '0px 0px', backgroundSize: `${presentationSize}px ${presentationSize}px` };
}
