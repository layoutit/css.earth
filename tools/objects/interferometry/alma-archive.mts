#!/usr/bin/env node
/** What the ALMA Science Archive holds for one member observing unit set, and how to take one file out of it.
 *
 *   node tools/objects/interferometry/alma-archive.mts <member OUS uid>
 *
 * The archive's delivery unit is a tar: the products of one member OUS are one tarball of tens of gigabytes, and the raw
 * visibilities of one execution are another. Both are listed file by file through the IVOA datalink service, which serves any
 * single file on its own, so a continuum image is a 30 MB fetch instead of a 77 GB one. This module reads those listings; it
 * fetches nothing on its own.
 *
 * The listing is a VOTable. Only the rows are read, and only the fields this route uses, so a service that adds columns still
 * parses. The archive states `Accept-Ranges: bytes` and answers 416 to every range this route tried on three of its mirrors,
 * so a large file is fetched in one stream. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export interface DatalinkRow { readonly id: string; readonly url: string; readonly semantics: string; readonly description: string; readonly contentType: string; readonly bytes: number | null; readonly serviceDef: string }
export interface MemberProducts {
  /** The product tarball's datalink id, through which its individual files are listed. */
  readonly productListing: string | null;
  readonly auxiliary: DatalinkRow | null;
  readonly readme: DatalinkRow | null;
  /** The raw visibilities of each execution block, largest last. */
  readonly raw: readonly DatalinkRow[];
}

const FIELD = /<FIELD\b[^>]*\bname="([^"]+)"/gu;
const ROW = /<TR>([\s\S]*?)<\/TR>/gu;
const CELL = /<TD>([\s\S]*?)<\/TD>|<TD\s*\/>/gu;

function unescapeXml(text: string) {
  return text.replace(/&(lt|gt|amp|quot|apos|#39);/gu, (_, name: string) =>
    ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", '#39': "'" }[name] ?? name));
}

/** Every row of a datalink VOTable, addressed by the field names the document declares. */
export function parseDatalink(xml: string): DatalinkRow[] {
  const names: string[] = [];
  for (const match of xml.matchAll(FIELD)) names.push(match[1]!);
  if (!names.includes('access_url') || !names.includes('semantics')) throw new TypeError('A datalink response declares access_url and semantics.');
  const rows: DatalinkRow[] = [];
  for (const row of xml.matchAll(ROW)) {
    const cells: string[] = [];
    for (const cell of row[1]!.matchAll(CELL)) cells.push(unescapeXml(cell[1] ?? '').trim());
    if (cells.length !== names.length) throw new TypeError(`A datalink row has ${cells.length} cells for ${names.length} fields.`);
    const at = (name: string) => cells[names.indexOf(name)] ?? '';
    const length = at('content_length');
    rows.push({ id: at('ID'), url: at('access_url'), semantics: at('semantics'), description: at('description'),
      contentType: at('content_type'), bytes: length === '' ? null : Number(length), serviceDef: at('service_def') });
  }
  return rows;
}

/** The delivery this route needs from a member listing: where the products are listed, the auxiliary tar that carries the
 * calibration, and the raw visibilities. A row with no url is a nested service, and its service_def is the listing id. */
export function memberProducts(rows: readonly DatalinkRow[]): MemberProducts {
  const named = (row: DatalinkRow) => row.url.split('/').at(-1) ?? '';
  // The nested listing is addressed by the product tarball's own name; the service_def row prefixes it with "DataLink.".
  const product = rows.find(row => row.semantics === '#this' && row.url && /_\d+_of_\d+\.tar$/u.test(named(row)));
  const auxiliary = rows.find(row => row.semantics === '#auxiliary' && named(row).endsWith('_auxiliary.tar')) ?? null;
  const readme = rows.find(row => named(row).endsWith('README.txt')) ?? null;
  const raw = rows.filter(row => named(row).endsWith('.asdm.sdm.tar') && row.url)
    .sort((a, b) => (a.bytes ?? 0) - (b.bytes ?? 0));
  // One execution of one member is the smallest complete thing this route can restore.
  if (!raw.length) throw new TypeError('The member listing carries no raw visibilities.');
  return { productListing: product ? named(product) : null, auxiliary, readme, raw };
}

/** The science image a product listing carries for one target: the pipeline's own continuum, which this route reproduces. */
export function continuumImage(rows: readonly DatalinkRow[], target: string) {
  const wanted = new RegExp(`${target.replaceAll('.', '\\.')}_sci\\.spw[\\d_]+\\.cont(?:\\.selfcal|\\.regcal)?\\.I(?:\\.tt0)?\\.pbcor\\.fits$`, 'u');
  const images = rows.filter(row => wanted.test(row.url.split('/').at(-1) ?? ''));
  if (!images.length) throw new TypeError(`The product listing carries no continuum image for ${target}.`);
  // A self-calibrated image is the one the archive presents as its result when it made one.
  const preference = (row: DatalinkRow) => (row.url.includes('.selfcal.') ? 0 : row.url.includes('.regcal.') ? 1 : 2);
  return [...images].sort((a, b) => preference(a) - preference(b))[0]!;
}

export const DATALINK = 'https://almascience.eso.org/datalink/sync?ID=';
export const datalinkUrl = (id: string) => DATALINK + encodeURIComponent(id);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const uid = process.argv[2];
  if (!uid) throw new TypeError('Usage: alma-archive.mts <member OUS uid> [target]');
  const rows = parseDatalink(await (await fetch(datalinkUrl(uid))).text());
  const products = memberProducts(rows);
  const gb = (bytes: number | null) => bytes === null ? '     ?' : `${(bytes / 1e9).toFixed(2)} GB`;
  console.log(`${uid}`);
  console.log(`  auxiliary   ${gb(products.auxiliary?.bytes ?? null)}  ${products.auxiliary?.url.split('/').at(-1) ?? 'none'}`);
  for (const raw of products.raw) console.log(`  raw         ${gb(raw.bytes)}  ${raw.url.split('/').at(-1)}`);
  if (products.productListing) {
    const files = parseDatalink(await (await fetch(datalinkUrl(products.productListing))).text());
    const target = process.argv[3];
    if (target) { const image = continuumImage(files, target); console.log(`  continuum   ${gb(image.bytes)}  ${image.url.split('/').at(-1)}`); }
    else console.log(`  ${files.length} product files`);
  }
}
