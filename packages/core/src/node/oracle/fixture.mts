/**
 * Shared reading of oracle fixtures for the comparing tests: the fixture's
 * inputs must be the pinned manifest inputs, and its tool versions must be the
 * pinned requirements, so a comparison is bound to exact inputs and an exact
 * oracle.
 */
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { projectRoot } from '../project-root.ts';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../validate.ts';

const relocatedPaths: Readonly<Record<string, string>> = {
  "tests/oracles/physical-units/spectral.json": "packages/telescope-cli/src/archives/interferometry/fixtures/oracles/physical-units/spectral.json",
  "tests/oracles/astronomy/hosted-orbit.json": "packages/bake/src/objects/scene/fixtures/hosted-orbit.json",
  "tests/oracles/isis/photometric-truth.json": "packages/bake/src/photometry/fixtures/photometric-truth.json",
  "tests/oracles/isis2/borrelly-micas.json": "packages/bake/src/objects/layers/terrestrial/missions/borrelly-micas.json",
  "tests/oracles/npy/psyche-alma.json": "packages/bake/src/objects/raster/numpy/psyche-alma.json",
  "tests/oracles/pds/dart-draco-cube.json": "packages/bake/src/objects/layers/terrestrial/missions/dart-draco-cube.json",
  "tests/oracles/pds3/amica-ddr.json": "packages/bake/src/objects/layers/terrestrial/missions/amica-ddr.json",
  "tests/oracles/pds3/osiris-geo.json": "packages/bake/src/objects/layers/terrestrial/missions/osiris-geo.json",
  "tests/oracles/pds3/osiris-reflectance.json": "packages/bake/src/objects/layers/terrestrial/missions/osiris-reflectance.json",
  "tests/fixtures/fits/byte.fits": "packages/fits/src/node/fixtures/fits/byte.fits",
  "tests/fixtures/fits/cube.fits": "packages/fits/src/node/fixtures/fits/cube.fits",
  "tests/fixtures/fits/eso-hierarchy.fits": "packages/fits/src/node/fixtures/fits/eso-hierarchy.fits",
  "tests/fixtures/fits/extensions.fits": "packages/fits/src/node/fixtures/fits/extensions.fits",
  "tests/fixtures/fits/float32.fits": "packages/fits/src/node/fixtures/fits/float32.fits",
  "tests/fixtures/fits/float64.fits": "packages/fits/src/node/fixtures/fits/float64.fits",
  "tests/fixtures/fits/long-string.fits": "packages/fits/src/node/fixtures/fits/long-string.fits",
  "tests/fixtures/fits/scaled-blank.fits": "packages/fits/src/node/fixtures/fits/scaled-blank.fits",
  "tests/fixtures/fits/signed-int32.fits": "packages/fits/src/node/fixtures/fits/signed-int32.fits",
  "tests/fixtures/fits/sky-orientation.fits": "packages/fits/src/node/fixtures/fits/sky-orientation.fits",
  "tests/fixtures/fits/sky-projection.fits": "packages/fits/src/node/fixtures/fits/sky-projection.fits",
  "tests/fixtures/hosted-orbits/trappist-1f-agol2021/manifest.json": "packages/bake/src/astronomy/fixtures/trappist-1f-agol2021/manifest.json",
  "tests/fixtures/hosted-orbits/trappist-1f-agol2021/qualification.json": "packages/bake/src/astronomy/fixtures/trappist-1f-agol2021/qualification.json",
  "tests/fixtures/telescope-families/f04-europa-stis/SOURCE.json": "packages/fits/src/node/fixtures/telescope-families/f04-europa-stis/SOURCE.json",
  "tests/fixtures/telescope-families/f04-europa-stis/od9l12010_x2d.fits": "packages/fits/src/node/fixtures/telescope-families/f04-europa-stis/od9l12010_x2d.fits",
  "tests/fixtures/telescope-families/family-sources.json": "packages/fits/src/node/fixtures/telescope-families/family-sources.json",
  "tests/oracles/astronomy/hosted-eccentric.json": "packages/bake/src/astronomy/fixtures/hosted-eccentric.json",
  "tests/oracles/sbmt/projection.json": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/projection.json",
  "tests/fixtures/sbmt/concave.sum": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/inputs/concave.sum",
  "tests/fixtures/sbmt/cases.json": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/inputs/cases.json",
  "tests/fixtures/sbmt/concave.tab": "packages/bake/src/objects/layers/terrestrial/fixtures/sbmt/inputs/concave.tab",

  "tests/oracles/spice/dart-draco.json": "packages/bake/src/astronomy/fixtures/dart-draco.json",
  "tests/oracles/spice/new-horizons-approach.json": "packages/bake/src/objects/default-view/fixtures/new-horizons-approach.json",

  "tests/oracles/eclipse-map/numerics.json": "packages/bake/src/objects/raster/eclipse-map/fixtures/numerics.json",
  "tests/oracles/eclipse-map/theresa-eigenbasis.json": "packages/bake/src/objects/raster/eclipse-map/fixtures/theresa-eigenbasis.json",
  "tests/oracles/fits/binary-table.json": "packages/bake/src/objects/layers/observation/fixtures/fits/binary-table.json",
  "tests/oracles/fits/charon-leisa.json": "packages/bake/src/objects/layers/terrestrial/missions/charon-leisa.json",
  "tests/oracles/fits/core.json": "packages/bake/src/objects/layers/observation/fixtures/fits/core.json",
  "tests/oracles/fits/encounter.json": "packages/bake/src/objects/layers/terrestrial/missions/encounter.json",
  "tests/oracles/fits/llorri.json": "packages/bake/src/objects/layers/terrestrial/missions/llorri.json",
  "tests/oracles/fits/lupton-asinh.json": "packages/bake/src/objects/color/fixtures/lupton-asinh.json",
  "tests/oracles/fits/pallas.json": "packages/bake/src/objects/layers/observation/fixtures/fits/pallas.json",
  "tests/oracles/fits/rice.json": "packages/bake/src/objects/layers/observation/fixtures/fits/rice.json",
  "tests/oracles/fits/sky-orientation.json": "packages/bake/src/objects/layers/observation/fixtures/fits/sky-orientation.json",
  "tests/oracles/fits/sky-projection.json": "packages/bake/src/objects/layers/observation/fixtures/fits/sky-projection.json",
  "tests/oracles/fits/synoptic.json": "packages/bake/src/objects/layers/observation/fixtures/fits/synoptic.json",
  "tests/oracles/fits/wise-atlas-projection.json": "packages/bake/src/objects/raster/fixtures/wise-atlas-projection.json",
  "tests/fixtures/fits/binary-table-columns.fits": "packages/telescope-cli/src/fixtures/fits/binary-table-columns.fits",
  "tests/fixtures/fits/lupton-bands.fits": "packages/bake/src/objects/color/fixtures/lupton-bands.fits",
  "tests/fixtures/fits/rice-int16.fits": "packages/bake/src/objects/layers/observation/fixtures/rice-int16.fits",
  "tests/fixtures/fits/rice-int32.fits": "packages/bake/src/objects/layers/observation/fixtures/rice-int32.fits",
  "tests/fixtures/fits/rice-uint8.fits": "packages/bake/src/objects/layers/observation/fixtures/rice-uint8.fits",
  "tests/fixtures/fits/wise-atlas-lmc-centre.fits": "packages/bake/src/objects/raster/fixtures/wise-atlas-lmc-centre.fits",
  "tests/fixtures/fits/wise-atlas-lmc-far-corner.fits": "packages/bake/src/objects/raster/fixtures/wise-atlas-lmc-far-corner.fits",
  "tests/fixtures/fits/wise-atlas-pleiades-tile.fits": "packages/bake/src/objects/raster/fixtures/wise-atlas-pleiades-tile.fits"
};
const oraclePath = (path: string) => resolve(ORACLE_ROOT, relocatedPaths[path] ?? path);

export const ORACLE_ROOT = projectRoot(import.meta.url);
export interface OracleSample { index: number; value: number }

export async function readOracleFixture(name: string) {
  const fixture = requireRecord(JSON.parse(await readFile(oraclePath(isAbsolute(name) ? name : `tests/oracles/${name}`), 'utf8')));
  if (fixture.schema !== 'cssearth-oracle-fixture@1') throw new Error(`${name} is not an oracle fixture.`);
  const inputs = requireArray(fixture.inputs).map(entry => { const e = requireRecord(entry); return { path: requireString(e.path), bytes: requireFiniteNumber(e.bytes) }; });
  // References outside the repository, such as another project's test data, are named by a commit in the URL and their size.
  const references = requireArray(fixture.references ?? []).map(entry => { const e = requireRecord(entry); return { url: requireString(e.url), bytes: requireFiniteNumber(e.bytes) }; });
  return { name, oracle: requireString(fixture.oracle), generatedBy: requireString(fixture.generatedBy), tool: requireRecord(fixture.tool), inputs, references, cases: requireRecord(fixture.cases) };
}

/** The pinned requirement versions, `name==version`, keyed by lower-case distribution name. */
export async function pinnedOracleVersions() {
  const text = await readFile(resolve(import.meta.dirname, 'requirements.txt'), 'utf8');
  return new Map(text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => { const [name, version] = line.split('=='); return [name.toLowerCase().replace(/-/g, '_'), version] as const; }));
}

/** Every input is a body manifest input, a checked-in FITS fixture or a test-only archive record.
 * Kernel callers supply their existing bank verifier; core does not own acquisition. */
export async function assertPinnedInputs(inputs: readonly { path: string; bytes?: number }[], verifyKernelBank?: (set: string, kernels: readonly string[]) => Promise<unknown>) {
  for (const input of inputs) {
    if (/^tests\/fixtures\/hosted-orbits\/[a-z0-9-]+\/qualification\.json$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(oraclePath(input.path)));
      continue;
    }
    if (/^tests\/fixtures\/sbmt\/[a-z0-9-]+\.(json|tab|sum|info)$/u.test(input.path)) {
      verifyOracleBytes(input, await readFile(oraclePath(input.path)));
      continue;
    }
    if (input.path.startsWith('.local/fits-reference/')) {
      const pin = (await fitsArchiveInputs()).find(pin => pin.path === input.path);
      if (!pin || (input.bytes !== undefined && pin.bytes !== input.bytes)) throw new Error(`FITS test archive record changed: ${input.path}`);
      continue;
    }
    if (/^(?:tests\/fixtures\/fits|packages\/telescope-cli\/src\/fixtures\/fits)\/[a-z0-9-]+\.fits$/u.test(input.path) ||
        (input.path.endsWith('.fits') && Object.values(relocatedPaths).includes(input.path))) {
      verifyOracleBytes(input, await readFile(oraclePath(input.path)));
      continue;
    }
    const kernel = /^src\/spice\/([a-z][a-z0-9-]*)\/(.+)$/u.exec(input.path);
    if (kernel) {
      // A shared kernel bank verifies its own pins (packages/bake/cli/kernel-bank.mts).
      if (!verifyKernelBank) throw new Error('Kernel oracle inputs require the caller bank verifier.');
      await verifyKernelBank(kernel[1]!, [kernel[2]!]);
      verifyOracleBytes(input, await readFile(oraclePath(input.path)));
      continue;
    }
    const match = /^src\/objects\/([^/]+)\/source\/(.+)$/u.exec(input.path);
    if (!match) throw new Error(`Oracle input outside a body's sources: ${input.path}`);
    const manifest = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects', match[1], 'source/manifest.json'), 'utf8')));
    const entry = [...requireArray(manifest.inputs), ...requireArray(manifest.documents)].map(e => requireRecord(e)).find(e => e.path === match[2]);
    if (!entry) throw new Error(`Oracle input is not a manifest input or document: ${input.path}`);
    verifyOracleBytes(input, await readFile(oraclePath(input.path)));
  }
}

/** Verify the actual buffer about to be decoded has the recorded size. */
export function verifyOracleBytes(input: { path: string; bytes?: number }, bytes: Buffer) {
  if (input.bytes !== undefined && bytes.length !== input.bytes) throw new Error(`Oracle source size differs from its record: ${input.path}`);
  return bytes;
}

export async function readOracleInput(input: { path: string; bytes?: number }, verifyKernelBank?: (set: string, kernels: readonly string[]) => Promise<unknown>) {
  await assertPinnedInputs([input], verifyKernelBank);
  try { return verifyOracleBytes(input, await readFile(oraclePath(input.path))); }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error(`Missing FITS oracle input ${input.path}. Run pnpm test:fits --restore.`, { cause: error });
    throw error;
  }
}

export const sampleList = (value: unknown): OracleSample[] => requireArray(value).map(sample => { const s = requireRecord(sample); return { index: requireFiniteNumber(s.index), value: requireFiniteNumber(s.value) }; });

/** A reference is pinned when its URL names a 40-hexadecimal commit and its size is recorded. */
export function assertPinnedReferences(references: readonly { url: string; bytes: number }[]) {
  for (const reference of references) {
    if (!/^https:\/\/(raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[0-9a-f]{40}\/|github\.com\/[^/]+\/[^/]+\/blob\/[0-9a-f]{40}\/)/u.test(reference.url)) throw new Error(`Oracle reference is not pinned to a commit: ${reference.url}`);
    if (!(reference.bytes > 0)) throw new Error(`Oracle reference lacks its size: ${reference.url}`);
  }
}

export async function fitsArchiveInputs() {
  const record = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'packages/fits/src/node/fixtures/fits/archive-inputs.json'), 'utf8')));
  if (record.schema !== 'cssearth-fits-reference-inputs@1') throw new Error('Invalid FITS reference input record.');
  const inputs = requireArray(record.inputs).map(raw => {
    const entry = requireRecord(raw), path = requireString(entry.path), url = requireString(entry.url);
    const bytes = requireFiniteNumber(entry.bytes);
    if (!/^\.local\/fits-reference\/[a-z0-9-]+\.fits$/u.test(path) || !/^https:\/\//u.test(url) ||
        !Number.isSafeInteger(bytes) || bytes < 1 || bytes > 64 * 1024 * 1024)
      throw new Error('Invalid FITS reference input identity or size.');
    const headers = Object.fromEntries(Object.entries(requireRecord(entry.headers ?? {})).map(([key, value]) => [key, requireString(value)]));
    return { path, url, bytes, headers };
  });
  if (!inputs.length || inputs.length > 16 || new Set(inputs.map(i => i.path)).size !== inputs.length)
    throw new Error('Invalid FITS reference input population.');
  return inputs;
}
