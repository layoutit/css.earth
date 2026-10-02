/** Fetches the favicon of each site the Sources tab links to and records it in `site/source/source-icons.json`, as the agency
 * logos are recorded: where the site is, which file was taken and how many bytes the prepared copy has. A key is a link's host, or
 * a DOI registrant prefix, which is resolved to its publisher's site through one of its DOIs. Keys already recorded are kept, so a
 * run after new sources arrive fetches only the new sites; `--retry` asks the sites recorded without an icon again and `--all`
 * fetches every key again.
 *
 * Run: node site/build/prepare/refresh-source-icons.mts [--retry] [--all] */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { projectRoot } from '@cssearth/core/node';
import { parseSourceCredits } from '@cssearth/objects/provenance';
import { parseSourceIcons, type SourceIcon } from '../../source-icons.mts';

/** Rows draw the icon at 24 CSS px; the copy holds two device pixels for each. */
const ICON_PIXELS = 48;
const TIMEOUT_MS = 20_000;
const HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; cssEarth source icons; +https://css.earth)', accept: '*/*' };

const root = projectRoot(import.meta.url);
const recordPath = resolve(root, 'site/source/source-icons.json');
const publicRoot = resolve(root, 'public/shell/source-icons');

const get = (url: string) => fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });

/** The largest image of an ICO container, as PNG bytes or raw RGBA pixels. */
function largestIcoImage(file: Buffer): { png: Buffer } | { rgba: Buffer; width: number; height: number } | null {
  if (file.length < 6 || file.readUInt16LE(0) !== 0 || file.readUInt16LE(2) !== 1) return null;
  const entries = Array.from({ length: file.readUInt16LE(4) }, (_, index) => {
    const at = 6 + index * 16;
    return { width: file[at] || 256, bits: file.readUInt16LE(at + 6), size: file.readUInt32LE(at + 8), offset: file.readUInt32LE(at + 12) };
  }).filter(entry => entry.offset + entry.size <= file.length).sort((a, b) => b.width - a.width || b.bits - a.bits);
  for (const entry of entries) {
    const data = file.subarray(entry.offset, entry.offset + entry.size);
    if (data.readUInt32BE(0) === 0x89504e47) return { png: data };
    // A device-independent bitmap: 40-byte header, rows bottom-up, the stored height counting the mask rows too.
    const header = data.readUInt32LE(0), width = data.readInt32LE(4), height = data.readInt32LE(8) / 2, bits = data.readUInt16LE(14);
    if (header !== 40 || data.readUInt32LE(16) !== 0 || ![1, 4, 8, 24, 32].includes(bits)) continue;
    // Up to 8 bits a pixel indexes a BGRX palette that follows the header.
    const colours = bits <= 8 ? data.readUInt32LE(32) || 1 << bits : 0, pixels = header + colours * 4;
    const stride = Math.ceil(width * bits / 32) * 4, maskStride = Math.ceil(width / 32) * 4, mask = pixels + stride * height;
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const row = pixels + (height - 1 - y) * stride, to = (y * width + x) * 4;
      const masked = (data[mask + (height - 1 - y) * maskStride + (x >> 3)]! >> (7 - (x & 7))) & 1;
      const from = bits <= 8 ? header + ((data[row + ((x * bits) >> 3)]! >> (8 - bits - ((x * bits) & 7))) & ((1 << bits) - 1)) * 4 : row + x * bits / 8;
      rgba[to] = data[from + 2]!; rgba[to + 1] = data[from + 1]!; rgba[to + 2] = data[from]!;
      rgba[to + 3] = bits === 32 ? data[from + 3]! : masked ? 0 : 255;
    }
    // Some 32-bit icons leave alpha empty and rely on the mask.
    if (bits === 32 && rgba.every((value, index) => index % 4 !== 3 || value === 0)) for (let index = 3; index < rgba.length; index += 4) rgba[index] = 255;
    return { rgba, width, height };
  }
  return null;
}

async function prepared(bytes: Buffer): Promise<Buffer | null> {
  const ico = largestIcoImage(bytes);
  try {
    const image = ico ? 'png' in ico ? sharp(ico.png) : sharp(ico.rgba, { raw: { width: ico.width, height: ico.height, channels: 4 } }) : sharp(bytes, { density: 300 });
    return await image.resize(ICON_PIXELS, ICON_PIXELS, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ lossless: true }).toBuffer();
  } catch { return null; }
}

/** Icon links a page declares, the largest first, then the conventional location. */
function candidates(html: string, page: string): string[] {
  const links = [...html.matchAll(/<link\b[^>]*>/giu)].map(([tag]) => ({
    rel: /\brel\s*=\s*["']?([^"'>]+)/iu.exec(tag)?.[1]?.toLowerCase() ?? '', href: /\bhref\s*=\s*["']?([^"'\s>]+)/iu.exec(tag)?.[1],
    size: Number(/\bsizes\s*=\s*["']?(\d+)/iu.exec(tag)?.[1] ?? 0),
  })).filter(link => link.href && /\bicon\b/u.test(link.rel) && !link.rel.includes('mask'));
  const rank = (link: (typeof links)[number]) => (link.href!.endsWith('.svg') ? 1000 : link.size || (link.rel.includes('apple') ? 180 : 16));
  const urls = links.sort((a, b) => rank(b) - rank(a)).flatMap(link => { try { return [new URL(link.href!.replaceAll('&amp;', '&'), page).href]; } catch { return []; } });
  return [...new Set([...urls, new URL('/favicon.ico', page).href])];
}

/** A site's icon: from its own pages, else from the parent domains that serve it (vizier.cds.unistra.fr → cds.unistra.fr, then www.cds.unistra.fr). */
async function siteIcon(host: string): Promise<{ sourceUrl: string; assetUrl: string; image: Buffer } | { sourceUrl: string }> {
  const labels = host.split('.'), parents = labels.slice(0, Math.max(1, labels.length - 1)).map((_, index) => labels.slice(index).join('.'));
  const hosts = [...new Set(parents.flatMap(parent => parent === host || parent.startsWith('www.') ? [parent] : [parent, `www.${parent}`]))];
  for (const candidateHost of hosts) {
    let page = `https://${candidateHost}/`, html = '';
    try { const response = await get(page); if (response.ok) { page = response.url; html = await response.text(); } } catch { /* the conventional location may still answer */ }
    for (const assetUrl of candidates(html, page)) {
      try {
        const response = await get(assetUrl);
        if (!response.ok) continue;
        const image = await prepared(Buffer.from(await response.arrayBuffer()));
        if (image) return { sourceUrl: page, assetUrl, image };
      } catch { /* try the next candidate */ }
    }
  }
  return { sourceUrl: `https://${host}/` };
}

const credits = parseSourceCredits(JSON.parse(await readFile(resolve(root, 'site/prepared-source-credits.json'), 'utf8')));
const all = process.argv.includes('--all'), retry = process.argv.includes('--retry');
const recorded = all ? {} : parseSourceIcons(JSON.parse(await readFile(recordPath, 'utf8').catch(() => '{}')));
const icons: Record<string, SourceIcon> = Object.fromEntries(Object.entries(recorded).filter(([key]) => credits.icons[key]));
const record = () => writeFile(recordPath, `${JSON.stringify(parseSourceIcons(Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)))), null, 2)}\n`);
await mkdir(publicRoot, { recursive: true });
for (const [key, example] of Object.entries(credits.icons).sort(([a], [b]) => a.localeCompare(b))) {
  // A site recorded without an icon is asked again only with --retry, at its recorded address: where a DOI's redirect ends at
  // a checkpoint page instead of the publisher, the publisher's address is corrected in the record by hand.
  const known = icons[key];
  if (known && (known.src || !retry)) continue;
  let host = known ? new URL(known.sourceUrl).host : key;
  if (!known && key.startsWith('doi:')) {
    // doi.org redirects to the publisher; a publisher that refuses the request has still named its host.
    try { host = new URL((await get(example)).url).host; } catch (error) { console.warn(`${key}: ${example} did not resolve (${String(error)}).`); icons[key] = { sourceUrl: example }; await record(); continue; }
  }
  const found = await siteIcon(host);
  if ('image' in found) {
    const file = `${key.replace(/[^a-z0-9]+/gu, '-')}.webp`;
    await writeFile(resolve(publicRoot, file), found.image);
    icons[key] = { src: `/shell/source-icons/${file}`, sourceUrl: found.sourceUrl, assetUrl: found.assetUrl, bytes: found.image.length };
  } else icons[key] = found;
  await record();
  console.log(`${key}: ${icons[key]!.src ?? `no icon at ${host}`}`);
}
// Many hosts are one organisation's (NASA serves a dozen of them): identical icons share the first key's file.
const shared = new Map<string, string>();
for (const [key, icon] of Object.entries(icons).sort(([a], [b]) => a.localeCompare(b))) {
  if (!icon.src) continue;
  const path = resolve(root, 'public', icon.src.slice(1)), bytes = (await readFile(path)).toString('base64'), first = shared.get(bytes);
  if (!first) shared.set(bytes, icon.src);
  else if (first !== icon.src) { icons[key] = { ...icon, src: first }; await rm(path); }
}
await record();
console.log(`Source icons: ${Object.values(icons).filter(icon => icon.src).length} of ${Object.keys(credits.icons).length} sites have one.`);
