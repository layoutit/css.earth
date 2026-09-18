import { mkdir } from 'node:fs/promises';

import sharp from 'sharp';

// App icons are crops of the prepared Earth capture (tools/prepare-social-images.mts):
// the rendered CSS globe on its own sky, with no added artwork.
const SOURCE = 'public/social/earth.jpg';
const OUTPUT = 'public/app-icons';
// The globe spans x 405-795 and y 120-507 in the 1200x630 capture.
const GLOBE = { centerX: 600, centerY: 313, diameter: 390 };

// "any" icons fill most of the square; maskable icons keep the globe inside
// the central 80% circle that launchers never crop.
const VARIANTS = [
  { file: 'icon-192.png', size: 192, fill: 0.9 },
  { file: 'icon-512.png', size: 512, fill: 0.9 },
  { file: 'maskable-512.png', size: 512, fill: 0.72 },
  { file: 'apple-touch-icon.png', size: 180, fill: 0.8 },
] as const;

await mkdir(OUTPUT, { recursive: true });
const metadata = await sharp(SOURCE).metadata();
if (metadata.width !== 1200 || metadata.height !== 630) {
  throw new Error(`${SOURCE} must be the 1200x630 social capture; got ${metadata.width}x${metadata.height}.`);
}
for (const { file, size, fill } of VARIANTS) {
  const side = Math.round(GLOBE.diameter / fill);
  const left = GLOBE.centerX - Math.round(side / 2);
  const top = GLOBE.centerY - Math.round(side / 2);
  if (left < 0 || top < 0 || left + side > metadata.width || top + side > metadata.height) {
    throw new Error(`${file} crop falls outside ${SOURCE}.`);
  }
  await sharp(SOURCE)
    .extract({ left, top, width: side, height: side })
    .resize(size, size, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, palette: true, quality: 90, dither: 0.5 })
    .toFile(`${OUTPUT}/${file}`);
  console.log(`${OUTPUT}/${file} ${size}px from a ${side}px crop`);
}
