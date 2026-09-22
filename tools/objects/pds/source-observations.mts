/** Source-pinned PDS3 observations already owned by an object package.
 *
 * This is the legacy half of the PDS adapter. Peppi owns PDS4 Registry discovery; this reader exposes exact PDS3 products
 * that cssEarth already pins, without asking a scientific-query caller to run a separate archive command first. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { hasErrorCode, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { pds3Keyword, pds3Values, pds3TimeIso } from '../pds-labels.mts';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const measurement = (value: string, field: string) => {
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)\s*<([^<>]+)>$/u.exec(value.trim());
  if (!match) throw new TypeError(`PDS3 ${field} is not a number with a unit.`);
  return { value: requireFiniteNumber(Number(match[1]), field), unit: match[2]!.trim().toUpperCase().replaceAll(' ', '') };
};
const convert = (value: string, field: string, units: Readonly<Record<string, number>>) => {
  const measured = measurement(value, field), factor = units[measured.unit];
  if (factor === undefined) throw new TypeError(`PDS3 ${field} uses unsupported unit ${measured.unit}.`);
  return measured.value * factor;
};
const WAVELENGTH_TO_MICROMETRES = Object.freeze({ NANOMETER: 1e-3, NANOMETERS: 1e-3, NM: 1e-3, MICROMETER: 1, MICROMETERS: 1, UM: 1 });
const PIXEL_SCALE_TO_KILOMETRES = Object.freeze({ 'METERS/PIXEL': 1e-3, 'METER/PIXEL': 1e-3, 'M/PIXEL': 1e-3, 'KILOMETERS/PIXEL': 1, 'KILOMETER/PIXEL': 1, 'KM/PIXEL': 1 });
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
const title = (value: string) => value.toLowerCase().replace(/(^|\s)\S/gu, text => text.toUpperCase());

export interface SourcePds3Observation {
  readonly id: string; readonly archiveProductId: string; readonly datasetId: string; readonly program: string;
  readonly targetName: string; readonly telescope: string; readonly mode: string;
  readonly observatory: string; readonly instrument: string; readonly startIso: string; readonly endIso: string;
  readonly filter?: string; readonly centralWavelengthMicrometres?: number; readonly surfaceResolutionKm?: number;
  readonly kind: 'image'; readonly use: string; readonly units: string;
  readonly sourceFiles: readonly { readonly role: 'label' | 'science'; readonly path: string; readonly origin: string }[];
}

/** Read only complete detached-image pairs whose label bytes and absent-or-present science bytes are exactly pinned. */
export async function sourcePds3Observations(root: string, targetId: string): Promise<SourcePds3Observation[]> {
  const sourceRoot = resolve(root, 'src/objects', targetId, 'source');
  const manifestValue = await readFile(resolve(sourceRoot, 'manifest.json'), 'utf8').then(text => JSON.parse(text) as unknown).catch((error: unknown) => {
    if (hasErrorCode(error, 'ENOENT', 'ENOTDIR')) return undefined;
    throw error;
  });
  if (manifestValue === undefined) return [];
  const manifest = requireRecord(manifestValue, `${targetId} source manifest`), inputs = requireArray(manifest.inputs, 'source inputs').map(raw => requireRecord(raw, 'source input'));
  const pinned = inputs.map(input => ({ input, path: requireString(input.path, 'source input path') }));
  const observations: SourcePds3Observation[] = [];
  for (const { input: labelInput, path: labelPath } of pinned.filter(entry => entry.path.toLowerCase().endsWith('.lbl'))) {
    const labelFile = resolve(sourceRoot, labelPath);
    const bytes = await readFile(labelFile).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (bytes === undefined) continue;
    const label = bytes.toString('utf8');
    if (pds3Keyword(label, 'PDS_VERSION_ID', []) !== 'PDS3') continue;
    const pointer = pds3Values(label, '^IMAGE', []);
    if (!pointer?.length) continue;
    const scienceName = pointer[0]!, science = pinned.find(entry => dirname(entry.path) === dirname(labelPath) && basename(entry.path).toUpperCase() === scienceName.toUpperCase());
    if (!science) continue;
    const field = (key: string) => { const value = pds3Keyword(label, key, []); if (value === undefined) throw new TypeError(`${labelPath} lacks ${key}.`); return value; };
    const productId = field('PRODUCT_ID'), productType = pds3Keyword(label, 'PRODUCT_TYPE', []), datasetId = field('DATA_SET_ID'), host = field('INSTRUMENT_HOST_NAME'), instrumentId = field('INSTRUMENT_ID'), instrument = field('INSTRUMENT_NAME');
    const targetName = field('TARGET_NAME');
    const horizontal = pds3Keyword(label, 'HORIZONTAL_PIXEL_SCALE', []), vertical = pds3Keyword(label, 'VERTICAL_PIXEL_SCALE', []);
    const surfaceResolutionKm = horizontal === undefined || vertical === undefined ? undefined
      : Number(Math.max(convert(horizontal.replace(/\s+PER\s+/iu, '/'), 'HORIZONTAL_PIXEL_SCALE', PIXEL_SCALE_TO_KILOMETRES),
        convert(vertical.replace(/\s+PER\s+/iu, '/'), 'VERTICAL_PIXEL_SCALE', PIXEL_SCALE_TO_KILOMETRES)).toPrecision(12));
    const center = pds3Keyword(label, 'CENTER_FILTER_WAVELENGTH', []);
    const filter = pds3Keyword(label, 'FILTER_NAME', []);
    observations.push({ id: productId.toLowerCase(), archiveProductId: `${datasetId}:${productId}`, datasetId,
      program: `${targetId}-pds3-${slug(datasetId)}`, targetName, telescope: title(host), mode: `${instrumentId}/${productType ? `${productType} ` : ''}image`,
      observatory: title(host), instrument, startIso: pds3TimeIso(field('START_TIME')), endIso: pds3TimeIso(field('STOP_TIME')),
      ...(filter === undefined ? {} : { filter }), ...(center === undefined ? {} : { centralWavelengthMicrometres: convert(center, 'CENTER_FILTER_WAVELENGTH', WAVELENGTH_TO_MICROMETRES) }),
      ...(surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm }), kind: 'image',
      use: 'Source-pinned PDS3 image. Its detached label establishes identity, time, filter, units and surface sampling; filter width and achieved optical resolution remain unstated.',
      units: pds3Keyword(label, 'UNIT', ['IMAGE']) ?? pds3Keyword(label, 'UNITS', ['IMAGE']) ?? 'not stated',
      sourceFiles: [
        { role: 'label', path: `src/objects/${targetId}/source/${labelPath}`, origin: requireString(labelInput.origin, `${labelPath} origin`) },
        { role: 'science', path: `src/objects/${targetId}/source/${science.path}`, origin: requireString(science.input.origin, `${science.path} origin`) },
      ] });
  }
  return observations.sort((a, b) => a.startIso.localeCompare(b.startIso) || a.id.localeCompare(b.id));
}
