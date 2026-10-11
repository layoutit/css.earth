/**
 * The archive files the outer ejecta are made from, where the command expects them under its downloads directory, where
 * each is served and its size in bytes (checked against the archives on 2026-10-11). The catalogue records in
 * src/sources name the programmes; none of these files is tracked (each is 50 MB to 18 GB).
 */
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GAIA_ALIGNED_EPOCHS, WFPC2_VISITS } from './hubble-epochs.mts';

export interface Download { path: string; url: string; bytes: number; catalogueId: string }

const MAST = (file: string) => `https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/${file}`;
/** Bytes of each Hubble product, by name. */
const HUBBLE_BYTES: Readonly<Record<string, number>> = {
  j900a6010_drc: 214554240, j900a7010_drc: 214502400, j900b7010_drc: 214502400, j900b7020_drc: 214554240,
  jcdha6010_drc: 214557120, jcdha7010_drc: 214557120, jcdhb6010_drc: 214557120, jcdhb6020_drc: 214557120, jcdhb7010_drc: 214557120, jcdhb7020_drc: 214608960,
  idtl01080_drc: 54118080, ie2w040c0_drc: 217463040,
  hst_5188_05_wfpc2_pc_f658n_u24105_drz: 165268800, hst_5239_02_wfpc2_pc_f658n_u2dh02_drz: 198031680, hst_7253_01_wfpc2_pc_f658n_u44601_drz: 367971840,
  hst_8178_01_wfpc2_pc_f658n_u5je01_drz: 493974720, hst_9226_01_wfpc2_pc_f658n_u6ck01_drz: 492295680, hst_9775_01_wfpc2_pc_f658n_u8pb01_drz: 686476800,
  hst_11500_01_wfpc2_pc_f658n_ub7c01_drz: 815253120,
};

export const DOWNLOADS: readonly Download[] = [
  ...Object.values(GAIA_ALIGNED_EPOCHS).flat().map(name => ({ path: `hst-epochs/${name}.fits`, url: MAST(`${name}.fits`), bytes: HUBBLE_BYTES[name]!, catalogueId: 'mast-hst-eta-carinae-f658n-acs-wfc3' })),
  ...Object.values(WFPC2_VISITS).map(name => ({ path: `hst-epochs/${name}_drz.fits`, url: MAST(`${name}_drz.fits`), bytes: HUBBLE_BYTES[`${name}_drz`]!, catalogueId: 'mast-hst-eta-carinae-f658n-wfpc2' })),
  { path: 'muse/ADP.2016-06-20T21:41:31.322.fits', url: 'https://dataportal.eso.org/dataPortal/file/ADP.2016-06-20T21:41:31.322', bytes: 17944133760, catalogueId: 'eso-adp-2016-06-20t21-41-31-322' },
  { path: 'candidates/raw/heic1912a.tif', url: 'https://esahubble.org/media/archives/images/original/heic1912a.tif', bytes: 12871876, catalogueId: 'esahubble-heic1912a' },
];

/** The downloads missing or of the wrong size under `directory`. */
export async function missingDownloads(directory: string): Promise<Download[]> {
  const out: Download[] = [];
  for (const item of DOWNLOADS) { const size = await stat(resolve(directory, item.path)).then(info => info.size, () => -1); if (size !== item.bytes) out.push(item); }
  return out;
}

/** Fetch each missing download (to a `.part` file, renamed once its size is right). */
export async function fetchDownloads(directory: string, log = console.log): Promise<void> {
  for (const item of await missingDownloads(directory)) {
    const target = resolve(directory, item.path), part = `${target}.part`;
    await mkdir(dirname(target), { recursive: true });
    log(`fetching ${item.url} (${(item.bytes / 1e6).toFixed(0)} MB)`);
    const response = await fetch(item.url);
    if (!response.ok || !response.body) throw new Error(`${item.url} answered ${response.status}.`);
    await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>), createWriteStream(part));
    const size = (await stat(part)).size;
    if (size !== item.bytes) throw new Error(`${item.url} gave ${size} bytes, not the ${item.bytes} recorded.`);
    await rename(part, target);
  }
}
