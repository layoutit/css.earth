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
import { hasErrorCode, requireArray, requireRecord, requireString } from '../sources/source-values.mts';
import { COMPARISON_SPEC_FILE, parseComparisonSpec } from './surface-observations/published-comparison.mts';
import { offsetAgreementDegrees, VERDICT_DEGREES } from './surface-observations/registration.mts';
import { OBSERVER_CAMERAS_FILE, parseObserverCameras } from './terrestrial-layers/observer-cameras.mts';

export const REGISTRATION_BLOCK_BEGIN = '<!-- registration-report:begin -->';
export const REGISTRATION_BLOCK_END = '<!-- registration-report:end -->';

const degrees = (value: unknown, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}°` : '—';
const ratio = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';

/**
 * Whether a lens registers: every measurement that reached a verdict (the outline over three or more scored frames, a
 * reference or the relief over their decisive minimum, and only when those decisive offsets agree with each other to
 * within the same gate) places it within three degrees, and at least one did.
 */
export function registrationVerdict(registration: Record<string, unknown>): 'registered' | 'conflict' | 'no verdict' {
  const silhouette = requireRecord(registration.silhouette), measured: unknown[] = [];
  if (Number(silhouette.scored) >= 3) measured.push(silhouette.systematicDegrees);
  for (const report of [registration.reference, registration.relief]) {
    if (report === undefined) continue;
    const record = requireRecord(report), rule = requireRecord(record.rule), minimumFrames = Number(rule.minimumFrames ?? 3);
    if (Number(record.decisive) < minimumFrames) continue;
    // A sweep whose decisive offsets disagree by more than the gate has measured nothing to compare against it.
    const agreement = offsetAgreementDegrees(requireArray(record.frames) as Parameters<typeof offsetAgreementDegrees>[0], minimumFrames);
    if (agreement !== null && agreement > VERDICT_DEGREES) continue;
    measured.push(record.medianOffsetDegrees);
  }
  const offsets = measured.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return !offsets.length ? 'no verdict' : offsets.every(value => Math.abs(value) <= VERDICT_DEGREES) ? 'registered' : 'conflict';
}

/** A lens that ships on its paper's comparison figure, as the block states it: the figure and the paper's DOI. */
export interface ShippedComparison { lensId: string; figure: string; source: string }

/** The block for one object's prepared surfaces, or null when no lens carries a registration stage. */
export function registrationBlock(surfaces: unknown, comparisons: readonly ShippedComparison[] = []): string | null {
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
    const relief = registration.relief === undefined ? undefined : requireRecord(registration.relief);
    const reliefCell = relief ? `${String(relief.decisive)} of ${requireArray(relief.frames).length}${Number(relief.decisive) >= Number(requireRecord(relief.rule).minimumFrames ?? 3) ? `, ${degrees(relief.medianOffsetDegrees)}` : ''}` : '—';
    const refinement = registration.refinement === undefined ? undefined : requireRecord(registration.refinement);
    const turn = refinement?.turn === undefined ? undefined : requireRecord(refinement.turn), tilt = refinement?.tilt === undefined ? undefined : requireRecord(refinement.tilt);
    const reverted = refinement?.reverted === undefined ? {} : requireRecord(refinement.reverted);
    const parts = [turn ? (turn.applied ? `turned ${degrees(turn.turnDegrees)} by ${String(turn.by)}` : reverted.turn ? `turn reverted: ${String(reverted.turn)}` : `turn declined: ${String(turn.reason)}`) : '',
      tilt ? (tilt.applied ? `tilted ${degrees(tilt.tiltDegrees)} by the silhouette` : reverted.tilt ? `tilt reverted: ${String(reverted.tilt)}` : `tilt declined: ${String(tilt.reason)}`) : ''].filter(Boolean);
    const refinedCell = !refinement ? '—' : parts.join('; ');
    // Seams: the largest level mismatch an accepted overlap still shows after the fit, and how many frame groups no overlap joins.
    const levels = observation?.levelMatching === undefined || observation.levelMatching === null ? undefined : requireRecord(observation.levelMatching);
    const residuals = levels ? requireArray(levels.pairs).map(value => requireRecord(value).residualLogRatio).filter((value): value is number => typeof value === 'number') : [];
    const groups = levels?.groups === undefined ? 1 : requireArray(levels.groups).length;
    const seamCell = !levels ? '—' : `${residuals.length ? `×${Math.exp(Math.max(...residuals.map(Math.abs))).toFixed(2)}` : 'no overlap'}${groups > 1 ? `, ${groups} unjoined groups` : ''}`;
    rows.push(`| \`${id}\` | ${frames} | ${scored} | ${degrees(silhouette.rmsDegrees)} | ${degrees(silhouette.noiseFloorDegrees)} | ${degrees(silhouette.systematicDegrees)} | ${referenceKind} | ${String(reference.decisive)} of ${requireArray(reference.frames).length} | ${enough ? degrees(reference.medianOffsetDegrees) : '—'} | ${reliefCell} | ${refinedCell} | ${seamCell} | ${registrationVerdict(registration)} |`);
  }
  if (!rows.length) return null;
  return [
    'Measured by the registration stage when the body was last prepared; the numbers are read from [`prepared/surfaces.json`](prepared/surfaces.json), not typed.',
    '',
    '| Lens | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    ...comparisons.filter(comparison => rows.some(row => row.startsWith(`| \`${comparison.lensId}\` |`))).flatMap(comparison => ['',
      `\`${comparison.lensId}\` ships on its paper\u2019s comparison, [${comparison.figure}](${comparison.source}), measured in [\`evidence/published-comparison.json\`](evidence/published-comparison.json); its verdict is reported, not a gate.`]),
    '',
    'Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh\'s own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the lens, or why it declined; the other columns then measure the turned lens. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the lens ships on its paper’s comparison figure, which its observer-cameras record names.',
  ].join('\n');
}

/** The README with the block replaced between its markers, or unchanged when it carries none. */
export function withRegistrationBlock(readme: string, block: string | null) {
  const begin = readme.indexOf(REGISTRATION_BLOCK_BEGIN), end = readme.indexOf(REGISTRATION_BLOCK_END);
  if (begin < 0 || end < 0 || end < begin) return { readme, replaced: false };
  const inside = block === null ? '' : `\n${block}\n`;
  return { readme: readme.slice(0, begin + REGISTRATION_BLOCK_BEGIN.length) + inside + readme.slice(end), replaced: true };
}

/** The comparison a body's ground-based lens ships on, from its observer-cameras record and comparison spec, or none. */
export async function shippedComparisons(objectDirectory: string): Promise<ShippedComparison[]> {
  let record;
  try { record = parseObserverCameras(JSON.parse(await readFile(resolve(objectDirectory, 'source', OBSERVER_CAMERAS_FILE), 'utf8'))); } catch (error) { if (hasErrorCode(error, 'ENOENT')) return []; throw error; }
  if (!record.publishedComparison) return [];
  const spec = parseComparisonSpec(JSON.parse(await readFile(resolve(objectDirectory, 'source', COMPARISON_SPEC_FILE), 'utf8')));
  return [{ lensId: spec.lensId, figure: spec.figure, source: spec.source }];
}

export async function registrationBlockFor(objectDirectory: string) {
  return registrationBlock(JSON.parse(await readFile(resolve(objectDirectory, 'prepared/surfaces.json'), 'utf8')), await shippedComparisons(objectDirectory));
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
