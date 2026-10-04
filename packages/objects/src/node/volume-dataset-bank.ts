// A volume dataset bank on disk (volume/delivery/volume-dataset-bank-files.ts): every preparation writes one through
// writeVolumeDatasetBank and reads one whole through readVolumeDatasetBank, so the layout has one owner.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PREPARED_OBJECT_SCHEMA } from '../descriptor.js';
import { validatePreparedCssVolume } from '../volume/delivery/css-volume-validation.js';
import type { PreparedCssVolume } from '../volume/delivery/css-volume-types.js';
import type { PreparedBank } from '../prepared-bank.js';
import { validatePreparedVolumeDatasets, type PreparedVolumeDatasets } from '../volume/delivery/prepared-volume-datasets.js';
import { PREPARED_VOLUME_DATASET_INDEX_SCHEMA, VOLUME_DATASET_INDEX_FILE, VOLUME_DATASET_RECORD_FILE, joinPreparedVolumeDatasets, splitPreparedVolumeDatasets,
  type PreparedVolumeDatasetFiles, type PreparedVolumeDatasetIndex } from '../volume/delivery/volume-dataset-bank-files.js';
import { packPreparedBank, unpackPreparedBank } from './prepared-binary-file.js';

const json = (value: unknown) => `${JSON.stringify(value)}\n`;

/** Each file of a bank by its name under `prepared/`, as the bytes a preparation writes. */
export function volumeDatasetBankFiles(input: PreparedVolumeDatasets, type = 'volume-dataset-bank'): ReadonlyMap<string, Uint8Array> {
  const bank = validatePreparedVolumeDatasets(input), files = splitPreparedVolumeDatasets(bank), bytes = new Map<string, Uint8Array>(), text = new TextEncoder();
  bytes.set(VOLUME_DATASET_INDEX_FILE, text.encode(json({ schema: PREPARED_OBJECT_SCHEMA, id: bank.id, type, format: PREPARED_VOLUME_DATASET_INDEX_SCHEMA, data: files.index })));
  bytes.set(VOLUME_DATASET_RECORD_FILE, text.encode(json(files.record)));
  for (const [name, volume] of files.volumes) bytes.set(name, text.encode(json(volume)));
  for (const [name, stars] of files.stars) bytes.set(name, packPreparedBank(stars, `${bank.id}/${name}`));
  return bytes;
}

/** Write a bank's files under `preparedDirectory` and return their names. */
export async function writeVolumeDatasetBank(preparedDirectory: string, bank: PreparedVolumeDatasets, type?: string): Promise<readonly string[]> {
  const files = volumeDatasetBankFiles(bank, type);
  for (const [name, bytes] of files) {
    const path = resolve(preparedDirectory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  return [...files.keys()];
}

/** The bank under `preparedDirectory`, whole. `read` returns a file's bytes by its name there. */
export async function readVolumeDatasetBank(preparedDirectory: string,
  read: (name: string) => Promise<Uint8Array> = async name => new Uint8Array(await readFile(resolve(preparedDirectory, name)))): Promise<PreparedVolumeDatasets> {
  const parse = async (name: string): Promise<unknown> => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await read(name)));
  const envelope = await parse(VOLUME_DATASET_INDEX_FILE) as { format?: unknown; data?: unknown };
  if (envelope?.format !== PREPARED_VOLUME_DATASET_INDEX_SCHEMA) {
    throw new TypeError(`${preparedDirectory}/${VOLUME_DATASET_INDEX_FILE}: expected format ${PREPARED_VOLUME_DATASET_INDEX_SCHEMA}, got ${JSON.stringify(envelope?.format ?? null)}.`);
  }
  const index = envelope.data as PreparedVolumeDatasetIndex, volumes = new Map<string, PreparedCssVolume>(), stars = new Map<string, PreparedBank>();
  for (const dataset of index.datasets) {
    if (!volumes.has(dataset.volume)) volumes.set(dataset.volume, validatePreparedCssVolume(await parse(dataset.volume)));
    if (!stars.has(dataset.stars)) stars.set(dataset.stars, unpackPreparedBank(await read(dataset.stars), `${preparedDirectory}/${dataset.stars}`));
  }
  return joinPreparedVolumeDatasets({ index, volumes, stars, record: await parse(VOLUME_DATASET_RECORD_FILE) as PreparedVolumeDatasetFiles['record'] });
}
