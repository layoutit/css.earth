/** A picture ESA publishes for Hubble or Webb (esahubble.org, esawebb.org): what its page says of it, and the sky tags
 * its JPEG carries. The page gives the title, the credit, the release date and the colors; the file gives its own size,
 * and in its embedded Astronomy Visualization Metadata the scale, the direction of north and one place on the sky. */
import { decodeEntities } from '../orbit.mts';
import type { Archive } from '../archives/archives.mts';

/** A JPEG's sky tags, for the file as downloaded: degrees a pixel, north's turn counter-clockwise from up, and the sky
 * place (right ascension, declination) of one pixel, counted from the picture's bottom left. */
export interface SkyTags { readonly scaleDeg: number; readonly rotationDeg: number; readonly reference: readonly [number, number]; readonly referencePixel: readonly [number, number] }
export interface PictureColor { readonly band: string; readonly shown: string; readonly line?: string; readonly wavelength: string; readonly instrument: string }
export interface EsaPage { readonly id: string; readonly telescope: 'Hubble' | 'Webb'; readonly page: string; readonly download: string; readonly rights: string;
  readonly title: string; readonly credit: string; readonly released: string; readonly original: readonly [number, number]; readonly colors: readonly PictureColor[] }

const SITES: Readonly<Record<string, EsaPage['telescope']>> = { 'esahubble.org': 'Hubble', 'esawebb.org': 'Webb' };
const words = (html: string) => decodeEntities(html.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim();

/** The picture a page address names: `https://esawebb.org/images/weic2320c/`. */
export function esaPictureAddress(address: string): Pick<EsaPage, 'id' | 'telescope' | 'page' | 'download' | 'rights'> {
  const found = /^https:\/\/(esahubble\.org|esawebb\.org)\/images\/([a-z0-9-]+)\/?$/u.exec(address);
  if (!found) throw new TypeError(`${JSON.stringify(address)} is not a picture's page at esahubble.org or esawebb.org (https://esawebb.org/images/<id>/).`);
  const [, site, id] = found as unknown as [string, string, string];
  return { id, telescope: SITES[site]!, page: `https://${site}/images/${id}/`, download: `https://cdn.${site}/archives/images/large/${id}.jpg`, rights: `https://${site}/copyright/` };
}

/** What a picture's page says of it. A field the page lacks is refused by name: the generator writes none of them itself. */
export function parseEsaPage(address: string, html: string): EsaPage {
  const picture = esaPictureAddress(address), lacks = (what: string): never => { throw new TypeError(`${picture.page}: the page has no ${what} to read.`); };
  const lines = html.replace(/<script[\s\S]*?<\/script>/gu, '').replace(/<[^>]*>/gu, '\n').split('\n').map(words).filter(Boolean);
  const after = (label: string) => lines[lines.indexOf(label) + 1] ?? '';
  const title = words(/<title>([^<]*)<\/title>/u.exec(html)?.[1] ?? '').split(' | ')[0]! || lacks('title');
  const credit = words(/<div class="credit">([\s\S]*?)<\/div>/u.exec(html)?.[1] ?? '').replace(/\.$/u, '') || lacks('credit');
  const size = /^(\d+) x (\d+) px$/u.exec(lines.includes('Size:') ? after('Size:') : '') ?? lacks('"Size: W x H px"');
  const released = /^\d{1,2} [A-Z][a-z]+ \d{4}/u.exec(lines.includes('Release date:') ? after('Release date:') : '')?.[0] ?? lacks('release date');
  // The colors table: a row is the band with the color it is shown in and the line's name where the page gives one, the wavelength, and the telescope with its instrument.
  const table = /<h3[^>]*>Colours &(?:amp;)? filters<\/h3>\s*<table[\s\S]*?<\/table>/u.exec(html)?.[0] ?? '', colors: PictureColor[] = [];
  for (const row of table.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)) {
    const cells = [...row[1]!.matchAll(/<td>([\s\S]*?)<\/td>/gu)].map(cell => cell[1]!);
    if (cells.length !== 3) continue;
    const [band, wavelength, facility] = cells as [string, string, string], line = words(/class="band_instrument">([\s\S]*?)<\/span>/u.exec(band)?.[1] ?? '');
    const [, instrument = ''] = facility.split(/<br\s*\/?>/u).map(words);
    colors.push({ band: words(band).split(' ')[0]!, shown: /class="band_([A-Za-z]+)"/u.exec(band)?.[1] ?? '', ...(line ? { line } : {}), wavelength: words(wavelength), instrument });
  }
  if (!colors.length) lacks('"Colours & filters" table');
  return { ...picture, title, credit, released, original: [Number(size[1]), Number(size[2])], colors };
}

/** The sky tags in a JPEG's bytes, for a file `width` pixels across: a publisher's smaller copy carries the tags of its
 * original, whose scale and reference pixel are brought to this file's own pixels. */
export function skyTags(bytes: Buffer, width: number, height: number, name: string): SkyTags {
  const text = bytes.toString('latin1');
  const tag = (key: string, count: number) => { const found = new RegExp(`<avm:${key}>([\\s\\S]*?)</avm:${key}>`, 'u').exec(text) ?? new RegExp(`avm:${key}="([^"]*)"`, 'u').exec(text);
    const values = found?.[1]!.replace(/<[^>]+>/gu, ' ').trim().split(/\s+/u).map(Number) ?? [];
    if (values.length < count || !values.slice(0, count).every(Number.isFinite)) throw new TypeError(`${name} carries no avm:${key}: the picture has no sky tags to place it by.`);
    return values; };
  const [taggedWidth, taggedHeight] = tag('Spatial.ReferenceDimension', 2) as [number, number], shrink = taggedWidth / width;
  if (Math.abs(taggedHeight / shrink - height) > 1) throw new TypeError(`${name} is ${width} x ${height} px; its sky tags describe ${taggedWidth} x ${taggedHeight}, another shape.`);
  const pixel = tag('Spatial.ReferencePixel', 2), place = tag('Spatial.ReferenceValue', 2);
  return { scaleDeg: Math.abs(tag('Spatial.Scale', 1)[0]!) * shrink, rotationDeg: tag('Spatial.Rotation', 1)[0]!, reference: [place[0]!, place[1]!], referencePixel: [pixel[0]! / shrink, pixel[1]! / shrink] };
}

/** A picture's page, read through the telescope's archive transfer. */
export async function readEsaPage(address: string, archive: Archive): Promise<EsaPage> {
  return parseEsaPage(address, await archive.text(esaPictureAddress(address).page));
}
