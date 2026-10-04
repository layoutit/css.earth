import { requireArray, requireRecord, requireString } from '@cssearth/core';

// Written history: packages/telescope-cli/src/archives/jwst/imaging/programs/ (now packages/telescope-cli/src/archives/jwst/programs/).
const HISTORICAL_JWST_PROGRAM_ROOT = 'packages/telescope-cli/src/archives/jwst/' + 'imaging/programs/';
const JWST_PROGRAM_ROOT = 'packages/telescope-cli/src/archives/jwst/programs/';

/** Preserve the program path only when an existing manifest records that program's historical acquisition. */
export function jwstAcquisition(program: string, uri: string, manifest: unknown): string {
  const historicalPath = `${HISTORICAL_JWST_PROGRAM_ROOT}${program}.json`;
  const inputs = manifest === undefined ? [] : requireArray(requireRecord(manifest).inputs, 'manifest inputs');
  const historical = inputs.some(input => {
    const record = requireRecord(input, 'manifest input');
    return typeof record.acquisition === 'string' && record.acquisition.includes(`${historicalPath}.`);
  });
  const existing = inputs.map(input => requireRecord(input)).find(record => typeof record.acquisition === 'string'
    && record.acquisition.includes(`by its URI ${uri} `) && record.acquisition.includes(`${historicalPath}.`));
  if (existing) return requireString(existing.acquisition);
  const path = historical ? historicalPath : `${JWST_PROGRAM_ROOT}${program}.json`;
  return `Downloaded unchanged from MAST by its URI ${requireString(uri)} (@cssearth/telescope/node mastFile), the pipeline's own calwebb_coron3 product of the association pinned in ${path}.`;
}
