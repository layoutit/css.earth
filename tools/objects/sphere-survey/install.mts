/**
 * Write a survey photograph lens into a body's package, from a fresh setup run.
 *
 *   node tools/objects/sphere-survey/install.mts <object-id>
 *
 * The run is rebuilt first, so the package receives exactly what was just measured: the frames, the ADAM mesh, both
 * Horizons tables and the spin record where they are new, the recipe, the observer-cameras and comparison records and
 * the manifest. Around them it writes what a shipped lens needs: download operations, the lens control, reader text,
 * the ledger's decision and the entries it closes, the README's source rows and generated evidence blocks, credits and
 * the evidence itself, then re-pins the package's documents. Preparation, the registration block, source records and
 * publishing follow with their own commands, which it prints.
 */
import { execFileSync } from 'node:child_process';
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authorSourceRecords } from '../../author-source-records.mts';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { REGISTRATION_BLOCK_BEGIN, REGISTRATION_BLOCK_END } from '../report-registration.mts';
import { COMPARISON_BLOCK_BEGIN, COMPARISON_BLOCK_END, PHASE_SWEEP_STEP_DEGREES, comparisonBlock, parseComparisonEvidence, phaseAgreement, withComparisonBlock, type ComparisonEvidence, type PhaseAgreement } from '../surface-observations/published-comparison.mts';
import { OBSERVER_CAMERAS_FILE } from '../terrestrial-layers/observer-cameras.mts';
import { LAM, LAM_HEADERS, framesUrl, shapeUrl } from './lam.mts';
import { INVESTIGATION_SURVEY_DIRECTORY } from '../../investigation-survey.mts';
import { LENS_ID, buildSetup, leaveOutArgument, localCopy } from './setup.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const COMPARISON_ENTRY = `${LENS_ID}-published-comparison`;
const readJson = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const writeJson = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

/** The ledger's account of a published comparison, from its evidence and the spin record's reading; nothing in it is typed. */
/** The ledger entries a SPHERE photograph lens answers when it is installed. */
const ANSWERED = ['surface-imagery', 'lam-adam-alternative', 'sphere-cross-frame-registration'];

export function decisionFinding(figure: string, evidence: ComparisonEvidence, columnOrder: { order: string; separationDegrees: number }) {
  const models = evidence.columns.map(column => column.overlapWithModel), same = evidence.columns.map(column => column.sameShapeOverlap);
  const agreements = evidence.columns.map(column => ({ column, agreement: phaseAgreement(column) }));
  const count = (kind: PhaseAgreement) => agreements.filter(entry => entry.agreement === kind).length;
  const elsewhere = agreements.filter(entry => entry.agreement === 'unresolved').map(({ column }) =>
    `at ${column.bestTurnDegrees}° by ${(Math.max(...Object.values(column.turns)) - column.turns['0']).toFixed(3)}, less than the ${(1 - column.sameShapeOverlap).toFixed(3)} the same shape loses to pixel size`);
  const sweepText = `it peaks at our phase in ${count('at')} of ${evidence.columns.length} columns${count('step') ? `, one step from it in ${count('step')}` : ''}${elsewhere.length ? `, and elsewhere in ${elsewhere.length}: ${elsewhere.join('; ')}` : ''}`;
  const ours = evidence.columns.flatMap(column => column.axis.oursDegrees ?? []), theirs = evidence.columns.flatMap(column => column.axis.paperDegrees ?? []);
  const sweep = Object.entries(evidence.nativeOutline.residualPixels).map(([offset, pixels]) => ({ offset: Number(offset), pixels })).sort((a, b) => a.pixels - b.pixels || Math.abs(a.offset) - Math.abs(b.offset));
  return `Measured with tools/objects/sphere-survey/setup.mts against Vernazza et al. (2021) Figure ${figure}, the survey’s comparison of these frames with its models. Outline overlap with the paper’s ADAM panels ${span(models)} at our phase, against ${span(same)} for our own outline drawn at the paper’s pixel scale; over a full turn in ${PHASE_SWEEP_STEP_DEGREES}° steps ${sweepText}. With the paper’s photographs ${span(evidence.columns.map(column => column.overlapWithPhotograph))}. Turned in the image, our outline best overlaps the paper’s photographs at ${span(evidence.columns.map(column => column.imageTurnDegrees.photograph), 1)}° and its model panels at ${span(evidence.columns.map(column => column.imageTurnDegrees.model), 1)}°. The spin axis we project lies at ${span(ours, 1)}° on the sky against ${span(theirs, 1)}° for the figure’s arrows. Native outline residual ${evidence.nativeOutline.residualPixelsAtZero.toFixed(3)} px mean over ${evidence.nativeOutline.frames} frames at our phase${sweep[0].offset === 0 ? ', the lowest of a ±30° sweep' : `; the sweep’s lowest is ${sweep[0].pixels.toFixed(3)} px at ${sweep[0].offset}°`}. The figure’s column labels were read from its pixels, and each names a frame’s exposure start to the second. The release rotation record reads ${columnOrder.order}, ${columnOrder.separationDegrees}° from the published pole.`;
}

/** Nights as a reader says them: one date, two joined, or the first and last of several. */
export function nightsText(nights: readonly string[]) {
  if (nights.length === 1) return nights[0];
  if (nights.length === 2) return `${nights[0]} and ${nights[1]}`;
  return `${nights.length} nights from ${nights[0]} to ${nights.at(-1)}`;
}
const years = (nights: readonly string[]) => [...new Set(nights.map(night => night.slice(0, 4)))].join('–');
const span = (values: readonly number[], digits = 3) => { const low = Math.min(...values).toFixed(digits), high = Math.max(...values).toFixed(digits); return low === high ? low : `${low} to ${high}`; };

export async function installSetup(objectId: string, options: { leaveOut?: readonly string[]; because?: string; replace?: boolean } = {}) {
  const objectDirectory = resolve(ROOT, 'src/objects', objectId), packageSource = resolve(objectDirectory, 'source');
  const recipe = await readJson(resolve(packageSource, 'preparation/terrestrial.json'));
  const lenses = requireRecord(recipe.raster).surfaceObservations;
  const earlier = Array.isArray(lenses) ? lenses.map(lens => requireRecord(lens)).find(lens => lens.id === LENS_ID) : undefined;
  if (earlier && !options.replace) throw new Error(`${objectId} already has a ${LENS_ID} lens; the setup run compares with it and installs nothing. --replace rebuilds it from the setup.`);
  const earlierFrames = earlier ? requireArray(earlier.frames).map(frame => requireString(requireRecord(frame).path)) : [];
  const leaveOut = options.leaveOut ?? [];
  if (leaveOut.length > 0 && !options.because?.trim()) throw new Error('A frame left out needs its reason: --because=<why>.');
  const setup = await buildSetup(objectId, { leaveOut }), work = resolve(ROOT, 'output/sphere-survey', objectId), scratch = resolve(work, 'source');
  const leftOutText = leaveOut.length ? `Left out by name: ${leaveOut.join(', ')}. ${options.because?.trim()}` : '';
  const { number, name, figure } = setup.survey, evidence = parseComparisonEvidence(setup.evidence);
  const disagreeing = evidence.columns.filter(column => phaseAgreement(column) === 'elsewhere');
  if (disagreeing.length > 0) throw new Error(`${objectId}'s rotation and the paper's model disagree in ${disagreeing.map(column => `${column.label} (best at ${column.bestTurnDegrees}°)`).join(', ')}; nothing installed.`);
  const today = new Date().toISOString().slice(0, 10), commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const lensFrames = setup.apparition.frames, nights = setup.apparition.nights, onAdam = setup.lensMesh === 'adam';
  // The mesh the lens rides, named as the Shape view's source when the release has no ADAM mesh for the body.
  const primaryPath = requireString(requireRecord(requireRecord(recipe.geometry).radialTerrain).path);
  const primaryInput = requireArray((await readJson(resolve(packageSource, 'manifest.json'))).inputs).map(value => requireRecord(value)).find(input => input.path === primaryPath);
  const meshSource = onAdam ? `${objectId}-adam-shape` : requireString(primaryInput?.id, 'primary shape input');
  const meshWords = onAdam ? 'the ADAM reconstruction from the same survey. The survey’s rotation record describes that frame, so the photograph rides it rather than the model the Shape view uses.'
    : 'the released reconstruction the Shape view uses; the release publishes no ADAM mesh for this body.';

  // Source files and records, exactly as the run measured them.
  for (const path of setup.written) {
    await mkdir(dirname(resolve(packageSource, path)), { recursive: true });
    await copyFile(resolve(scratch, path), resolve(packageSource, path));
  }
  // A replaced lens's frames that the setup no longer selects leave the package: file, pin and source record.
  const dropped = earlierFrames.filter(path => !setup.written.includes(path));
  if (dropped.length > 0) {
    const manifest = await readJson(resolve(packageSource, 'manifest.json')), inputs = requireArray(manifest.inputs).map(value => requireRecord(value));
    for (const input of inputs) if (dropped.includes(requireString(input.path))) await rm(resolve(ROOT, 'src/sources', `source-${objectId}-${requireString(input.id)}.json`), { force: true });
    manifest.inputs = inputs.filter(input => !dropped.includes(requireString(input.path)));
    await writeJson(resolve(packageSource, 'manifest.json'), manifest);
    for (const path of dropped) await rm(resolve(packageSource, path), { force: true });
  }
  // Frame files on disk that the manifest does not declare, an earlier attempt's or a frame left out, would stop preparation.
  const declared = new Set(requireArray((await readJson(resolve(packageSource, 'manifest.json'))).inputs).map(value => requireString(requireRecord(value).path)));
  for (const file of await readdir(resolve(packageSource, 'observations')).catch(() => [] as string[])) if (!declared.has(`observations/${file}`)) await rm(resolve(packageSource, 'observations', file), { force: true });
  // Every new input is bound to a catalogue record now, with placeholder evidence, because the first preparation step
  // validates the manifest; the evidence is pinned after the manifest is committed.
  const bound = await authorSourceRecords({ root: ROOT, objectId });
  const cameras = await readJson(resolve(packageSource, OBSERVER_CAMERAS_FILE));
  cameras.publishedComparison = { ledgerEntry: COMPARISON_ENTRY };
  await writeJson(resolve(packageSource, OBSERVER_CAMERAS_FILE), cameras);

  // Download operations for every new input with a LAM origin.
  const manifest = await readJson(resolve(packageSource, 'manifest.json'));
  const inputs = requireArray(manifest.inputs).map(value => requireRecord(value));
  const plan = await readJson(resolve(packageSource, 'preparation/acquisition.json'));
  const operations = requireArray(plan.operations).map(value => requireRecord(value)).filter(operation => !dropped.includes(String(operation.path)));
  for (const input of inputs) {
    const path = requireString(input.path), origin = typeof input.origin === 'string' ? input.origin : '';
    if (!setup.written.includes(path) || !origin.startsWith(LAM) || operations.some(operation => operation.path === path)) continue;
    operations.push({ kind: 'download', groups: ['restore', 'refresh'], path, url: origin, headers: { ...LAM_HEADERS } });
  }
  plan.operations = operations;
  await writeJson(resolve(packageSource, 'preparation/acquisition.json'), plan);

  // The lens control and its reader text.
  const content = await readJson(resolve(packageSource, 'content/object.json')), controls = requireArray(requireRecord(content.lenses).controls);
  const controlAt = controls.findIndex(entry => requireRecord(entry).id === LENS_ID);
  if (controlAt >= 0) controls.splice(controlAt, 1);
  controls.splice(controlAt >= 0 ? controlAt : controls.length, 0, { id: LENS_ID, label: 'SPHERE photograph', thumbnail: `/scenes/${objectId}/${objectId}-${LENS_ID}-thumbnail.webp`,
    surface: `${objectId}-${LENS_ID}-surface@2x.webp`, poles: `${objectId}-${LENS_ID}-surface@2x.webp`, source: { id: meshSource, path: '../manifest.json' },
    falseColor: false, noData: true,
    notes: `${lensFrames} deconvolved VLT/SPHERE/ZIMPOL frames, ${nightsText(nights)}, cast onto ${meshWords} Pointing and orientation are computed from that record, JPL Horizons geometry and each frame’s header, at the midpoint of its exposure; the disc centre is fitted to the limb of the mesh. With these cameras the mesh reproduces Vernazza et al. (2021) Figure ${figure}. Grayscale is photographed illumination and matched relative frame brightness. The deconvolution carries no radiometric calibration, so this is not measured albedo or colour. The grid marks surface that was unphotographed, too grazing, or rejected.` });
  await writeJson(resolve(packageSource, 'content/object.json'), content);
  const text = await readJson(resolve(objectDirectory, 'text.json'));
  requireRecord(text.datasets)[LENS_ID] = { title: 'ZIMPOL deconvolved imaging', detail: `${lensFrames} frames, ${years(nights)}`,
    summary: 'Telescope images of the lit surface, placed by the asteroid’s own measured spin. Grey is photographed light, not colour.' };
  await writeJson(resolve(objectDirectory, 'text.json'), text);

  // The ledger: the decision, and the entries it answers.
  const ledger = await readJson(resolve(objectDirectory, 'investigations.json')), entries = requireArray(ledger.entries).map(value => requireRecord(value));
  const check = { date: today, commit }, listing = framesUrl(number, name), adam = shapeUrl(number, name, 'adam');
  const unused = setup.apparition.released - lensFrames - leaveOut.length;
  const decision = {
    id: COMPARISON_ENTRY, subject: `Vernazza et al. (2021) Figure ${figure} as the registration of the SPHERE photograph lens`, status: 'included',
    finding: [decisionFinding(figure, evidence, setup.columnOrder), leftOutText].filter(Boolean).join(' '),
    evidence: [setup.evidence.source, listing, ...(onAdam ? [adam] : [])], checked: [check] };
  const at = entries.findIndex(entry => entry.id === COMPARISON_ENTRY);
  if (at >= 0) entries[at] = decision; else entries.push(decision);
  // An entry the decision answers that quotes a shared record takes the record's subject and finding as its own first,
  // so this body's answer can be added to it without rewriting the record every other body quotes.
  for (const [index, entry] of entries.entries()) {
    if (!ANSWERED.includes(requireString(entry.id)) || entry.survey === undefined) continue;
    const shared = requireRecord(await readJson(resolve(ROOT, INVESTIGATION_SURVEY_DIRECTORY, `${requireString(entry.survey)}.json`)));
    const { survey: _survey, ...own } = entry;
    entries[index] = { id: own.id, subject: requireString(shared.subject), status: own.status, finding: requireString(shared.finding),
      evidence: [...(Array.isArray(shared.evidence) ? shared.evidence : []), ...requireArray(own.evidence)], checked: own.checked };
  }
  const close = (id: string, finding: (earlier: string) => string, link?: string) => {
    const entry = entries.find(candidate => candidate.id === id);
    if (!entry) return;
    entry.status = 'included'; entry.finding = finding(requireString(entry.finding)); delete entry.revisitWhen;
    const links = requireArray(entry.evidence).map(value => requireString(value));
    if (link && !links.includes(link)) links.push(link);
    entry.evidence = links; entry.checked = [...requireArray(entry.checked), check];
  };
  close('surface-imagery', earlier => `Included ${today} as the SPHERE photograph lens: ${lensFrames} camera-1 deconvolved frames, ${nightsText(nights)}, cast onto the ${onAdam ? 'ADAM' : 'primary'} mesh with cameras computed from the release rotation record, JPL Horizons and each frame’s header. Its registration is the published comparison recorded in ${COMPARISON_ENTRY}.${unused ? ` The other ${unused} released camera-1 frames are not used: a lens keeps one apparition and at most 32 frames.` : ''}${leftOutText ? ` ${leftOutText}` : ''} Earlier finding, kept: ${earlier}`, listing);
  close('lam-adam-alternative', earlier => `${earlier} Reopened ${today} because its condition was met: the SPHERE photograph lens rides this ADAM mesh, the model the survey’s rotation record and Figure ${figure} describe; the Shape and Elevation views keep MPCD.`);
  close('sphere-cross-frame-registration', earlier => `Decided ${today} by the published comparison instead: the lens is prepared from ${lensFrames} camera-1 frames on the ${onAdam ? 'ADAM' : 'primary'} mesh with the rotation record read ${setup.columnOrder.order}, and ships on ${COMPARISON_ENTRY}; the registration stage’s numbers are in the README. Earlier result, kept: ${earlier}`);
  ledger.entries = entries;
  await writeJson(resolve(objectDirectory, 'investigations.json'), ledger);

  // The asteroid package anchors list each package's lenses; a body with a row gains this one, edited in place so the
  // file's own number formatting survives.
  const anchorsPath = resolve(ROOT, 'tests/objects/unit/anchors/asteroid-packages.json');
  await writeFile(anchorsPath, withAnchoredLens(await readFile(anchorsPath, 'utf8'), objectId, LENS_ID));

  // Evidence, README and credits.
  await mkdir(resolve(objectDirectory, 'evidence'), { recursive: true });
  for (const file of ['published-comparison.json', 'published-comparison.webp']) await copyFile(resolve(work, 'evidence', file), resolve(objectDirectory, 'evidence', file));
  const lens = requireArray(requireRecord((await readJson(resolve(packageSource, 'preparation/terrestrial.json'))).raster).surfaceObservations).map(value => requireRecord(value)).find(entry => entry.id === LENS_ID);
  const latitudes = requireArray(requireRecord(lens).frames).map(frame => Number(requireRecord(frame).observerLatitude));
  if (earlier) {
    // A replaced lens keeps its package's own words; the comparison block is refreshed where the README carries one.
    const readme = await readFile(resolve(objectDirectory, 'README.md'), 'utf8');
    if (readme.includes(COMPARISON_BLOCK_BEGIN)) await writeFile(resolve(objectDirectory, 'README.md'), withComparisonBlock(readme, comparisonBlock(evidence)).readme);
    else console.log(`${objectId}: the README has no comparison block; describe the rebuilt lens there and in NOTICE.md by hand.`);
  } else {
    await writeFile(resolve(objectDirectory, 'README.md'), readmeWithLens(await readFile(resolve(objectDirectory, 'README.md'), 'utf8'),
      { number, name, figure, lensFrames, nights, order: setup.columnOrder.order, source: setup.evidence.source, spinRecordUrl: setup.spinRecordUrl, block: comparisonBlock(evidence),
        bodyName: name, latitudes: [Math.min(...latitudes), Math.max(...latitudes)], leftOut: leftOutText }));
    await writeFile(resolve(objectDirectory, 'NOTICE.md'), noticeWithLens(await readFile(resolve(objectDirectory, 'NOTICE.md'), 'utf8'), figure));
  }

  execFileSync(process.execPath, [resolve(ROOT, 'tools/pin-object-documents.mts'), objectId], { cwd: ROOT, stdio: 'inherit' });
  const { restored, missing } = await restorePinnedInputs(objectId), moved = await moveUnownedSceneFiles(objectId);
  if (restored.length) console.log(`Copied ${restored.length} pinned input(s) from sibling checkouts by hash: ${restored.join(', ')}.`);
  if (missing.length) console.log(`Still missing, restore them before preparing (node tools/objects/dist/operations.js acquire ${objectId}): ${missing.join(', ')}.`);
  if (moved.length) console.log(`Moved ${moved.length} scene file(s) no inventory owns to output/stale-public/${objectId}/; preparation refuses unowned assets.`);
  console.log([`Installed ${objectId}'s ${LENS_ID} lens and bound ${bound.bindings.length} new inputs to ${bound.records.length} new source records. Next:`,
    `  node tools/prepare-object.mts ${objectId}`, `  node tools/objects/report-registration.mts ${objectId} --write`,
    `  commit, then pnpm author:sources ${objectId} --evidence <commit> and commit again`, `  pnpm publish:runtime-assets --object=${objectId}`].join('\n'));
}

/** An anchor table with a lens appended to one body's `lenses`, as text; a body without a row, or already listing it, is unchanged. */
export function withAnchoredLens(text: string, objectId: string, lensId: string) {
  const row = text.indexOf(`"${objectId}": {`);
  if (row < 0) return text;
  const open = text.indexOf('"lenses": [', row), close = text.indexOf(']', open);
  if (open < 0 || close < 0 || text.slice(row, open).includes('}')) throw new Error(`The anchor row for ${objectId} states no lenses.`);
  const list = JSON.parse(text.slice(open + '"lenses": '.length, close + 1)) as unknown[];
  if (list.includes(lensId)) return text;
  const lastQuote = text.lastIndexOf('"', close), lineStart = text.lastIndexOf('\n', lastQuote) + 1, indent = text.slice(lineStart, text.indexOf('"', lineStart));
  return `${text.slice(0, lastQuote + 1)},\n${indent}"${lensId}"${text.slice(lastQuote + 1)}`;
}

/** Every pinned input and document preparation will read, copied from a sibling checkout when it is missing here and a byte-identical copy exists. */
export async function restorePinnedInputs(objectId: string) {
  const source = resolve(ROOT, 'src/objects', objectId, 'source'), manifest = await readJson(resolve(source, 'manifest.json'));
  const restored: string[] = [], missing: string[] = [];
  for (const value of [...requireArray(manifest.inputs), ...(Array.isArray(manifest.documents) ? manifest.documents : [])]) {
    const input = requireRecord(value), path = requireString(input.path);
    if (input.expectedSha256 === undefined) continue;
    if (await access(resolve(source, path)).then(() => true, () => false)) continue;
    const bytes = await localCopy(objectId, path, { bytes: Number(input.expectedBytes), sha256: requireString(input.expectedSha256) });
    if (!bytes) { missing.push(path); continue; }
    await mkdir(dirname(resolve(source, path)), { recursive: true });
    await writeFile(resolve(source, path), bytes);
    restored.push(path);
  }
  return { restored, missing };
}

/** Scene files an earlier preparation left that the body's runtime inventory does not own, moved aside rather than deleted. */
export async function moveUnownedSceneFiles(objectId: string) {
  const scenes = resolve(ROOT, 'public/scenes', objectId), owned = await readFile(resolve(ROOT, 'src/objects', objectId, 'runtime-assets.json'), 'utf8').catch(() => null);
  if (owned === null) return [];
  const files = await readdir(scenes).catch(() => [] as string[]), moved: string[] = [];
  for (const file of files) {
    if (owned.includes(`"${file}"`) || owned.includes(`/${file}"`)) continue;
    await mkdir(resolve(ROOT, 'output/stale-public', objectId), { recursive: true });
    await rename(resolve(scenes, file), resolve(ROOT, 'output/stale-public', objectId, file));
    moved.push(file);
  }
  return moved;
}

/** The README with the lens's source rows, a generated comparison section and the registration markers. */
export function readmeWithLens(readme: string, lens: { number: number; name: string; figure: string; lensFrames: number; nights: readonly string[]; order: string; source: string; spinRecordUrl: string; block: string; bodyName: string; latitudes: readonly [number, number]; leftOut?: string }) {
  if (readme.includes(COMPARISON_BLOCK_BEGIN) || readme.includes(REGISTRATION_BLOCK_BEGIN)) throw new Error('The README already carries lens evidence blocks.');
  const lines = readme.split('\n'), evidenceAt = lines.indexOf('## Evidence');
  let lastRow = -1;
  for (let index = 0; index < evidenceAt; index++) if (lines[index].startsWith('| ')) lastRow = index;
  if (evidenceAt < 0 || lastRow < 0) throw new Error('The README has no Sources table and Evidence section to extend.');
  lines.splice(lastRow + 1, 0,
    `| SPHERE photograph | [${lens.lensFrames} deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, ${nightsText(lens.nights)}](${framesUrl(lens.number, lens.name)}) on the [ADAM reconstruction](${shapeUrl(lens.number, lens.name, 'adam')}) |`,
    `| Photograph cameras | [Release rotation record](${lens.spinRecordUrl}), read ${lens.order}, and JPL Horizons geometry from Paranal |`,
    `| Photograph registration | [Vernazza et al. (2021), Figure ${lens.figure}](${lens.source}) |`);
  const at = lines.indexOf('## Evidence');
  lines.splice(at + 1, 0, '', '### SPHERE photograph', '', COMPARISON_BLOCK_BEGIN, COMPARISON_BLOCK_END, '', '### Registration', '', REGISTRATION_BLOCK_BEGIN, REGISTRATION_BLOCK_END, '', '### Shape');
  // The photograph's limits go with the other known problems, before the package links that close the section.
  const problems = lines.indexOf('## Known problems'), footer = lines.findIndex((line, index) => index > problems && (line.startsWith('[Investigation ledger]') || line.startsWith('[Inputs]')));
  if (problems < 0 || footer < 0) throw new Error('The README has no Known problems section ending in the package links.');
  lines.splice(footer, 0, `The SPHERE photograph is photographed illumination from the survey's deconvolved frames, with matched relative frame levels. It is not albedo or colour. The frames see ${lens.bodyName} from ${latitudeSpan(lens.latitudes)}, so surface the survey did not see keeps the missing-imagery grid.${lens.leftOut ? ` ${lens.leftOut}` : ''}`, '');
  return withComparisonBlock(lines.join('\n'), lens.block).readme;
}

/** Sub-observer latitudes as a reader says them: `26° to 35° north`, `64° south`, or `10° south to 20° north`. */
export function latitudeSpan([low, high]: readonly [number, number]) {
  const [a, b] = [Math.round(low), Math.round(high)], side = (value: number) => (value < 0 ? 'south' : 'north');
  if (a === b) return a === 0 ? 'the equator' : `${Math.abs(a)}° ${side(a)}`;
  if (a < 0 && b > 0) return `${-a}° south to ${b}° north`;
  const [near, far] = [Math.abs(a), Math.abs(b)].sort((x, y) => x - y);
  return `${near}° to ${far}° ${side(a + b)}`;
}

/** The credits with the photograph's source and the reproduced figure panels. */
export function noticeWithLens(notice: string, figure: string) {
  const credit = `\`evidence/published-comparison.webp\` reproduces the photograph panels of the article’s Figure ${figure} with outlines drawn over them, under the article’s CC-BY-4.0 licence. The photographic surface is the survey’s own deconvolved VLT/SPHERE/ZIMPOL frames, credited to its authors and to ESO programme 199.C-0074; it carries their photographed illumination and no radiometric calibration, so it is not measured albedo or colour. Its placement reproduces the article’s Figure ${figure}. No photographic texture is attributed to NASA.`;
  const shapeOnly = 'This package does not attribute a photographic surface texture to NASA or ESO.';
  if (notice.includes(shapeOnly)) return notice.replace(shapeOnly, credit);
  const title = notice.indexOf('\n\n');
  return `${notice.slice(0, title)}\n\n${credit}${notice.slice(title)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [objectId, ...rest] = process.argv.slice(2), because = rest.find(arg => arg.startsWith('--because='))?.slice('--because='.length), replace = rest.includes('--replace');
  const leaveOut = leaveOutArgument(rest.filter(arg => !arg.startsWith('--because=') && arg !== '--replace'));
  if (!objectId || leaveOut === null) { console.error('usage: node tools/objects/sphere-survey/install.mts <object-id> [--replace] [--leave-out=<frame-id>,… --because=<why>]'); process.exit(2); }
  await installSetup(objectId, { leaveOut, because, replace });
}
