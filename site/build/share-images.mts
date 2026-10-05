// Deploy step, after `astro build`: writes `dist/social/<id>.jpg`, the 1200×630 share image of every page that has no
// committed capture, from the arrival billboard the page already ships. The page centres it on black at the card's full
// height, as a reader first sees it. A billboard that cannot be read fails the deploy: its page advertises this file.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { SCENE_OBJECTS } from '../objects.mts';
import { billboardSocialImages } from '../social-images.mts';
import { resolveBuildSceneAddress } from '../server-assets/asset-origin.mts';

const root = resolve(import.meta.dirname, '../..');
const WIDTH = 1200, HEIGHT = 630;
// Decorative, at the cliff decoration is compressed to: a 199-card sample averages 12.8 KB at q82 (47 MB for every page)
// and 6.6 KB at q40 (24 MB), with no visible change at link-preview size. JPEG, because not every unfurler reads WebP.
const JPEG = { quality: 40, mozjpeg: true } as const;

async function billboardBytes(id: string, address: string): Promise<Buffer> {
  const local = resolve(root, 'public', address.replace(/^\//u, ''));
  if (existsSync(local)) return readFile(local);
  const url = await resolveBuildSceneAddress(address, root);
  if (!/^https?:\/\//u.test(url)) throw new Error(`${id}: billboard ${address} is not in public/ and ASSET_ORIGIN is unset.`);
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url).catch((error: unknown) => error);
    if (response instanceof Response && response.ok) return Buffer.from(await response.arrayBuffer());
    if (attempt === 3) throw new Error(`${id}: billboard ${url} ${response instanceof Response ? `HTTP ${response.status}` : String(response)}`);
  }
}

export async function shareCard(billboard: Buffer): Promise<Buffer> {
  const body = await sharp(billboard).resize(HEIGHT, HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: '#000' } })
    .composite([{ input: body, left: (WIDTH - HEIGHT) / 2, top: 0 }]).jpeg(JPEG).toBuffer();
}

if (import.meta.main) {
  const pending = [...billboardSocialImages(SCENE_OBJECTS)], output = resolve(root, 'dist/social'), failures: string[] = [];
  await mkdir(output, { recursive: true });
  let written = 0, bytes = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    for (let next = pending.pop(); next; next = pending.pop()) {
      const [id, address] = next;
      try {
        const card = await shareCard(await billboardBytes(id, address));
        await writeFile(resolve(output, `${id}.jpg`), card);
        written++; bytes += card.length;
      } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    }
  }));
  if (failures.length) throw new Error(`${failures.length} share images failed:\n${failures.join('\n')}`);
  console.log(`Wrote ${written} share images to dist/social (${(bytes / 1e6).toFixed(1)} MB).`);
}
