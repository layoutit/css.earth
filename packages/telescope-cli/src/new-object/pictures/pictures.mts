/** `telescope new-object` for published pictures: draft a spec from ESA's picture pages, write each entry's layer bank
 * and its page's dataset, and bake them. One entry is one picture on a page that already shows a shaped bank
 * (picture-bank.mts); the spec may be run again, and what a person wrote beside the records (the README) is kept. */
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { fetchPublication, type Archive } from '../archives/archives.mts';
import { publicationRecord } from '../publication-record.mts';
import { TODO } from '../scaffold.mts';
import { esaPictureAddress, readEsaPage, skyTags, type EsaPage } from './esa-image.mts';
import { colorsPhrase, pageColors, parsePictures, pictureFiles, type PictureEntry } from './picture-bank.mts';
import { lightReachPixels, locateStar, registerPicture, taggedPixel, type Place } from './registration.mts';

interface Context { readonly root: string; readonly archive: Archive; readonly progress: (line: string) => void }
export interface PictureResult { readonly id: string; readonly host: string; readonly dataset: string; readonly files: number; readonly todo: readonly string[]; readonly failed?: string }
type Json = Record<string, unknown>;

const exists = (path: string) => stat(path).then(() => true, () => false);
const reason = (error: unknown) => (error as Error).message.split('\n')[0]!;
const readJson = async (root: string, path: string, what: string): Promise<Json> => { let text: string; try { text = await readFile(resolve(root, path), 'utf8'); } catch { throw new Error(`${what}: ${path} does not exist.`); } return requireRecord(JSON.parse(text), path); };
/** What a reader calls an instrument's light, for a draft's dataset id and label; the instrument's own name otherwise. */
const LIGHT: Readonly<Record<string, string>> = { NIRCam: 'near infrared', MIRI: 'mid infrared' };

/** The publisher's JPEG, read once: kept in the ignored `output/new-object/pictures/` between a draft and its run. */
async function pictureBytes(page: EsaPage, { root, archive, progress }: Context) {
  const kept = resolve(root, 'output/new-object/pictures', `${page.id}.jpg`);
  if (await exists(kept)) return readFile(kept);
  progress(`  ${page.id}: reading ${page.download}`);
  const bytes = await archive.bytes(page.download);
  await mkdir(dirname(kept), { recursive: true }); await writeFile(kept, bytes);
  return bytes;
}
async function pictureOnSky(page: EsaPage, target: Place, context: Context) {
  const bytes = await pictureBytes(page, context), { data, info } = await sharp(bytes, { limitInputPixels: false }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error(`${page.download}: a picture of ${info.channels} channel(s), not a color picture.`);
  const tags = skyTags(bytes, info.width, info.height, page.download);
  return { bytes, tags, rgb: data, dimensions: [info.width, info.height] as const, tagged: taggedPixel(tags, info.height, target) };
}
const bankOf = (content: Json, host: string) => { const datasets = requireRecord(content.datasets, `${host} content datasets`), controls = requireArray(datasets.controls, `${host} dataset controls`).map(control => requireRecord(control, `${host} dataset control`));
  const shown = [controls.find(control => control.id === datasets.defaultDataset), ...controls].find(control => isRecord(control?.volume));
  if (!shown) throw new Error(`${host}: the page shows no layer bank a picture could lie on like.`);
  return requireString(requireRecord(shown.volume, `${host} dataset volume`).objectId, `${host} dataset volume.objectId`); };

/** `--from-esa HOST=PAGE...`: one entry a picture, on the walls of the bank its page opens on, with the star the picture
 * shows at the page's place. The sentences a reader sees are left to write. */
export async function draftsFromEsa(names: readonly string[], context: Context): Promise<{ readonly stars: readonly unknown[]; readonly pictures: readonly unknown[]; readonly report: readonly string[] }> {
  const pictures: unknown[] = [], report: string[] = [];
  for (const asked of names) {
    try {
      const [host, address] = asked.split(/=(.*)/su) as [string, string | undefined];
      if (!address) throw new Error(`${asked}: name a page and its picture as HOST=https://esawebb.org/images/<id>/.`);
      const page = await readEsaPage(address, context.archive), like = bankOf(await readJson(context.root, `src/objects/${host}/source/content/object.json`, `${host}: no such page`), host);
      const target = requireRecord((await readJson(context.root, `src/objects/${like}/source/recipe.json`, `${like}: not a layer bank`)).target, `${like} recipe target`) as unknown as Place;
      const sky = await pictureOnSky(page, target, context), pixelArcsec = sky.tags.scaleDeg * 3600, star = locateStar(sky.rgb, ...sky.dimensions, pixelArcsec, sky.tagged);
      const stands = star?.pixel ?? sky.tagged, registered = registerPicture(sky.tags, sky.dimensions, stands, target, lightReachPixels(sky.rgb, ...sky.dimensions, stands));
      const name = requireString((await readJson(context.root, `src/objects/${like}/source/presentation.json`, like)).name, `${like} presentation name`), colors = pageColors(page.colors);
      const instruments = [...new Set(page.colors.map(color => color.instrument).filter(Boolean))], light = instruments.length === 1 ? LIGHT[instruments[0]!] ?? instruments[0]! : instruments.join(' + ');
      const slug = (words: string) => words.toLowerCase().replace(/[^a-z0-9]+/gu, '-'), write = (what: string) => `${TODO}: ${what}`;
      pictures.push({ host, image: page.page, bank: `${host}-${slug(instruments.join(' '))}-layers`, like,
        dataset: { id: slug(light), label: `${page.telescope} · ${light}`, title: write('the dataset\'s title'), summary: write('one sentence under the title'), description: write('what the picture shows and what it lies on') },
        colors, ...(star ? { star: star.pixel.map(value => Number(value.toFixed(1))), starFound: star.found } : {}), geometry: {}, sources: [], ledger: [] });
      report.push(`${page.id} on ${host}, like ${like}: ${page.title}; ${sky.dimensions.join(' x ')} px, ${instruments.join(' and ')} at ${colorsPhrase(colors)}. ` + (star
        ? `The star: ${star.found}, at ${star.pixel.map(value => value.toFixed(1)).join(', ')}, ${(Math.hypot(star.pixel[0] - sky.tagged[0], star.pixel[1] - sky.tagged[1]) * pixelArcsec).toFixed(2)} arcsec from where the tags put the page's place. Remove "star" and "starFound" where the page stands at no star.`
        : 'No star near the page\'s place: the picture is placed by its tags.')
        + (registered.rimAt === 'light' ? ` The picture does not fill its frame: its own light reaches ${registered.circleArcsec} arcsec from that place, and the rim fades there.` : '') + ` What its colors show: telescope papers ${JSON.stringify(name)} --instrument ${instruments[0]}`);
    } catch (error) { report.push(`${asked}: not drafted: ${reason(error)}`); }
  }
  return { stars: [], pictures, report };
}

/** A record in src/sources for every source an entry cites: the one there, or one read from arXiv or Crossref by its link. */
async function sourceRecords(entry: PictureEntry, { root, archive }: Context) {
  const records = new Map<string, string>();
  for (const source of entry.sources) {
    const path = `src/sources/${source.catalogueId}.json`;
    if (await exists(resolve(root, path))) continue;
    const publication = /arxiv\.org\/abs\/|doi\.org\//u.test(source.url) ? await fetchPublication(archive, source.url) : undefined;
    if (!publication) throw new Error(`${entry.bank}: ${path} does not exist, and ${source.url} is not an arXiv or DOI link to write it from.`);
    records.set(path, `${JSON.stringify(publicationRecord({ ...publication, id: source.catalogueId }), null, 2)}\n`);
  }
  return records;
}

/** Write one entry: its bank's records, picture and other inputs, and its page's dataset. */
async function writePicture(entry: PictureEntry, context: Context): Promise<PictureResult> {
  const { root } = context, at = `src/objects/${entry.bank}`, inTree = (path: string) => resolve(root, path);
  const page = await readEsaPage(entry.image, context.archive);
  if (await exists(inTree(at))) { const made = await readJson(root, `${at}/source/recipe.json`, `${entry.bank} exists and is not a layer bank`);
    if (requireRecord(made.source, `${entry.bank} recipe source`).publisherUrl !== page.page) throw new Error(`${at} already exists and shows another picture; the generator rewrites only the records of the picture it is given.`); }
  if (entry.like === entry.bank) throw new Error(`${entry.bank}: a bank cannot be like itself.`);
  const like = { recipe: await readJson(root, `src/objects/${entry.like}/source/recipe.json`, `${entry.like}: not a layer bank`), manifest: await readJson(root, `src/objects/${entry.like}/source/manifest.json`, entry.like),
    presentation: await readJson(root, `src/objects/${entry.like}/source/presentation.json`, entry.like), provenance: await readJson(root, `src/objects/${entry.like}/source/provenance.json`, entry.like) };
  const host = { content: await readJson(root, `src/objects/${entry.host}/source/content/object.json`, `${entry.host}: no such page`), text: await readJson(root, `src/objects/${entry.host}/text.json`, entry.host) };
  const sky = await pictureOnSky(page, requireRecord(like.recipe.target, `${entry.like} recipe target`) as unknown as Place, context), records = await sourceRecords(entry, context);
  const { files, readme, carried, todo } = pictureFiles(entry, { page, tags: sky.tags, dimensions: sky.dimensions, tagged: sky.tagged, lightReach: at => lightReachPixels(sky.rgb, ...sky.dimensions, at), like, host, checked: new Date().toISOString().slice(0, 10) });
  for (const { from } of carried) if (!await exists(inTree(from))) throw new Error(`${entry.bank}: ${from}, which the ${entry.like} bank reads, is not restored; its manifest names where it comes from.`);
  let written = 0;
  const put = async (path: string, value: string | Buffer) => { await mkdir(dirname(inTree(path)), { recursive: true }); await writeFile(inTree(path), value); written++; };
  for (const [path, value] of [...files, ...records]) if (!path.startsWith('src/sources/') || !await exists(inTree(path))) await put(path, value);
  if (!await exists(inTree(`${at}/README.md`))) await put(`${at}/README.md`, readme);
  await put(`${at}/source/source.jpg`, sky.bytes);
  // The like bank's other inputs stand beside this bank too; one that Git ignores there is ignored here.
  const ignore = inTree('.gitignore'), ignored = (await readFile(ignore, 'utf8')).split('\n');
  for (const { from, to } of carried) { await copyFile(inTree(from), inTree(to)); written++;
    if (ignored.includes(from) && !ignored.includes(to)) { ignored.splice(ignored.indexOf(from) + 1, 0, `# The same file beside the ${entry.bank} bank; restored from the same origin (${at}/source/manifest.json).`, to); await writeFile(ignore, ignored.join('\n')); } }
  // What is left for a person: the bank's README while it holds a line to write, and the page's README until it names the bank.
  const holds = async (path: string, words: string) => (await readFile(inTree(path), 'utf8').catch(() => '')).includes(words), left = [await holds(`${at}/README.md`, TODO), !await holds(`src/objects/${entry.host}/README.md`, `../${entry.bank}/`)];
  return { id: entry.bank, host: entry.host, dataset: entry.dataset.id, files: written, todo: todo.filter((_, index) => left[index]) };
}

/** Every picture of a spec file, written. One that fails is reported with its reason and the rest go on. */
export async function runPictures(specPath: string, context: Context): Promise<PictureResult[]> {
  const entries = parsePictures(JSON.parse(await readFile(resolve(specPath), 'utf8'))), results: PictureResult[] = [];
  for (const entry of entries) {
    try { esaPictureAddress(entry.image); results.push(await writePicture(entry, context)); context.progress(`  ${entry.bank}: written`); }
    catch (error) { results.push({ id: entry.bank, host: entry.host, dataset: entry.dataset.id, files: 0, todo: [], failed: reason(error) }); context.progress(`  ${entry.bank}: FAILED, not written: ${reason(error)}`); }
  }
  return results;
}

/** Bake the banks and their pages: each bank's layers and presentation, each page's hosted context, then the pages'
 * prepared files in one run (the reader-text step checks every page against its prepared datasets), the catalogue and the
 * world. Stops at the first step that fails. */
export async function bakePictures(results: readonly PictureResult[], { root, progress }: Pick<Context, 'root' | 'progress'>): Promise<boolean> {
  const banks = results.map(result => result.id), hosts = [...new Set(results.map(result => result.host))], node = (...args: string[]) => ['node', ...args];
  const steps = [node('packages/bake/cli/check-stale-builds.mts', '--run'), ...banks.flatMap(bank => [node('packages/bake/cli/prepare-image-layers.mts', `src/objects/${bank}`), node('site/build/prepare/prepare-volume-presentation.mts', `--object=${bank}`)]),
    ...hosts.map(host => node('site/build/prepare/companion-context.mts', host)), node('packages/bake/cli/prepare-object.mts', ...hosts, '--from', 'catalogue', '--to', 'markers'), node('site/build/prepare/prepare-catalog.mts'),
    node('packages/bake/cli/prepare-object.mts', ...hosts, '--from', 'world'), node('packages/bake/cli/prepare-navigation.mts', '--catalog-only')];
  for (const [command, ...args] of steps as [string, ...string[]][]) {
    progress(`== ${args.join(' ')}`);
    // A step's own output is progress: it goes where the telescope's does, and the result text stays the telescope's.
    const code = await new Promise<number | null>(done => { spawn(command, args, { cwd: root, stdio: ['ignore', 2, 2] }).on('error', () => done(null)).on('close', done); });
    if (code !== 0) { progress(`FAILED: ${command} ${args.join(' ')}`); return false; }
  }
  return true;
}

export const formatPictures = (results: readonly PictureResult[], spec: string, baked: boolean) => `${results.map(result => result.failed ? `${result.id} (picture): FAILED, not written: ${result.failed}`
  : `${result.id} (picture, the ${result.dataset} dataset of ${result.host}): ${result.files} files.${result.todo.length ? `\n  Still to write: ${result.todo.join('; ')}.` : ''}`).join('\n')}\n${baked ? `${results.filter(result => !result.failed).length} picture(s) baked.` : `Then bake: telescope new-object ${spec} --bake`}\n`;
