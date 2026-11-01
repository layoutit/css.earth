/** A regraded dataset's far pictures: the Horálek pictures with one global gain per channel from its fit. They hold every component in one image, so nothing finer is possible without rendering them again. */
import { mkdir, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { armChannelGains } from './arms.mts';
import { BAKE_DIR } from '../scene.mts';

export const gradedFarDir = (arm: 'decam' | 'vista') => BAKE_DIR + 'far-' + arm + '/';
export async function gradeFar(arm: 'decam' | 'vista', from: string) {
  const channelGains = armChannelGains(arm),
    to = gradedFarDir(arm);
  await mkdir(to, { recursive: true });
  const lut = channelGains.map(g =>
    Uint8Array.from({ length: 256 }, (_, v) => {
      const x = v / 255,
        l = x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4,
        o = Math.min(1, l * g);
      return Math.round(255 * (o <= 0.0031308 ? 12.92 * o : 1.055 * o ** (1 / 2.4) - 0.055));
    }),
  );
  for (const name of await readdir(from)) {
    const { data, info } = await sharp(from + name)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) data[i + c] = lut[c]![data[i + c]!]!;
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png({ compressionLevel: 6 })
      .toFile(to + name);
  }
  console.log('LMC_GRADE_FAR ' + arm);
}
