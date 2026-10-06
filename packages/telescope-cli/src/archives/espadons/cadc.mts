/** CFHT's ESPaDOnS spectropolarimeter, read through the Canadian Astronomy Data Centre.
 *
 * Two services, both public and anonymous:
 *   - metadata: ADQL over TAP at `argus` (CAOM-2 collection CFHT, instrument ESPaDOnS), with the transaction owned by PyVO;
 *   - files: `raven`, CADC's locator, which answers range requests. A polarimetric product is 20.6 MB of which the header and
 *     the six normalised rows are a quarter, so those two ranges are what is fetched (product.mts).
 *
 * A star's polarimetric products are found by where the telescope pointed, not by the name the observer typed: one star is
 * 'HD 189733', 'HD189733', 'hd189733' and 'hd 189733' in the archive. A product whose typed name is another star's is listed
 * with it and is the caller's to keep or leave. */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tapRows } from '@cssearth/telescope/node';
import { describeProduct, headerOf, NORMALISED_ROWS } from './product.mts';

export const CADC_TAP = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/argus';
export const CADC_FILES = 'https://ws.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/raven/files';
/** A polarimetric product: the odometer of the sequence's first exposure and `p`. */
export const PRODUCT = /^\d{5,8}p$/u;
export const productUri = (product: string) => { if (!PRODUCT.test(product)) throw new TypeError(`${product} is not a polarimetric product id.`); return `cadc:CFHT/${product}.fits`; };

export interface ArchivedProduct { readonly product: string; readonly uri: string; readonly bytes: number; readonly targetName: string; readonly proposal: string;
  /** Start of the sequence and its length, as the archive's catalogue states them. */ readonly mjdStart: number; readonly exposureSeconds: number }

/** Every polarimetric product within `radiusDegrees` of a place, oldest first, optionally inside a span of days. */
export async function polarimetricProducts(raDegrees: number, decDegrees: number, radiusDegrees = 0.02, span?: { readonly fromMjd: number; readonly toMjd: number }): Promise<ArchivedProduct[]> {
  if (![raDegrees, decDegrees, radiusDegrees].every(Number.isFinite) || Math.abs(decDegrees) > 90 || !(radiusDegrees > 0)) throw new RangeError('A search needs a right ascension, a declination and a positive radius in degrees.');
  const rows = await tapRows(CADC_TAP, `SELECT o.target_name, o.proposal_id, p.productID, p.time_bounds_lower, p.time_exposure, a.uri, a.contentLength FROM caom2.Observation o JOIN caom2.Plane p ON o.obsID=p.obsID JOIN caom2.Artifact a ON a.planeID=p.planeID `
    + `WHERE o.collection='CFHT' AND o.instrument_name='ESPaDOnS' AND p.productID LIKE '%p' AND p.calibrationLevel=2 AND a.productType='science' AND INTERSECTS(CIRCLE('ICRS', ${raDegrees}, ${decDegrees}, ${radiusDegrees}), p.position_bounds)=1`
    + `${span ? ` AND p.time_bounds_lower BETWEEN ${span.fromMjd} AND ${span.toMjd}` : ''} ORDER BY p.time_bounds_lower`);
  return rows.filter(row => PRODUCT.test(row.productID ?? '')).map(row => ({ product: row.productID!, uri: row.uri!, bytes: Number(row.contentLength), targetName: row.target_name ?? '', proposal: row.proposal_id ?? '', mjdStart: Number(row.time_bounds_lower), exposureSeconds: Number(row.time_exposure) }));
}

const sizeOf = (path: string) => stat(path).then(info => info.size, () => -1);
async function range(uri: string, from: number, to: number): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(`${CADC_FILES}/${uri}`, { headers: { Range: `bytes=${from}-${to}` }, signal: AbortSignal.timeout(300_000) });
      if (response.status !== 206) throw new Error(`CADC answered ${response.status} to a range request for ${uri}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== to - from + 1) throw new Error(`${uri}: ${bytes.length} bytes of ${to - from + 1}.`);
      return bytes;
    } catch (error) { if (attempt === 4) throw error; }
  }
}

/** The header and the six normalised rows of a pinned product, in `directory` as `<product>.header.txt` and `<product>.rows.bin`:
 * read from there when both are whole, fetched by two range requests otherwise. The archive's file must be its pinned size. */
export async function productFiles(pin: Pick<ArchivedProduct, 'product' | 'uri' | 'bytes'>, directory: string): Promise<{ readonly cards: readonly string[]; readonly rows: Buffer }> {
  if (!PRODUCT.test(pin.product)) throw new TypeError(`${pin.product} is not a polarimetric product id.`);
  const headerPath = resolve(directory, `${pin.product}.header.txt`), rowsPath = resolve(directory, `${pin.product}.rows.bin`);
  if (await sizeOf(headerPath) > 0) { const cards = (await readFile(headerPath, 'utf8')).split('\n'), { pixels } = describeProduct(cards); if (await sizeOf(rowsPath) === NORMALISED_ROWS * pixels * 4) return { cards, rows: await readFile(rowsPath) }; }
  let head = headerOf(await range(pin.uri, 0, 2880 * 40 - 1));
  head ??= headerOf(await range(pin.uri, 0, 2880 * 200 - 1));
  if (!head) throw new Error(`${pin.uri}: no END card in its first 200 header records.`);
  const { pixels, rows: rowCount } = describeProduct(head.cards);
  if (head.dataOffset + Math.ceil(rowCount * pixels * 4 / 2880) * 2880 !== pin.bytes) throw new Error(`${pin.uri}: the header describes a file of ${head.dataOffset + Math.ceil(rowCount * pixels * 4 / 2880) * 2880} bytes, the pin says ${pin.bytes}.`);
  const rows = await range(pin.uri, head.dataOffset, head.dataOffset + NORMALISED_ROWS * pixels * 4 - 1);
  await mkdir(directory, { recursive: true }); await writeFile(rowsPath, rows); await writeFile(headerPath, head.cards.join('\n'));
  return { cards: head.cards, rows };
}
