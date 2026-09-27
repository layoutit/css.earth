/**
 * The LAM release of the VLT/SPHERE asteroid survey: deconvolved frames, shape models, spin records and the paper.
 *
 * The site answers HTTP 417 with a script cookie unless the request carries its public cookie, and can refuse a file
 * on a cold request until its directory listing has been fetched once; every request here sends the cookie and a
 * refused file is asked for again after its directory. Frame names carry the exposure start, sometimes after a prefix
 * such as `SPHER.` and before one or two underscores, so the start is read wherever it appears.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const LAM = 'https://observations.lam.fr/astero';
export const LAM_HEADERS = { Cookie: 'CesAM_LAM_opens_the_door=1' } as const;
export const SURVEY_PAPER_URL = `${LAM}/Papers/Vernazza2021.pdf`;

export interface LamFrame { file: string; url: string; camera: number; start: string; second: string }

/** The survey's directory name for a body, such as `7Iris`. */
export const surveyDirectory = (number: number, name: string) => `${number}${name}`;
export const framesUrl = (number: number, name: string) => `${LAM}/Data/${surveyDirectory(number, name)}/Deconv/`;
export const shapeUrl = (number: number, name: string, model: 'adam' | 'mpcd') => `${LAM}/3Dshape/${number}_${name}_${model}.obj`;

/** Every deconvolved frame a listing names, in time order. */
export function parseFrameListing(html: string, directoryUrl: string): LamFrame[] {
  const files = new Set([...html.matchAll(/href="([^"/?]+\.fits)"/gu)].map(match => match[1]));
  const frames: LamFrame[] = [];
  for (const file of files) {
    const time = file.match(/(\d{4}-\d{2}-\d{2})T(\d{2})_(\d{2})_(\d{2})(\.\d+)?/u), camera = file.match(/_cam(\d)\.fits$/u);
    if (!time || !camera) continue;
    const second = `${time[1]}T${time[2]}:${time[3]}:${time[4]}`;
    frames.push({ file, url: new URL(file, directoryUrl).href, camera: Number(camera[1]), start: `${second}${time[5] ?? ''}`, second });
  }
  return frames.sort((a, b) => a.start.localeCompare(b.start) || a.camera - b.camera);
}

/** The spin record a shape directory lists for a body; its name varies, such as `3_Juno_param.txt` and `9_Metis_param`. */
export function spinRecordName(html: string, number: number, name: string) {
  const names = [...new Set([...html.matchAll(/href="([^"/?]+)"/gu)].map(match => match[1]))].filter(file => file.startsWith(`${number}_${name}_param`));
  if (names.length !== 1) throw new Error(`The LAM shape directory lists ${names.length ? names.join(', ') : 'no'} spin record for (${number}) ${name}.`);
  return names[0];
}

async function request(url: string) {
  return fetch(url, { headers: LAM_HEADERS, signal: AbortSignal.timeout(120_000) });
}

/** A LAM file's bytes; a refusal is retried once after fetching the file's directory. */
export async function lamBytes(url: string): Promise<Buffer> {
  let response = await request(url);
  if (!response.ok) {
    await request(new URL('./', url).href).then(listing => listing.arrayBuffer());
    response = await request(url);
  }
  if (!response.ok) throw new Error(`LAM answered ${response.status} for ${url}.`);
  return Buffer.from(await response.arrayBuffer());
}

export async function lamText(url: string) {
  return (await lamBytes(url)).toString('utf8');
}

export async function lamDownload(url: string, path: string) {
  const bytes = await lamBytes(url);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return bytes;
}
