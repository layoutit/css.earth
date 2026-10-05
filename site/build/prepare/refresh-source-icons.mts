/** Finds the favicon of each site the Sources tab links to and records its address in `site/source/source-icons.json`. The
 * rows load each icon from its own site: no copy of a site's mark is kept in the repository or served by cssEarth. A key is a
 * link's host, or a DOI registrant prefix, which is resolved to its publisher's site through one of its DOIs. Keys already
 * recorded are kept, so a run after new sources arrive asks only the new sites; `--retry` asks the sites recorded without an
 * icon again and `--all` asks every site again.
 *
 * Run: node site/build/prepare/refresh-source-icons.mts [--retry] [--all] */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { parseSourceCredits } from '@cssearth/objects/provenance';
import { parseSourceIcons, type SourceIcon } from '../../content/source-icons.mts';

const TIMEOUT_MS = 20_000;
const HEADERS = { 'user-agent': 'Mozilla/5.0 (compatible; cssEarth source icons; +https://css.earth)', accept: '*/*' };

const root = projectRoot(import.meta.url);
const recordPath = resolve(root, 'site/source/source-icons.json');

const get = (url: string) => fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });

/** Whether the bytes are an image a browser draws: PNG, ICO, GIF, JPEG, WebP or SVG. A refusal page is HTML. */
function isImage(bytes: Buffer): boolean {
  const start = bytes.subarray(0, 12).toString('latin1');
  return start.startsWith('\x89PNG') || start.startsWith('\x00\x00\x01\x00') || start.startsWith('GIF8') || start.startsWith('\xff\xd8')
    || (start.startsWith('RIFF') && start.endsWith('WEBP')) || /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/u.test(bytes.subarray(0, 2048).toString('utf8'));
}

/** Icon links a page declares, the largest first, then the conventional location. */
function candidates(html: string, page: string): string[] {
  const links = [...html.matchAll(/<link\b[^>]*>/giu)].map(([tag]) => ({
    rel: /\brel\s*=\s*["']?([^"'>]+)/iu.exec(tag)?.[1]?.toLowerCase() ?? '', href: /\bhref\s*=\s*["']?([^"'\s>]+)/iu.exec(tag)?.[1],
    size: Number(/\bsizes\s*=\s*["']?(\d+)/iu.exec(tag)?.[1] ?? 0),
  })).filter(link => link.href && /\bicon\b/u.test(link.rel) && !link.rel.includes('mask'));
  const rank = (link: (typeof links)[number]) => (link.href!.endsWith('.svg') ? 1000 : link.size || (link.rel.includes('apple') ? 180 : 16));
  const urls = links.sort((a, b) => rank(b) - rank(a)).flatMap(link => { try { return [new URL(link.href!.replaceAll('&amp;', '&'), page).href]; } catch { return []; } });
  // An address that carries a content fingerprint changes with the site's next deploy: it would not last as a recorded link.
  return [...new Set([...urls, new URL('/favicon.ico', page).href])].filter(url => !/[0-9a-f]{32,}/iu.test(url));
}

/** A site's icon: from its own pages, else from the parent domains that serve it (vizier.cds.unistra.fr → cds.unistra.fr, then www.cds.unistra.fr). */
async function siteIcon(host: string): Promise<SourceIcon> {
  const labels = host.split('.'), parents = labels.slice(0, Math.max(1, labels.length - 1)).map((_, index) => labels.slice(index).join('.'));
  const hosts = [...new Set(parents.flatMap(parent => parent === host || parent.startsWith('www.') ? [parent] : [parent, `www.${parent}`]))];
  for (const candidateHost of hosts) {
    let page = `https://${candidateHost}/`, html = '';
    try { const response = await get(page); if (response.ok) { page = response.url; html = await response.text(); } } catch { /* the conventional location may still answer */ }
    for (const assetUrl of candidates(html, page)) {
      try {
        const response = await get(assetUrl);
        if (!response.ok) continue;
        // A secure page loads only https images.
        if (response.url.startsWith('https://') && isImage(Buffer.from(await response.arrayBuffer()))) return { sourceUrl: page, assetUrl: response.url };
      } catch { /* try the next candidate */ }
    }
  }
  return { sourceUrl: `https://${host}/` };
}

const credits = parseSourceCredits(JSON.parse(await readFile(resolve(root, 'site/prepared-source-credits.json'), 'utf8')));
const all = process.argv.includes('--all'), retry = all || process.argv.includes('--retry');
const recorded = parseSourceIcons(JSON.parse(await readFile(recordPath, 'utf8').catch(() => '{}')));
// --all keeps each recorded address, which may be a correction, and asks it again.
const icons: Record<string, SourceIcon> = Object.fromEntries(Object.entries(recorded).filter(([key]) => credits.icons[key])
  .map(([key, icon]) => [key, all ? { sourceUrl: icon.sourceUrl } : icon]));
const record = () => writeFile(recordPath, `${JSON.stringify(parseSourceIcons(Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)))), null, 2)}\n`);
for (const [key, example] of Object.entries(credits.icons).sort(([a], [b]) => a.localeCompare(b))) {
  // A site recorded without an icon is asked again only with --retry, at its recorded address: where a DOI's redirect ends at
  // a checkpoint page instead of the publisher, the publisher's address is corrected in the record by hand.
  const known = icons[key];
  if (known && (known.assetUrl || !retry)) continue;
  let host = known ? new URL(known.sourceUrl).host : key;
  if (!known && key.startsWith('doi:')) {
    // doi.org redirects to the publisher; a publisher that refuses the request has still named its host.
    try { host = new URL((await get(example)).url).host; } catch (error) { console.warn(`${key}: ${example} did not resolve (${String(error)}).`); icons[key] = { sourceUrl: example }; await record(); continue; }
  }
  icons[key] = await siteIcon(host);
  await record();
  console.log(`${key}: ${icons[key]!.assetUrl ?? `no icon at ${host}`}`);
}
await record();
console.log(`Source icons: ${Object.values(icons).filter(icon => icon.assetUrl).length} of ${Object.keys(credits.icons).length} sites have one.`);
