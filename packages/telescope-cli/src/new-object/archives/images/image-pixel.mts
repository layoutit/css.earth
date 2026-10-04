/** A star a paper lists by its detector pixel, not by a sky position (spec `position` with `archive: "mast"`): the HST Cepheid
 * papers of the 1990s and 2000s print each star's chip, X and Y on one archived exposure. The star is placed where that
 * exposure's own world coordinates put the pixel, read with `@cssearth/fits` (TAN, with the SIP distortion a detector frame carries).
 *
 * Only header records are read from MAST, by byte range, up to the named extension; that extension's header is then asked for
 * once more as the one range the package keeps, so the archived bytes are exactly what a restore fetches and the image itself is
 * never downloaded (a WFPC2 exposure is 10 MB; one of its headers is 11,520 bytes).
 *
 * The position is the exposure's pointing as archived. It is not registered against a reference catalogue, so it carries the
 * telescope's pointing error of the day: through u6fv0101m_c0m.fits, SN 1999em (chip 4, pixel 213.1, 407.8 in Leonard et al.
 * 2003) falls 1.2" from SIMBAD's position of it (checked 2026-10-04). */
import { readFitsHeader, skyProjection } from '@cssearth/fits';
import { locateFitsHdus } from '@cssearth/fits/node';
import { mastDownloadUrl } from '@cssearth/telescope/node';
import type { CataloguePosition } from '../../spec.mts';
import type { Archive, CatalogueRow } from '../archives.mts';

/** Header records asked for at a time: eight (23,040 bytes) hold an HST primary header, or an extension's, in one request. */
const HEADER_READ = 8 * 2880;

/** The zero-based pixel of a paper's coordinate, whose first pixel is centred on `firstPixel`: 0.5 for HSTphot and DOLPHOT (an integer
 * is a pixel's lower-left corner), 1 for DAOPHOT, IRAF and FITS, 0 for zero-based software. */
export const zeroBased = (coordinate: number, firstPixel: number) => coordinate - firstPixel;

interface Located { readonly kept: Buffer; readonly range: { readonly offset: number; readonly length: number }; readonly dimensions: readonly number[] }
/** The headers already located in this run, by archive, product and extension: the stars of one table sit on the same few chips. */
const located = new WeakMap<Archive, Map<string, Promise<Located>>>();

/** One extension's header of a MAST product, found by reading header records only and then fetched alone, as a restore fetches it. */
async function locate(archive: Archive, url: string, extension: string): Promise<Located> {
  const [name, version] = extension.split(','), seen: string[] = [];
  let found: { readonly headerStart: number; readonly dataStart: number; readonly dimensions: readonly number[] } | undefined;
  try {
    for await (const hdu of locateFitsHdus((offset, length) => archive.bytes(url, { offset, length }), undefined, HEADER_READ)) {
      // The primary header of an HST file states the equinox of every extension's coordinates.
      if (hdu.header.EQUINOX !== undefined && hdu.header.EQUINOX !== 2000) throw new TypeError(`its coordinates are of equinox ${String(hdu.header.EQUINOX)}, not J2000.`);
      if (hdu.header.EXTNAME === name && hdu.header.EXTVER === Number(version)) { found = hdu; break; }
      seen.push(hdu.header.XTENSION === undefined ? 'primary' : `${String(hdu.header.EXTNAME)},${String(hdu.header.EXTVER)}`);
    }
  } catch (error) {
    // The file's length is not known beforehand: past its last extension the archive answers 416, and the extension was not there.
    if (!/\b416\b/u.test((error as Error).message)) throw error;
  }
  if (!found) throw new Error(`the file has no extension ${extension} (it has ${seen.join('; ') || 'no header'}).`);
  if (found.dimensions.length !== 2) throw new TypeError(`extension ${extension} is not a two-axis image.`);
  const range = { offset: found.headerStart, length: found.dataStart - found.headerStart };
  return { kept: await archive.bytes(url, range), range, dimensions: found.dimensions };
}

export async function fetchImagePixel(archive: Archive, position: CataloguePosition, where: string): Promise<CatalogueRow> {
  const { extension, x, y } = position.row as { extension: string; x: string; y: string }, first = position.firstPixel!;
  const url = mastDownloadUrl(position.catalogue), file = position.catalogue.split('/').at(-1)!, key = `${url} ${extension}`;
  const words = `${position.catalogue} pixel extension = ${extension}, x = ${x}, y = ${y}, first pixel centre = ${first}`, at = `${where}: MAST ${words}`;
  let held = located.get(archive);
  if (!held) located.set(archive, held = new Map());
  let header = held.get(key);
  if (!header) { held.set(key, header = locate(archive, url, extension)); header.catch(() => { held.delete(key); }); }
  try {
    const { kept, range, dimensions: [width, height] } = await header, px = zeroBased(Number(x), first), py = zeroBased(Number(y), first);
    if (!(px >= -0.5 && px <= width! - 0.5 && py >= -0.5 && py <= height! - 0.5)) throw new RangeError(`the pixel is outside that extension's ${width} by ${height} image.`);
    // The position is read from the kept bytes.
    const [ra, dec] = skyProjection(readFitsHeader(kept).header).skyOf(px, py);
    return { catalogue: position.catalogue, tsv: kept.toString('latin1'), form: {}, cells: { ...position.row }, ra, dec, words, columns: { ra: 'RA', dec: 'Dec' },
      archive: 'MAST', image: { url, file, extension, range }, epoch: 2000 };
  } catch (error) { throw new Error(`${at}: ${(error as Error).message}`, { cause: error }); }
}
