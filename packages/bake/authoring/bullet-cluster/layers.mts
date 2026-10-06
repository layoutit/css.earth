// Entry script: node packages/bake/authoring/bullet-cluster/layers.mts [bank id, bullet-cluster-layers if none]
/**
 * The Bullet Cluster's hot gas and its mass, each as a picture of its own on the photograph's frame.
 *
 * The Chandra X-ray Center published the 2006 composite in layers on one frame of 3000 by 2168 px: the visible-light
 * image alone, the same image with the X-ray gas over it, and the same image with the lensing mass map over it. Measured here on ESA's copy of the full composite: the
 * layers were added by a screen (per channel, one minus the product of what each leaves dark), which fits 3 to 4 of
 * 255 where adding fits 20 to 32. So a layer alone is what undoing that screen leaves:
 * 1 - (1 - layer over visible) / (1 - visible), channel by channel. Put back together by a screen, the visible-light
 * image and the two layers differ from ESA's composite, a JPEG, by 2.7 of 255 on average.
 *
 * Where the visible-light image is bright (a star, a galaxy) the division has nothing to work with. Both layers are
 * smooth there, so those places take the layer around them: the mean of the valid pixels nearby, over a width that grows until
 * enough of them are in reach.
 *
 * Input, beside the bank's recipe: `1e0657_opt.tif`, `1e0657_xray_opt.tif` and `1e0657_opt_lens.tif`. Output: `gas.png`
 * and `mass.png`, and printed, how many pixels were filled from around them.
 */
import { resolve } from 'node:path';
import sharp from 'sharp';

/** The visible-light image's brightest channel, of 255, from which a pixel holds no reading of a layer. */
const BRIGHT = 140;
/** Widths, in pixels, of the neighbourhoods a bright place is filled from, and the share of valid pixels that is enough. */
const WIDTHS = [3, 8, 20, 50], ENOUGH = 96 / 255;

const source = resolve(import.meta.dirname, '../../../../src/objects', process.argv[2] ?? 'bullet-cluster-layers', 'source');
const read = async (name: string) => { const { data, info } = await sharp(resolve(source, name)).toColorspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height }; };
const visible = await read('1e0657_opt.tif'), { width, height } = visible, count = width * height;
const blurred = async (values: Uint8Array, sigma: number) => { const { data, info } = await sharp(Buffer.from(values.buffer), { raw: { width, height, channels: 1 } }).blur(sigma).toColorspace('b-w').raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new TypeError('The blur must stay one channel.'); return data; };
const valid = new Uint8Array(count); let bright = 0;
for (let p = 0; p < count; p++) { valid[p] = Math.max(visible.data[3 * p]!, visible.data[3 * p + 1]!, visible.data[3 * p + 2]!) < BRIGHT ? 255 : 0; if (!valid[p]) bright++; }
const cover = await Promise.all(WIDTHS.map(sigma => blurred(valid, sigma)));
for (const [name, file] of [['gas.png', '1e0657_xray_opt.tif'], ['mass.png', '1e0657_opt_lens.tif']] as const) { const over = await read(file), layer = Buffer.alloc(3 * count);
  if (over.width !== width || over.height !== height) throw new TypeError(`${file} is ${over.width} by ${over.height} px and 1e0657_opt.tif ${width} by ${height}: the layers share one frame.`);
  for (let c = 0; c < 3; c++) { const lifted = new Uint8Array(count);
    for (let p = 0; p < count; p++) if (valid[p]) { const under = visible.data[3 * p + c]! / 255, both = over.data[3 * p + c]! / 255; lifted[p] = Math.round(255 * Math.max(0, Math.min(1, 1 - (1 - both) / (1 - under)))); }
    const around = await Promise.all(WIDTHS.map(sigma => blurred(lifted, sigma)));
    for (let p = 0; p < count; p++) { let level = WIDTHS.length - 1; for (let k = 0; k < WIDTHS.length; k++) if (cover[k]![p]! / 255 > ENOUGH) { level = k; break; }
      layer[3 * p + c] = cover[level]![p]! ? Math.min(255, Math.round(255 * around[level]![p]! / cover[level]![p]!)) : 0; } }
  await sharp(layer, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 9 }).toFile(resolve(source, name)); }
console.log(`gas.png, mass.png: ${width} by ${height} px; ${bright} of ${count} pixels (${(100 * bright / count).toFixed(1)}%) were too bright in visible light and take the layer around them.`);
