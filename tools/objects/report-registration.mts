/**
 * The registration stage's numbers as a body README states them, generated from the prepared report so no residual
 * is ever typed by hand. The README carries the block between two markers; `--write` replaces it, and the shared
 * test refuses a README whose block differs from what its prepared report gives.
 *
 *   node tools/objects/report-registration.mts <object-id>          print the block
 *   node tools/objects/report-registration.mts <object-id> --write  write it between the markers in the body README
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '../source-values.mts';

export const REGISTRATION_BLOCK_BEGIN = '<!-- registration-report:begin -->';
export const REGISTRATION_BLOCK_END = '<!-- registration-report:end -->';

const degrees = (value: unknown, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}°` : '—';
const ratio = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';

/** The block for one object's prepared surfaces, or null when no lens carries a registration stage. */
export function registrationBlock(surfaces: unknown): string | null {
  const lenses = requireArray(requireRecord(surfaces).surfaces).map(value => requireRecord(value));
  const rows: string[] = [];
  for (const lens of lenses) {
    const observation = lens.observation === undefined ? undefined : requireRecord(lens.observation);
    const registration = observation?.registration === undefined ? undefined : requireRecord(observation.registration);
    if (!registration || registration.stage === undefined) continue;
    const silhouette = requireRecord(registration.silhouette), reference = requireRecord(registration.reference), id = requireString(lens.id);
    const frames = requireArray(silhouette.frames).length, scored = Number(silhouette.scored);
    const referenceKind = reference.kind === 'observation' ? `the \`${String(reference.observation)}\` map` : reference.kind === 'frames' ? `its other ${String(reference.referenceFrames)} frames` : `none (${String(reference.reason)})`;
    // One or two decisive frames are not a verdict; the median is stated only over at least the rule's count.
    const rule = requireRecord(reference.rule), enough = Number(reference.decisive) >= Number(rule.minimumFrames ?? 3);
    rows.push(`| \`${id}\` | ${frames} | ${scored} | ${degrees(silhouette.rmsDegrees)} | ${degrees(silhouette.noiseFloorDegrees)} | ${degrees(silhouette.systematicDegrees)} | ${referenceKind} | ${String(reference.decisive)} of ${requireArray(reference.frames).length} | ${enough ? degrees(reference.medianOffsetDegrees) : '—'} |`);
  }
  if (!rows.length) return null;
  return [
    'Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.',
    '',
    '| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors, and their median offset from the stated camera, stated only over three or more decisive frames.',
  ].join('\n');
}

/** The README with the block replaced between its markers, or unchanged when it carries none. */
export function withRegistrationBlock(readme: string, block: string | null) {
  const begin = readme.indexOf(REGISTRATION_BLOCK_BEGIN), end = readme.indexOf(REGISTRATION_BLOCK_END);
  if (begin < 0 || end < 0 || end < begin) return { readme, replaced: false };
  const inside = block === null ? '' : `\n${block}\n`;
  return { readme: readme.slice(0, begin + REGISTRATION_BLOCK_BEGIN.length) + inside + readme.slice(end), replaced: true };
}

export async function registrationBlockFor(objectDirectory: string) {
  return registrationBlock(JSON.parse(await readFile(resolve(objectDirectory, 'prepared/surfaces.json'), 'utf8')));
}

const invoked = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invoked) {
  const [objectId, flag] = process.argv.slice(2);
  if (!objectId || (flag !== undefined && flag !== '--write')) { console.error('usage: node tools/objects/report-registration.mts <object-id> [--write]'); process.exit(2); }
  const directory = resolve(import.meta.dirname, '../../src/objects', objectId), block = await registrationBlockFor(directory);
  if (block === null) { console.log(`${objectId}: no lens carries a registration stage.`); process.exit(0); }
  console.log(block);
  if (flag === '--write') {
    const path = resolve(directory, 'README.md'), { readme, replaced } = withRegistrationBlock(await readFile(path, 'utf8'), block);
    if (!replaced) throw new Error(`${objectId}/README.md carries no registration-report markers.`);
    await writeFile(path, readme);
    console.log(`Wrote the block into ${objectId}/README.md.`);
  }
}
