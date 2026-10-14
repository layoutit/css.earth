// Deploy step, after `astro build`: writes `dist/social/<id>.jpg`, the 1200×630 share image of every page that has no
// committed capture, from the arrival billboard the page already ships. The page centres it on black at the card's full
// height, as a reader first sees it. A billboard that cannot be read fails the deploy: its page advertises this file.
import { existsSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { SCENE_OBJECTS } from '../directory/objects.mts';
import { billboardSocialImages, committedSocialImages } from '../server/social-images.mts';
import { resolveBuildSceneAddress } from '../server-assets/asset-origin.mts';

const root = resolve(import.meta.dirname, '../..');
const WIDTH = 1200, HEIGHT = 630;
// Decorative, at the cliff decoration is compressed to: a 199-card sample averages 12.8 KB at q82 (47 MB for every page)
// and 6.6 KB at q40 (24 MB), with no visible change at link-preview size. JPEG, because not every unfurler reads WebP.
const JPEG = { quality: 40, mozjpeg: true } as const;

async function billboardBytes(id: string, address: string, root: string): Promise<Buffer> {
  const local = resolve(root, 'site/public', address.replace(/^\//u, ''));
  if (existsSync(local)) return readFile(local);
  const url = await resolveBuildSceneAddress(address, root);
  if (!/^https?:\/\//u.test(url)) throw new Error(`${id}: billboard ${address} is not in site/public/ and ASSET_ORIGIN is unset.`);
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

/** Git's blob identity includes its type/length header, just as git hash-object does. */
function blobIdentity(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}

const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const ID = /^[a-z0-9][a-z0-9_.+-]*$/u;

/** Read the real recipe and package pins once per run; installed codec versions also matter to JPEG bytes. */
export async function shareImageRecipeIdentity(root: string): Promise<string> {
  const inputs = await Promise.all(['site/build/share-images.mts', 'package.json', 'pnpm-lock.yaml'].map(async path =>
    [path, blobIdentity(await readFile(resolve(root, path)))] as const));
  return blobIdentity(Buffer.from(JSON.stringify([inputs, sharp.versions, process.platform, process.arch, process.version])));
}

async function atomicWrite(path: string, bytes: Uint8Array | string): Promise<void> {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, bytes); await rename(temporary, path); }
  finally { await rm(temporary, { force: true }); }
}

async function cachedCard(cache: string, key: string): Promise<Buffer | null> {
  try {
    const receipt: unknown = JSON.parse(await readFile(resolve(cache, `${key}.json`), 'utf8'));
    if (!record(receipt) || receipt.schema !== 'cssearth-share-card@1' || receipt.key !== key ||
      typeof receipt.bytes !== 'number' || !Number.isSafeInteger(receipt.bytes) || receipt.bytes <= 0 ||
      typeof receipt.cardBlob !== 'string' || !/^[a-f0-9]{40}$/u.test(receipt.cardBlob)) return null;
    const card = await readFile(resolve(cache, `${key}.jpg`));
    return card.length === receipt.bytes && blobIdentity(card) === receipt.cardBlob ? card : null;
  } catch (error) {
    if (missing(error) || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function managedImages(cache: string): Promise<readonly string[]> {
  let value: unknown;
  try { value = JSON.parse(await readFile(resolve(cache, 'generated.json'), 'utf8')); }
  catch (error) { if (missing(error)) return []; throw error; }
  if (!record(value) || value.schema !== 'cssearth-generated-share-images@1' || !Array.isArray(value.ids) ||
    !value.ids.every((id: unknown): id is string => typeof id === 'string' && ID.test(id))) {
    throw new TypeError('Invalid generated share-image ledger.');
  }
  return value.ids;
}

async function pruneCards(cache: string, active: ReadonlyMap<string, Promise<Buffer>>): Promise<void> {
  const files = new Set((await readdir(cache, { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name));
  for (const file of files) {
    const key = /^([a-f0-9]{40})\.jpg$/u.exec(file)?.[1];
    if (!key || active.has(key) || !files.has(`${key}.json`)) continue;
    await rm(resolve(cache, file)); await rm(resolve(cache, `${key}.json`));
  }
}

/** Every source is read before reuse; the local cache survives an Astro dist clean and a fresh process. */
export async function writeShareImages(objects: Parameters<typeof billboardSocialImages>[0] = SCENE_OBJECTS, buildRoot = root):
Promise<{ written: number; rendered: number; reused: number; bytes: number }> {
  const committed = committedSocialImages(buildRoot), billboards = billboardSocialImages(objects, committed);
  for (const id of [...committed, ...billboards.keys()]) if (!ID.test(id)) throw new TypeError(`Invalid share-image id: ${id}`);
  const pending = [...billboards], output = resolve(buildRoot, 'dist/social'), cache = resolve(buildRoot, 'output/share-image-cache');
  const failures: string[] = [], cards = new Map<string, Promise<Buffer>>(), attempted = new Set<string>();
  const recipe = await shareImageRecipeIdentity(buildRoot), previous = await managedImages(cache);
  await mkdir(output, { recursive: true }); await mkdir(cache, { recursive: true });
  let written = 0, bytes = 0, rendered = 0, reused = 0;
  async function cardFor(billboard: Buffer): Promise<Buffer> {
    const key = blobIdentity(Buffer.from(JSON.stringify([recipe, blobIdentity(billboard)])));
    let card = cards.get(key);
    if (card) { reused++; return card; }
    card = (async () => {
      const hit = await cachedCard(cache, key);
      if (hit) { reused++; return hit; }
      const fresh = await shareCard(billboard);
      await atomicWrite(resolve(cache, `${key}.jpg`), fresh);
      await atomicWrite(resolve(cache, `${key}.json`), JSON.stringify({ schema: 'cssearth-share-card@1', key,
        bytes: fresh.length, cardBlob: blobIdentity(fresh) }));
      rendered++; return fresh;
    })();
    cards.set(key, card); return card;
  }
  await Promise.all(Array.from({ length: 16 }, async () => {
    for (let next = pending.pop(); next; next = pending.pop()) {
      const [id, address] = next;
      try {
        const card = await cardFor(await billboardBytes(id, address, buildRoot));
        attempted.add(id);
        await writeFile(resolve(output, `${id}.jpg`), card);
        written++; bytes += card.length;
      } catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    }
  }));
  const ownership = [...new Set([...previous, ...attempted])].sort(), previousIds = new Set(previous);
  const checkpointed = [...attempted].some(id => !previousIds.has(id));
  const ledger = resolve(cache, 'generated.json');
  // Own even a partially failed JPEG write before any error propagates or a later output step can fail.
  if (checkpointed) await atomicWrite(ledger, JSON.stringify({ schema: 'cssearth-generated-share-images@1', ids: ownership }));
  if (failures.length) throw new Error(`${failures.length} share images failed:\n${failures.join('\n')}`);
  // Astro normally copies these; restore their authoritative bytes even when a capture replaced an old generated card.
  for (const id of committed) await writeFile(resolve(output, `${id}.jpg`), await readFile(resolve(buildRoot, 'site/public/social', `${id}.jpg`)));
  for (const id of previous) if (!billboards.has(id) && !committed.has(id)) await rm(resolve(output, `${id}.jpg`), { force: true });
  const current = [...billboards.keys()].sort();
  if (!checkpointed || JSON.stringify(current) !== JSON.stringify(ownership)) {
    await atomicWrite(ledger, JSON.stringify({ schema: 'cssearth-generated-share-images@1', ids: current }));
  }
  await pruneCards(cache, cards);
  return { written, rendered, reused, bytes };
}

if (import.meta.main) {
  const result = await writeShareImages();
  console.log(`Wrote ${result.written} share images to dist/social (${(result.bytes / 1e6).toFixed(1)} MB; ${result.rendered} rendered, ${result.reused} reused).`);
}
