#!/usr/bin/env node
/** What the ALMA Science Archive holds for one member observing unit set, and how to take one file out of it.
 *
 *   node tools/objects/interferometry/alma-archive.mts <member OUS uid>
 *
 * The archive's delivery unit is a tar: the products of one member OUS are one tarball of tens of gigabytes, and the raw
 * visibilities of one execution are another. Astroquery reads ALMA's IVOA DataLink service, which lists and serves any single
 * file on its own, so a continuum image is a 30 MB fetch instead of a 77 GB one. This module selects among those normalized
 * rows; it owns no DataLink transport or VOTable parser. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { astroqueryRows } from '@cssearth/telescope/node';

export interface DatalinkRow { readonly id: string; readonly url: string; readonly semantics: string; readonly description: string; readonly contentType: string; readonly bytes: number | null; readonly serviceDef: string }
export interface MemberProducts {
  /** The product tarball's datalink id, through which its individual files are listed. */
  readonly productListing: string | null;
  readonly auxiliary: DatalinkRow | null;
  readonly readme: DatalinkRow | null;
  /** The raw visibilities of each execution block, largest last. */
  readonly raw: readonly DatalinkRow[];
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

function dataInfoRow(value: unknown): DatalinkRow {
  const row = requireRecord(value, 'ALMA data-info row'), length = row.content_length;
  return { id: requireString(row.ID ?? row.id ?? '', 'ALMA data-info id'), url: requireString(row.access_url ?? '', 'ALMA access URL'),
    semantics: requireString(row.semantics ?? '', 'ALMA semantics'), description: requireString(row.description ?? '', 'ALMA description'),
    contentType: requireString(row.content_type ?? '', 'ALMA content type'),
    bytes: length === null || length === undefined || length === '' ? null : requireFiniteNumber(length, 'ALMA content length'),
    serviceDef: requireString(row.service_def ?? '', 'ALMA service definition') };
}

/** ALMA DataLink enumeration through Astroquery. */
export async function almaDataInfo(ids: readonly string[], expandTarfiles = false): Promise<DatalinkRow[]> {
  return (await astroqueryRows({ operation: 'alma-data-info', ids, expandTarfiles })).map(dataInfoRow);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const uid = process.argv[2];
  if (!uid) throw new TypeError('Usage: alma-archive.mts <member OUS uid> [target]');
  const rows = await almaDataInfo([uid]);
  const products = memberProducts(rows);
  const gb = (bytes: number | null) => bytes === null ? '     ?' : `${(bytes / 1e9).toFixed(2)} GB`;
  console.log(`${uid}`);
  console.log(`  auxiliary   ${gb(products.auxiliary?.bytes ?? null)}  ${products.auxiliary?.url.split('/').at(-1) ?? 'none'}`);
  for (const raw of products.raw) console.log(`  raw         ${gb(raw.bytes)}  ${raw.url.split('/').at(-1)}`);
  if (products.productListing) {
    const files = await almaDataInfo([products.productListing]);
    const target = process.argv[3];
    if (target) { const image = continuumImage(files, target); console.log(`  continuum   ${gb(image.bytes)}  ${image.url.split('/').at(-1)}`); }
    else console.log(`  ${files.length} product files`);
  }
}
