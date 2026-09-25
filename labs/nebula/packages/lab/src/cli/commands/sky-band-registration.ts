/** Registration evidence for composites built from pinned survey bands on one exact TAN request grid.
 * A composite with enough catalogue stars in its blue channel runs the unchanged fixed-WCS catalogue gate.
 * A composite the gate cannot qualify may inherit the grid only from a passing composite on the identical grid;
 * its own gate result is kept beside the transfer as a diagnostic, never as the qualification. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyFixedCatalogue } from '@cssearth/nebula-reconstruction/registration/fixed-catalogue';
import { validateImageWcs, type ImageWcs } from '@cssearth/bake/volume';
import { verifySkyBandSource } from '../../server/workflows/observations/sky-band-source.ts';

type Pin = { path: string; sha256: string };
export interface SkyBandCandidate { id: string; path: string; sha256: string; wcs: ImageWcs; skyBands?: Pin }
export interface SkyBandRegistrationRecipe {
  schema: 'cssearth-sky-band-registration@1';
  catalogue: string;
  stars: { query: Pin; path: string; sha256: string };
  catalogueChecks: { imageId: string; blueChannel: string; receipt: string }[];
  gridTransfers: { imageId: string; referenceId: string; blueChannel: string; receipt: string; diagnostic: string }[];
  /** Already qualified fixed-WCS rasters, re-run so a protocol change must keep them passing. */
  fixedWcsChecks: { imageId: string; blueChannel: string; receipt: string }[];
  /** Known-bad fixed WCS for the same rasters. Each must fail; a passing one fails the run. */
  negativeControls: { label: string; imageId: string; blueChannel: string; wcs: ImageWcs; receipt: string }[];
}

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be non-empty text.`);
  return value;
}
const id = (value: unknown, label: string) => { const s = text(value, label); if (!/^[a-z0-9-]+$/.test(s)) throw new TypeError(`${label} must be a safe id.`); return s; };
const digest = (value: unknown, label: string) => { const s = text(value, label); if (!/^[0-9a-f]{64}$/.test(s)) throw new TypeError(`${label} must be a SHA-256.`); return s; };
const relativePath = (value: unknown, label: string) => {
  const s = text(value, label);
  if (s.startsWith('/') || s.split('/').includes('..')) throw new TypeError(`${label} must be repository-relative.`);
  return s;
};
const pin = (value: unknown, label: string): Pin => { const row = record(value, label); return { path: relativePath(row.path, `${label} path`), sha256: digest(row.sha256, `${label} sha256`) }; };
const receiptPath = (value: unknown, label: string) => {
  const s = relativePath(value, label);
  if (!s.startsWith('labs/nebula/models/') || !s.endsWith('.json')) throw new TypeError(`${label} must be a checked-in model JSON receipt.`);
  return s;
};

export function parseSkyBandRegistration(value: unknown): SkyBandRegistrationRecipe {
  const row = record(value, 'Sky band registration'), stars = record(row.stars, 'Stars');
  if (row.schema !== 'cssearth-sky-band-registration@1' || !Array.isArray(row.catalogueChecks) || !Array.isArray(row.gridTransfers))
    throw new TypeError('Unsupported sky band registration recipe.');
  if (!Array.isArray(row.fixedWcsChecks) || !Array.isArray(row.negativeControls)) throw new TypeError('Unsupported sky band registration recipe.');
  const catalogueChecks = row.catalogueChecks.map((raw, i) => {
    const check = record(raw, `Catalogue check ${i}`);
    return { imageId: id(check.imageId, 'Image id'), blueChannel: text(check.blueChannel, 'Blue channel'), receipt: receiptPath(check.receipt, 'Receipt') };
  });
  const gridTransfers = row.gridTransfers.map((raw, i) => {
    const transfer = record(raw, `Grid transfer ${i}`);
    return { imageId: id(transfer.imageId, 'Image id'), referenceId: id(transfer.referenceId, 'Reference id'), blueChannel: text(transfer.blueChannel, 'Blue channel'),
      receipt: receiptPath(transfer.receipt, 'Receipt'), diagnostic: receiptPath(transfer.diagnostic, 'Diagnostic') };
  });
  const fixedWcsChecks = row.fixedWcsChecks.map((raw, i) => {
    const check = record(raw, `Fixed WCS check ${i}`);
    return { imageId: id(check.imageId, 'Image id'), blueChannel: text(check.blueChannel, 'Blue channel'), receipt: receiptPath(check.receipt, 'Receipt') };
  });
  const negativeControls = row.negativeControls.map((raw, i) => {
    const control = record(raw, `Negative control ${i}`), wcs = record(control.wcs, 'Control WCS') as unknown as ImageWcs;
    validateImageWcs(wcs);
    return { label: text(control.label, 'Control label'), imageId: id(control.imageId, 'Image id'), blueChannel: text(control.blueChannel, 'Blue channel'),
      wcs, receipt: receiptPath(control.receipt, 'Receipt') };
  });
  const ids = [...catalogueChecks, ...gridTransfers, ...fixedWcsChecks].map(item => item.imageId);
  if (!ids.length || new Set(ids).size !== ids.length) throw new TypeError('Each composite is registered exactly once.');
  for (const transfer of gridTransfers) if (!catalogueChecks.some(check => check.imageId === transfer.referenceId))
    throw new TypeError(`${transfer.imageId}: a grid transfer reference must be catalogue-checked in the same recipe.`);
  const receipts = [...catalogueChecks, ...gridTransfers.flatMap(transfer => [{ receipt: transfer.receipt }, { receipt: transfer.diagnostic }]), ...fixedWcsChecks, ...negativeControls].map(item => item.receipt);
  if (new Set(receipts).size !== receipts.length) throw new TypeError('Every receipt is written exactly once.');
  return { schema: row.schema, catalogue: relativePath(row.catalogue, 'Catalogue'), catalogueChecks, gridTransfers, fixedWcsChecks, negativeControls,
    stars: { query: pin(stars.query, 'Star query'), path: relativePath(stars.path, 'Star catalogue path'), sha256: digest(stars.sha256, 'Star catalogue sha256') } };
}

/** A catalogue entry that carries one fixed WCS: a composed sky band raster, or an already pinned publisher raster. */
export function fixedWcsCandidate(value: unknown, requireSkyBands: boolean, fallbackWcs?: ImageWcs): SkyBandCandidate {
  const row = record(value, 'Image candidate');
  if (requireSkyBands && (row.skyBands === undefined || row.url !== undefined)) throw new TypeError(`${String(row.id)}: sky band registration applies only to composed candidates.`);
  // A negative control supplies the WCS under test; a candidate registered by matched stars has none of its own.
  if (row.wcs === undefined && !fallbackWcs) throw new TypeError(`${String(row.id)}: a fixed-WCS check needs the candidate's own WCS.`);
  const wcs = row.wcs === undefined ? fallbackWcs! : record(row.wcs, 'Candidate WCS') as unknown as ImageWcs;
  validateImageWcs(wcs);
  return { id: id(row.id, 'Candidate id'), path: relativePath(row.path, 'Candidate path'), sha256: digest(row.sha256, 'Candidate sha256'), wcs,
    ...(row.skyBands === undefined ? {} : { skyBands: pin(row.skyBands, 'Sky bands') }) };
}
export const skyBandCandidate = (value: unknown): SkyBandCandidate => fixedWcsCandidate(value, true);

/** Same-grid transfer: the reference passed its own catalogue gate and both composites are on one identical grid WCS. */
export function gridTransferDecision(reference: { candidate: SkyBandCandidate; gridJson: string; gatePass: boolean },
  target: { candidate: SkyBandCandidate; gridJson: string }) {
  const sameGrid = reference.gridJson === target.gridJson && JSON.stringify(reference.candidate.wcs) === JSON.stringify(target.candidate.wcs);
  return { pass: reference.gatePass && sameGrid, checks: { referenceCatalogueGatePassed: reference.gatePass, identicalRecipeGrid: reference.gridJson === target.gridJson,
    identicalWcs: JSON.stringify(reference.candidate.wcs) === JSON.stringify(target.candidate.wcs) } };
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.pending`, JSON.stringify(value, null, 2) + '\n'); await rename(`${path}.pending`, path);
}

export async function registerSkyBands(root: string, recipePath: string) {
  const recipeBytes = await readFile(resolve(root, recipePath)), recipe = parseSkyBandRegistration(JSON.parse(recipeBytes.toString()));
  const queryBytes = await readFile(resolve(root, recipe.stars.query.path));
  if (hash(queryBytes) !== recipe.stars.query.sha256) throw new Error('Changed star catalogue query.');
  let starBytes = await readFile(resolve(root, recipe.stars.path)).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return null; throw error; });
  if (!starBytes) {
    const url = text(record(JSON.parse(queryBytes.toString()), 'Star query').url, 'Star query URL');
    if (new URL(url).protocol !== 'https:') throw new TypeError('Star query must use HTTPS.');
    const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok) throw new Error(`Star catalogue download failed: ${response.status}`);
    starBytes = Buffer.from(await response.arrayBuffer());
    if (hash(starBytes) === recipe.stars.sha256) { await mkdir(dirname(resolve(root, recipe.stars.path)), { recursive: true }); await writeFile(resolve(root, recipe.stars.path), starBytes); }
  }
  if (hash(starBytes) !== recipe.stars.sha256) throw new Error('Changed star catalogue.');
  const catalogue = record(JSON.parse(await readFile(resolve(root, recipe.catalogue), 'utf8')), 'Image catalogue');
  const images = (Array.isArray(catalogue.targets) ? catalogue.targets : []).flatMap(target => {
    const row = record(target, 'Catalogue target'); return Array.isArray(row.images) ? row.images : [];
  });
  const candidate = async (imageId: string, requireSkyBands = true, fallbackWcs?: ImageWcs) => {
    const matches = images.filter(image => record(image, 'Image').id === imageId);
    if (matches.length !== 1) throw new Error(`${imageId}: needs exactly one catalogue entry.`);
    const parsed = fixedWcsCandidate(matches[0], requireSkyBands, fallbackWcs);
    if (!parsed.skyBands) return { candidate: parsed, gridJson: '', recipeFiles: [] };
    const verified = await verifySkyBandSource({ id: parsed.id, width: parsed.wcs.referenceDimension[0], height: parsed.wcs.referenceDimension[1], wcs: parsed.wcs, skyBands: parsed.skyBands }, root);
    return { candidate: parsed, gridJson: JSON.stringify(verified.recipe.grid), recipeFiles: verified.files };
  };
  const implementation = async (path: string) => ({ path, sha256: hash(await readFile(resolve(root, path))) });
  const operator = await implementation('labs/nebula/packages/reconstruction/src/registration/fixed-catalogue.ts');
  const stars = { query: recipe.stars.query, path: recipe.stars.path, sha256: recipe.stars.sha256 };
  const gate = async (source: SkyBandCandidate, blueChannel: string, variant = '') => {
    const result = await verifyFixedCatalogue(resolve(root, source.path), source.sha256, source.wcs, resolve(root, recipe.stars.path));
    const matchedPath = `.local/nebula-lab/smc-registration/sky-bands/${source.id}${variant}/matched-stars.json`, matched = Buffer.from(JSON.stringify(result.matches));
    await mkdir(dirname(resolve(root, matchedPath)), { recursive: true }); await writeFile(resolve(root, matchedPath), matched);
    // The operator names its detection channel after its first use; this composite's blue channel is recorded beside it.
    return { ...result.receipt, source: { ...result.receipt.source, path: source.path }, catalogue: { ...result.receipt.catalogue, path: recipe.stars.path, query: recipe.stars.query },
      compositeBlueChannel: blueChannel, ...(source.skyBands ? { skyBands: source.skyBands } : {}), implementation: operator, matchedStars: { path: matchedPath, sha256: hash(matched) } };
  };
  const passed = new Map<string, { candidate: SkyBandCandidate; gridJson: string; gatePass: boolean; receipt: Pin }>();
  const summary = [];
  for (const check of recipe.catalogueChecks) {
    const source = await candidate(check.imageId), receipt = await gate(source.candidate, check.blueChannel);
    await writeJson(resolve(root, check.receipt), receipt);
    passed.set(check.imageId, { candidate: source.candidate, gridJson: source.gridJson, gatePass: receipt.pass, receipt: { path: check.receipt, sha256: hash(await readFile(resolve(root, check.receipt))) } });
    summary.push({ imageId: check.imageId, kind: 'catalogue', pass: receipt.pass, gates: receipt.gates, uniqueMatchedStars: receipt.uniqueMatchedStars,
      reserved: receipt.reservedCheckResidualNativeWisePixels, shiftedControls: receipt.shiftedControls.map(control => control.matchesWithin2_5Pixels) });
    console.log(`SKY_BAND_CATALOGUE_GATE ${check.imageId} ${receipt.pass ? 'pass' : 'fail'}`);
  }
  for (const check of recipe.fixedWcsChecks) {
    const source = await candidate(check.imageId, false), receipt = await gate(source.candidate, check.blueChannel);
    await writeJson(resolve(root, check.receipt), receipt);
    summary.push({ imageId: check.imageId, kind: 'fixed-wcs', pass: receipt.pass, gates: receipt.gates, uniqueMatchedStars: receipt.uniqueMatchedStars,
      reserved: receipt.reservedCheckResidualNativeWisePixels, chanceExcess: receipt.chanceExcess });
    console.log(`FIXED_WCS_CATALOGUE_GATE ${check.imageId} ${receipt.pass ? 'pass' : 'fail'}`);
  }
  for (const control of recipe.negativeControls) {
    const source = await candidate(control.imageId, false, control.wcs);
    const receipt = await gate({ ...source.candidate, wcs: control.wcs }, control.blueChannel, `-${control.label}`);
    await writeJson(resolve(root, control.receipt), { ...receipt, negativeControl: control.label,
      role: 'known-bad fixed WCS; this receipt must report pass: false for the protocol to be accepted' });
    summary.push({ imageId: control.imageId, kind: 'negative-control', label: control.label, pass: !receipt.pass, gatePass: receipt.pass,
      gates: receipt.gates, uniqueMatchedStars: receipt.uniqueMatchedStars, reserved: receipt.reservedCheckResidualNativeWisePixels, chanceExcess: receipt.chanceExcess });
    console.log(`NEGATIVE_CONTROL ${control.imageId} ${control.label} ${receipt.pass ? 'QUALIFIED (protocol defect)' : 'refused'}`);
  }
  for (const transfer of recipe.gridTransfers) {
    const reference = passed.get(transfer.referenceId)!, target = await candidate(transfer.imageId);
    const diagnostic = await gate(target.candidate, transfer.blueChannel);
    await writeJson(resolve(root, transfer.diagnostic), { ...diagnostic, role: 'diagnostic only: this receipt does not qualify the image' });
    const decision = gridTransferDecision(reference, target);
    const receipt = { schema: 'cssearth-sky-band-grid-transfer@1', pass: decision.pass, checks: decision.checks,
      source: { id: target.candidate.id, path: target.candidate.path, sha256: target.candidate.sha256, skyBands: target.candidate.skyBands, recipeFiles: target.recipeFiles },
      reference: { id: reference.candidate.id, path: reference.candidate.path, sha256: reference.candidate.sha256, skyBands: reference.candidate.skyBands, catalogueGate: reference.receipt },
      grid: JSON.parse(target.gridJson), wcs: target.candidate.wcs, stars,
      diagnostic: { receipt: { path: transfer.diagnostic, sha256: hash(await readFile(resolve(root, transfer.diagnostic))) }, pass: diagnostic.pass, gates: diagnostic.gates,
        uniqueMatchedStars: diagnostic.uniqueMatchedStars, reservedCheckResidualNativeWisePixels: diagnostic.reservedCheckResidualNativeWisePixels,
        shiftedControls: diagnostic.shiftedControls, detectedStars: diagnostic.detectedStars },
      implementation: [await implementation('labs/nebula/packages/lab/src/cli/commands/sky-band-registration.ts'), await implementation('tools/objects/observation/sky-band-composite.mts'), operator],
      interpretation: 'The composite is pinned to bytes that only the sky band compositor produces after checking every hips2fits band header against this exact TAN grid (no rotation, distortion or unit cards). The grid itself is qualified by the reference composite, which passed the unchanged fixed-WCS catalogue gate on the identical grid.',
      limitations: ['The transfer qualifies the request grid and its pixel convention. It does not independently measure this survey\'s own HiPS astrometry; the diagnostic receipt records what its own stars show.',
        'Catalogue and reference image share the AllWISE mission.'] };
    await writeJson(resolve(root, transfer.receipt), receipt);
    summary.push({ imageId: transfer.imageId, kind: 'grid-transfer', pass: receipt.pass, referenceId: transfer.referenceId, diagnosticPass: diagnostic.pass,
      diagnosticGates: diagnostic.gates, diagnosticReserved: diagnostic.reservedCheckResidualNativeWisePixels, diagnosticShiftedControls: diagnostic.shiftedControls.map(control => control.matchesWithin2_5Pixels) });
    console.log(`SKY_BAND_GRID_TRANSFER ${transfer.imageId} ${receipt.pass ? 'pass' : 'fail'}`);
  }
  console.log(JSON.stringify({ recipe: { path: recipePath, sha256: hash(recipeBytes) }, results: summary }, null, 2));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [path, extra] = process.argv.slice(2);
  if (!path || extra) throw new TypeError('Usage: register-sky-bands <registration.json>');
  const results = await registerSkyBands(process.cwd(), path);
  if (!results.every(result => result.pass)) process.exitCode = 1;
}
