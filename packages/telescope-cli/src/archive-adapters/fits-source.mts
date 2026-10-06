/** An opt-in, pinned FITS source for the shared Telescope output operations. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { PRODUCT_RECORD_SCHEMA } from '@cssearth/objects';
import { localOutput, verifiedProduct } from '../products/verified-product.mts';

export const FITS_SOURCE_SCHEMA = 'cssearth-telescope-fits-source@1';

export async function openFitsSource(path: string) {
  const raw = requireRecord(JSON.parse(await readFile(path, 'utf8')));
  if (raw.schema !== PRODUCT_RECORD_SCHEMA) return null;
  const source = await verifiedProduct(path), parameters = source.record.parameters;
  // PR #602 records already have the original FITS tile pinned, before this handoff was declared.
  const legacy = source.record.stage === 'telescope-wwt-fits' && parameters.fitsSource === undefined;
  if (!legacy && parameters.fitsSource === undefined) return null;
  const declared = legacy ? { schema: FITS_SOURCE_SCHEMA, path: 'source.fits', label: parameters.imageset,
    limitations: parameters.limitations } : requireRecord(parameters.fitsSource, 'FITS source declaration');
  if (declared.schema !== FITS_SOURCE_SCHEMA) throw new TypeError('Unsupported FITS source declaration');
  const relativePath = requireString(declared.path, 'FITS source path');
  if (!/\.fits?(?:\.gz)?$/iu.test(relativePath)) throw new TypeError('FITS source must name a FITS file');
  const pins = source.record.outputs.filter(output => output.path === relativePath);
  if (pins.length !== 1) throw new Error(`FITS source ${relativePath} is listed ${pins.length} times among the outputs of ${source.file}; it must be listed once.`);
  const label = requireString(declared.label, 'FITS source label');
  const limitations = declared.limitations === undefined ? [] : requireArray(declared.limitations, 'FITS source limitations').map(value => requireString(value, 'FITS source limitation'));
  const companions = declared.companions === undefined ? undefined : (() => {
    const named = requireRecord(declared.companions, 'FITS source companions');
    if (Object.keys(named).sort().join(',') !== 'coverage,uncertainty') throw new TypeError('FITS companions require uncertainty and coverage.');
    return Object.fromEntries(['uncertainty', 'coverage'].map(role => {
      const name = requireString(named[role], `${role} source path`);
      if (!/\.fits?(?:\.gz)?$/iu.test(name) || source.record.outputs.filter(output => output.path === name).length !== 1)
        throw new Error(`${role} FITS companion ${name} is not listed once among the outputs of ${source.file}.`);
      return [role, localOutput(source.root, name)];
    })) as { uncertainty: string; coverage: string };
  })();
  return { source, path: resolve(path), file: localOutput(source.root, relativePath), pin: pins[0]!, label, limitations, companions };
}
