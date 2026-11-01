/**
 * The form the near slabs ship in. Measured on a Galaxy S23 Ultra (411 x 742 CSS px at DPR 2.625, Chrome, 60 Hz) with the
 * three datasets' same drags, 2026-11-01. Chrome keeps each layer at no less than its CSS box times the DPR, so a 1,027 px
 * box took 2,696 device pixels a side for a 2,054 px image of a smooth column. Tile budget short in 22 to 80 assignments
 * of a turn and 35 to 50 frames drew empty at the original form, none short and 0 to 2 drew empty at this one.
 * Half images alone left 25 drops on a slow tilt and 32 empty frames in a flick; a box a half left 4 empty, a third 0.
 * Two-thirds images with a half box left 58 empty frames.
 */
import sharp from 'sharp';
import type { PreparedCssVolume } from '@cssearth/objects';

export const SLAB_IMAGE_DIVISOR = 2,
  SLAB_BOX_DIVISOR = 3;
type Leaf = PreparedCssVolume['stacks'][number]['leaves'][number];

/** The same rectangle on screen from a smaller box: the matrix's two edge columns grow by what the box lost. The sizes
 * follow from the source image, whose full box is half its pixels, so a bank that already ships this form installs unchanged. */
export function slabLeaf(leaf: Leaf, source: { width: number; height: number }): Leaf {
  const { style } = leaf,
    width = parseFloat(style.width),
    height = parseFloat(style.height);
  const boxWidth = Math.round(source.width / 2 / SLAB_BOX_DIVISOR),
    boxHeight = Math.round(source.height / 2 / SLAB_BOX_DIVISOR),
    matrix = /^matrix3d\((.*)\)$/u.exec(style.transform);
  if (!matrix) throw new TypeError(`Slab ${leaf.id} has no matrix3d.`);
  const m = matrix[1]!.split(',').map(Number);
  for (let i = 0; i < 4; i++) {
    m[i] = +((m[i]! * width) / boxWidth).toFixed(6);
    m[i + 4] = +((m[i + 4]! * height) / boxHeight).toFixed(6);
  }
  return {
    ...leaf,
    widthPx: Math.round(source.width / SLAB_IMAGE_DIVISOR),
    heightPx: Math.round(source.height / SLAB_IMAGE_DIVISOR),
    style: {
      ...style,
      width: `${boxWidth}px`,
      height: `${boxHeight}px`,
      backgroundSize: `${boxWidth}px ${boxHeight}px`,
      transform: `matrix3d(${m.join(',')})`,
    },
  };
}

/** A slab image at its delivered size. */
export async function slabImage(
  file: string,
): Promise<{ bytes: Buffer; width: number; height: number; source: { width: number; height: number } }> {
  const { width, height } = await sharp(file).metadata(),
    size = { width: Math.round(width! / SLAB_IMAGE_DIVISOR), height: Math.round(height! / SLAB_IMAGE_DIVISOR) };
  return {
    bytes: await sharp(file)
      .resize(size.width, size.height, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    ...size,
    source: { width: width!, height: height! },
  };
}
