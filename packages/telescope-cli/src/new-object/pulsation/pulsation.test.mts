import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { parseTecplotLonLat } from '@cssearth/bake/objects/raster';
import { checkGaiaCepheidModel, gaiaMagnitude, parseGaiaCepheidRow } from '@cssearth/bake/photometry';
import { parseSurfaceMaps, surfaceMapFiles } from '../maps/surface-maps.mts';
import { cataloguedPeriodDays, draftsFromPulsation, installPublishedModel, PULSATION_MODEL, PULSATION_ROUTE, withPulsationReadme, withStills } from './pulsation.mts';
import { dimmed, phaseChoice, phaseIndex, PHASES, phaseShares, phaseTable, PULSATION_GENERATOR, PULSATION_STEPS, pulsationStep } from './pulsation-steps.mts';

// RY CMa's row of gaiadr3.vari_cepheid, as the Gaia archive answers the package's acquisition query (2026-10-08).
const ROW = 'source_id,pf,pf_error,fund_freq1,reference_time_g,zp_mag_g,num_harmonics_for_p1_g,fund_freq1_harmonic_ampl_g,fund_freq1_harmonic_phase_g,epoch_g,epoch_g_error,peak_to_peak_g,r21_g,phi21_g,mode_best_classification,type_best_classification\n' +
  '3046774762417915136,4.678368934320488,3.3447766E-5,0.213749709362168,1724.4294646085943,7.862259,4,"(0.25350505, 0.099567614, 0.04259633, 0.016701022, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN)","(1.7284691, 1.6115202, 1.5330073, 1.391616, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)",1710.9697971845542,4.7302285E-5,0.6153273,0.39276382,4.4377675,FUNDAMENTAL,DCEP\n';
const model = parseGaiaCepheidRow(ROW, 'ry-cma'), check = checkGaiaCepheidModel(model, 'ry-cma');
const HOST = () => ({ content: { displayName: 'RY CMa', datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } },
  manifest: { inputs: [{ id: 'ry-cma-gaia-dr3-vari-cepheid', path: PULSATION_MODEL, consumers: ['presentation'] }] },
  raster: { surfaces: [{ id: 'color', output: 'ry-cma-surface-{id}{suffix}.webp', thumbnail: 'ry-cma-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }] }] } } } });
const entry = parseSurfaceMaps({ pulsations: [{ host: 'ry-cma', maps: Array.from({ length: PHASES }, (_, index) => phaseChoice('ry-cma', index)) }] }, 'pulsations', 'pulsation step')[0]!;
const steps = entry.maps.map(choice => pulsationStep(choice, { host: 'ry-cma', name: 'RY CMa', played: true }, model, check));

test('a step is the published model at a tenth of the period after maximum light, as a share of the light at maximum', () => {
  const shares = phaseShares(model, check);
  assert.equal(shares.length, PHASES); assert.ok(Math.abs(shares[0]! - 1) < 1e-6, 'the first step is the model\'s maximum');
  // The arithmetic, restated: 10^(-0.4 (m - m at maximum)) at each tenth of the period from the model's own maximum.
  shares.forEach((share, index) => assert.ok(Math.abs(share - 10 ** (-0.4 * (gaiaMagnitude(model, check.maximumTime + index * model.periodDays / PHASES) - check.brightestMag))) < 1e-12));
  // No step is fainter than the row's own peak-to-peak amplitude allows, and the cycle reaches most of it.
  const floor = 10 ** (-0.4 * model.peakToPeakMag); assert.ok(shares.every(share => share >= floor - 1e-9 && share <= 1 + 1e-9)); assert.ok(Math.min(...shares) < floor + 0.02);
  assert.deepEqual(shares.map(share => Math.round(100 * share)), [100, 91, 83, 75, 70, 65, 61, 58, 60, 83]);
  assert.deepEqual([phaseIndex(phaseChoice('ry-cma', 7)), phaseChoice('ry-cma', 7)], [7, { program: 'ry-cma-phase-7', id: 'pulsation-phase-7', label: 'Phase 0.7' }]);
  assert.throws(() => phaseIndex({ program: 'x', id: 'pulsation-phase-12', label: 'x' }), /pulsation-phase-0 to pulsation-phase-9/u);
});

test('the steps are one table the bake reads, the whole disc\'s value at every node', () => {
  const table = phaseTable('RY CMa', model.sourceId, phaseShares(model, check)), parsed = parseTecplotLonLat(table, 'gaia-dr3-g-phases.dat');
  assert.deepEqual([parsed.columns, parsed.rows, parsed.variables.length, parsed.variables[5]], [2, 2, 2 + PHASES, 'Light at phase 0.3 [%]']);
  for (let column = 2; column < 2 + PHASES; column++) assert.equal(new Set(parsed.values.map(row => row[column])).size, 1, 'one value over the disc');
  assert.equal(parsed.values[0]![2], 100); assert.match(table, /^TITLE     = "RY CMa: light of the whole disc at 10 phases of one pulsation, percent of the light at maximum \(Gaia DR3 vari_cepheid 3046774762417915136, G band\)"$/mu);
});

test('the star\'s color is dimmed in light, not in display values', () => {
  const stops = dimmed('#ffefe5'); assert.deepEqual([stops.length, stops[0], stops.at(-1)], [21, '#000000', '#ffefe5']);
  // Half the light of a full channel is display value 188, not 128.
  assert.equal(stops[10]!.slice(1, 3), 'bc');
});

test('the cycle becomes the star page\'s records: one group of stills in the star\'s color, with no legend', () => {
  const { files, report, opensOn } = surfaceMapFiles(PULSATION_STEPS, entry, { id: 'ry-cma', name: 'RY CMa', colorHex: '#ffefe5' }, steps, HOST()), read = (path: string) => JSON.parse(files.get(`src/objects/ry-cma/${path}`)!) as Record<string, any>;
  assert.equal(opensOn, undefined, 'the page keeps the dataset it opens on'); assert.match(report, /^10 phases of one 4\.68-day pulsation; the light falls to 57% of maximum \(Gaia DR3 G band, 4 harmonics\)$/u);
  assert.equal(files.get('src/objects/ry-cma/source/science/pulsation/gaia-dr3-g-phases.dat'), steps[0]!.table);
  const surfaces = read('source/preparation/raster.json').surfaces, third = surfaces[4];
  assert.deepEqual(surfaces.map((surface: { id: string }) => surface.id), ['color', ...entry.maps.map(map => map.id)]);
  assert.deepEqual([third.falseColor, third.source, third.science.variable, third.science.limbOf, third.science.limbStrength, third.science.minimum, third.science.maximum, third.science.outlineLatitudes, third.science.consumer],
    [false, 'science/pulsation/gaia-dr3-g-phases.dat', 'Light at phase 0.3 [%]', 'color', undefined, 0, 100, undefined, 'gaia-cepheid-phases']);
  // One value over the disc is one texel: the bake stores a nearest-sampled constant surface as that.
  assert.deepEqual([third.science.sampling, third.science.displaySampling], ['bilinear', 'nearest']);
  assert.deepEqual(third.science.colors, dimmed('#ffefe5'));
  assert.match(third.science.description, /^RY CMa's light 1\.40 days after maximum light \(phase 0\.3 of its 4\.68-day pulsation\): 75% of its light at maximum, from the Fourier model Gaia DR3 publishes for the star's G-band time series \(vari_cepheid, source 3046774762417915136; 4 harmonics; Ripepi et al\. \(2023\), A&A 674, A17\)\. The star's color \(#ffefe5, its Color dataset\) is dimmed to that share of its light\..*No change of color or of size is drawn/u);
  const content = read('source/content/object.json').datasets, controls = content.controls, control = controls[4];
  assert.equal(content.defaultDataset, 'color'); assert.equal(controls.length, 1 + PHASES);
  assert.deepEqual([control.label, control.step, control.falseColor, control.legend, control.legendNote, control.source.id, control.surface], ['Pulsation', { group: 'pulsation', label: 'Phase 0.3' }, false, undefined, undefined, 'ry-cma-gaia-cepheid-phases', 'ry-cma-surface-pulsation-phase-3@2x.webp']);
  assert.match(control.notes, /The played light curve \(the Light curves switch\) is not drawn over these steps/u);
  // One table, one manifest entry: built here from the archived row, so it names its generator.
  const manifest = read('source/manifest.json'), built = manifest.generatedIntermediates;
  assert.equal(manifest.inputs.length, 1); assert.equal(built.length, 1);
  assert.deepEqual([built[0].id, built[0].path, built[0].generator, built[0].consumers, built[0].sourceBinding.references.map((reference: { catalogueId: string }) => reference.catalogueId)],
    ['ry-cma-gaia-cepheid-phases', 'science/pulsation/gaia-dr3-g-phases.dat', PULSATION_GENERATOR, ['gaia-cepheid-phases'], ['gaia-dr3-vari-cepheid-ry-cma', 'gaia-2023-dr3']]);
  assert.deepEqual(read('object.json').properties.recipe.surfaces[0].datasets.at(-1), { id: 'pulsation-phase-9', source: 'content', material: 'emission' });
  // Reader text within its limits (docs/reader-text.md): title 40, detail 28, one sentence of at most 125 characters.
  const texts = read('text.json').datasets;
  assert.deepEqual(texts['pulsation-phase-0'], { title: 'Light at maximum', detail: 'Gaia DR3', summary: 'The star at its brightest in Gaia\'s G band, the start of one 4.68-day pulsation.' });
  assert.deepEqual(texts['pulsation-phase-7'], { title: 'Light 3.27 days after maximum', detail: 'Gaia DR3', summary: '58% of its brightest light in Gaia\'s G band, 3.27 days into one 4.68-day pulsation.' });
  for (const map of entry.maps) { const text = texts[map.id]; assert.ok(text.title.length <= 40 && text.detail.length <= 28 && text.summary.length <= 125 && text.summary.endsWith('.'), map.id); }
  assert.equal(new Set(entry.maps.map(map => texts[map.id].summary)).size, PHASES, 'no sentence is used twice');
  // Written again over its own records, nothing moves; a dataset of a step's id that is not a step is never overwritten.
  const again = surfaceMapFiles(PULSATION_STEPS, entry, { id: 'ry-cma', name: 'RY CMa', colorHex: '#ffefe5' }, steps, { content: read('source/content/object.json'), text: read('text.json'), manifest: read('source/manifest.json'), raster: read('source/preparation/raster.json'), descriptor: read('object.json') });
  for (const [path, value] of files) assert.equal(again.files.get(path), value, path);
  const taken = HOST(); taken.raster.surfaces.push({ id: 'pulsation-phase-3', output: 'x', thumbnail: 'y', science: { kind: 'other' } });
  assert.throws(() => surfaceMapFiles(PULSATION_STEPS, entry, { id: 'ry-cma', name: 'RY CMa', colorHex: '#ffefe5' }, steps, taken), /already exists and is not one of these maps/u);
  assert.throws(() => surfaceMapFiles(PULSATION_STEPS, entry, { id: 'ry-cma', name: 'RY CMa' }, steps, HOST()), /names no color/u);
});

test('a long period reads in days without decimals it does not have, a short one in hours', () => {
  const long = pulsationStep(phaseChoice('s', 5), { host: 's', name: 'S', played: false }, { ...model, periodDays: 134.2, frequencyPerDay: 1 / 134.2 }, check), short = pulsationStep(phaseChoice('s', 1), { host: 's', name: 'S', played: false }, { ...model, periodDays: 2.64, frequencyPerDay: 1 / 2.64 }, check);
  const words = (step: typeof long) => PULSATION_STEPS.words(step, { star: { id: 's', name: 'S' }, count: PHASES, epochs: '10 epochs', tilt: 90, outlined: false });
  assert.equal(words(long).text.title, 'Light 67.1 days after maximum'); assert.match(words(long).text.summary, /67\.1 days into one 134-day pulsation\.$/u);
  assert.equal(words(short).text.title, 'Light 6.3 hours after maximum'); assert.doesNotMatch(words(short).notes, /Light curves switch/u);
});

test('a page that plays its light curve names the stills; the README says what the steps are, once', () => {
  assert.deepEqual(withStills({ schema: 's', namespace: 'ry-cma', mode: 'emissive', lightCurve: { model: PULSATION_MODEL } }), { schema: 's', namespace: 'ry-cma', mode: 'emissive', lightCurve: { model: PULSATION_MODEL, stills: 'pulsation' } });
  assert.deepEqual(withStills({ schema: 's', namespace: 'x', mode: 'emissive' }), { schema: 's', namespace: 'x', mode: 'emissive' });
  const readme = '# RY CMa\n\n## Sources\n\nA star.\n\n## Evidence\n\n- One.\n\n## Known problems\n\n- **Model limb.** A model.\n\n[Investigation ledger](investigations.json)\n', once = withPulsationReadme(readme, steps[0]!);
  assert.match(once, /## Sources\n\nA star\.\n\n\*\*Pulsation\.\*\* The 10 steps of the Pulsation dataset are the model Gaia DR3 publishes of the star's G-band light \(vari_cepheid, source 3046774762417915136: 4 harmonics of a 4\.678-day period;.*: 100, 91, 83, 75, 70, 65, 61, 58, 60, 83%\.\n\n## Evidence/u);
  assert.match(once, /- \*\*Model limb\.\*\* A model\.\n\n- \*\*Pulsation\.\*\* The steps show the light alone\..*\n\n\[Investigation ledger\]/u);
  assert.equal(withPulsationReadme(once, steps[0]!), once);
});

test('a spec is drafted for the stars whose package keeps a published model, and each star\'s steps are read from its own row', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pulsation-')), at = (host: string, path: string) => join(root, 'src/objects', host, path);
  try {
    for (const host of ['ry-cma', 'plain', 'unrestored']) { await mkdir(at(host, 'source/photometry'), { recursive: true }); await mkdir(at(host, 'source/content'), { recursive: true }); await mkdir(at(host, 'source/preparation'), { recursive: true });
      await writeFile(at(host, 'source/manifest.json'), JSON.stringify({ inputs: host === 'plain' ? [] : [{ id: `${host}-gaia-dr3-vari-cepheid`, path: PULSATION_MODEL }] }));
      await writeFile(at(host, 'source/content/object.json'), JSON.stringify({ displayName: 'RY CMa' })); await writeFile(at(host, 'source/preparation/presentation.json'), JSON.stringify({ mode: 'emissive', lightCurve: { model: PULSATION_MODEL } })); }
    await writeFile(at('ry-cma', `source/${PULSATION_MODEL}`), ROW);
    const context = { root, progress: () => undefined }, all = await draftsFromPulsation(['all'], context);
    assert.deepEqual(all.pulsations, [{ host: 'ry-cma', maps: entry.maps }]);
    assert.deepEqual(all.report, ['  unrestored: not drafted: unrestored: its Gaia DR3 vari_cepheid row is not in the checkout (node packages/bake/cli/restore-source-inputs.mts --object=unrestored).', '  1 stars with a published light-curve model; 1 objects without one.']);
    assert.match((await draftsFromPulsation(['plain'], context)).report[0]!, /plain: not drafted: its package keeps no published light-curve model/u);
    const step = await PULSATION_ROUTE.reduced(root, 'ry-cma', entry.maps[7]!);
    assert.deepEqual([step.index, step.played, Math.round(100 * step.share), step.sourceId, step.periodDays], [7, true, 58, '3046774762417915136', 4.678368934320488]);
    const records = await PULSATION_ROUTE.starRecords!(root, 'ry-cma', [step]);
    assert.deepEqual(JSON.parse(records.get('src/objects/ry-cma/source/preparation/presentation.json')!), { mode: 'emissive', lightCurve: { model: PULSATION_MODEL, stills: 'pulsation' } });
    await assert.rejects(PULSATION_ROUTE.reduced(root, 'unrestored', entry.maps[0]!), /not in the checkout/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a star placed by its paper\'s table is tied to the one Gaia Cepheid at its place with its period, or left without steps', async () => {
  // A catalogue row prints the period in days (Per, Pr) or as its logarithm.
  const row = (header: string, value: string) => `ID\t${header}\n \td\n--\t--\nX\t${value}\n`;
  assert.deepEqual([cataloguedPeriodDays(row('Per', '22.200')), cataloguedPeriodDays(row('Pr', ' 31.376577')), Number(cataloguedPeriodDays(row('logP', ' 1.873'))!.toFixed(2)), cataloguedPeriodDays(row('Vmag', '20.1')), cataloguedPeriodDays(row('Per', ' '))], [22.2, 31.376577, 74.64, undefined, undefined]);
  const root = await mkdtemp(join(tmpdir(), 'pulsation-place-')), at = (path: string) => join(root, 'src/objects/far', path);
  try {
    await mkdir(at('source/photometry'), { recursive: true }); await mkdir(at('source/content'), { recursive: true }); await mkdir(at('source/preparation'), { recursive: true }); await mkdir(join(root, 'packages/astronomy/data/bodies'), { recursive: true });
    await writeFile(join(root, 'packages/astronomy/data/bodies/far.json'), JSON.stringify({ id: 'far', star: { rightAscensionDegrees: 23.43275, declinationDegrees: 30.54584 } }));
    const fresh = async (logP: string) => { await writeFile(at('source/photometry/catalogue-row.tsv'), row('logP', logP)); await writeFile(at('source/content/object.json'), JSON.stringify({ displayName: 'Far 1' }));
      await writeFile(at('source/preparation/acquisition.json'), JSON.stringify({ schema: 'cssearth-acquisition-plan@1', operations: [] })); await writeFile(at('source/preparation/presentation.json'), JSON.stringify({ mode: 'emissive' }));
      await writeFile(at('source/manifest.json'), JSON.stringify({ inputs: [], generatedIntermediates: [], documents: [] })); await writeFile(at('NOTICE.md'), '# Far 1 credits\n'); };
    const asked: string[] = [], archive = (near: string, answer = ROW) => ({ text: async (_url: string, form?: Readonly<Record<string, string>>) => { asked.push(form!.QUERY!); return form!.QUERY!.includes('DISTANCE(') ? `source_id,arcsec\n${near}` : answer; },
      bytes: async () => Buffer.alloc(0), exists: async () => false });
    await fresh(' 0.670');
    const found = await installPublishedModel(root, 'far', archive('3046774762417915136,0.0312\n'));
    assert.equal(found.sourceId, '3046774762417915136'); assert.match(asked[0]!, /FROM gaiadr3\.vari_cepheid AS c JOIN gaiadr3\.gaia_source AS g ON g\.source_id = c\.source_id WHERE 1 = CONTAINS\(POINT\('ICRS', g\.ra, g\.dec\), CIRCLE\('ICRS', 23\.43275, 30\.54584, 0\.0002777/u);
    assert.equal(found.tied, 'Tied to the star by its place: the one Gaia DR3 Cepheid within 1 arcsecond of it (0.03 arcseconds away), whose period, 4.678 d, is within 1% of the 4.677 d the star\'s own catalogue row prints.');
    const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(at('source/manifest.json'), 'utf8')) as { inputs: { path: string; consumers: string[]; acquisition: string }[] };
    assert.deepEqual([manifest.inputs[0]!.path, manifest.inputs[0]!.consumers], [PULSATION_MODEL, ['gaia-cepheid-model']]); assert.ok(manifest.inputs[0]!.acquisition.endsWith(found.tied));
    // The row is not one of the steps' own entries: writing the steps keeps it declared (the restore step refused a package whose row the write had dropped).
    const far = { content: { displayName: 'Far 1', datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest, raster: HOST().raster, descriptor: HOST().descriptor };
    const farEntry = { host: 'far', maps: Array.from({ length: PHASES }, (_, index) => phaseChoice('far', index)) }, farSteps = farEntry.maps.map(choice => pulsationStep(choice, { host: 'far', name: 'Far 1', played: false }, model, check));
    const written = JSON.parse(surfaceMapFiles(PULSATION_STEPS, farEntry, { id: 'far', name: 'Far 1', colorHex: '#ffd2a1' }, farSteps, far).files.get('src/objects/far/source/manifest.json')!) as { inputs: { path: string }[]; generatedIntermediates: { path: string }[] };
    assert.deepEqual([written.inputs.map(input => input.path), written.generatedIntermediates.map(input => input.path)], [[PULSATION_MODEL], ['science/pulsation/gaia-dr3-g-phases.dat']]);
    // The draft finds the row installed, and the star's README repeats how it was tied; a page that plays no light curve gains no stills.
    const drafted = await draftsFromPulsation(['gaia:far'], { root, progress: () => undefined, archive: archive('never asked') });
    assert.deepEqual(drafted.pulsations, [{ host: 'far', maps: Array.from({ length: PHASES }, (_, index) => phaseChoice('far', index)) }]);
    await writeFile(at('README.md'), '# Far 1\n\n## Sources\n\nA star.\n\n## Known problems\n\n- One.\n');
    const records = await PULSATION_ROUTE.starRecords!(root, 'far', [await PULSATION_ROUTE.reduced(root, 'far', phaseChoice('far', 0))]);
    assert.match(records.get('src/objects/far/README.md')!, /\(\[method note\]\([^)]*\)\)\. Tied to the star by its place: the one Gaia DR3 Cepheid within 1 arcsecond of it \(0\.03 arcseconds away\).* Each step draws/u);
    assert.deepEqual(JSON.parse(records.get('src/objects/far/source/preparation/presentation.json')!), { mode: 'emissive' });
    // Refused, each with its numbers: none or two at the place, another period, another mode.
    await fresh(' 0.670'); await assert.rejects(installPublishedModel(root, 'far', archive('')), /lists no Cepheid within 1 arcsecond/u);
    await assert.rejects(installPublishedModel(root, 'far', archive('1,0.2\n2,0.6\n')), /lists 2 Cepheids within 1 arcsecond/u);
    await fresh(' 1.000'); await assert.rejects(installPublishedModel(root, 'far', archive('3046774762417915136,0.03\n')), /4\.678 d \(source 3046774762417915136\), is not within 1% of the 10 d its own catalogue row prints/u);
    await fresh(' 0.670'); await assert.rejects(installPublishedModel(root, 'far', archive('3046774762417915136,0.03\n', ROW.replace('FUNDAMENTAL', 'FIRST_OVERTONE'))), /in the mode "FIRST_OVERTONE"; only a fundamental-mode model is read/u);
    assert.match((await draftsFromPulsation(['gaia:far'], { root, progress: () => undefined, archive: archive('') })).report[0]!, /far: not drafted: far: Gaia DR3 lists no Cepheid/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('every page with pulsation steps draws its own table: ten stills of its row, the page it opened on, and the veil off them', async () => {
  const root = resolve(import.meta.dirname, '../../../../..'), objects = join(root, 'src/objects'), table = 'source/science/pulsation/gaia-dr3-g-phases.dat';
  const stars = (await readdir(objects)).filter(id => existsSync(join(objects, id, table))), read = async (id: string, path: string) => JSON.parse(await readFile(join(objects, id, path), 'utf8')) as Record<string, any>;
  const toLinear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; }, fromLinear = (unit: number) => 255 * (unit <= 0.0031308 ? 12.92 * unit : 1.055 * unit ** (1 / 2.4) - 0.055);
  for (const id of stars) {
    const shares = (await readFile(join(objects, id, table), 'utf8')).split('\n').find(line => line.startsWith('0 -90 '))!.split(' ').slice(2).map(Number);
    const content = await read(id, 'source/content/object.json'), raster = await read(id, 'source/preparation/raster.json'), profile = await read(id, 'source/preparation/presentation.json'), manifest = await read(id, 'source/manifest.json');
    const steps = content.datasets.controls.filter((control: { step?: { group: string } }) => control.step?.group === 'pulsation'), surfaces = steps.map((step: { id: string }) => raster.surfaces.find((surface: { id: string }) => surface.id === step.id));
    assert.deepEqual([steps.length, shares.length, shares[0], content.datasets.defaultDataset, content.datasets.controls[0].id], [PHASES, PHASES, 100, 'color', 'color'], id);
    assert.ok(shares.every(share => share > 0 && share <= 100), id);
    assert.deepEqual(surfaces.map((surface: { science: { variable: string; limbOf: string; displaySampling: string } }) => [surface.science.variable, surface.science.limbOf, surface.science.displaySampling]), shares.map((_, index) => [`Light at phase ${(index / PHASES).toFixed(1)} [%]`, 'color', 'nearest']), id);
    // The row the table is built from is declared, and a page that plays it names these steps as its stills.
    assert.equal(manifest.inputs.filter((input: { path: string }) => input.path === PULSATION_MODEL).length, 1, id);
    if (profile.lightCurve) assert.deepEqual(profile.lightCurve, { model: PULSATION_MODEL, stills: 'pulsation' }, id);
    // The baked page, where this checkout has restored it: one texel a step, at the step's share of the star's color within two display levels.
    if (!existsSync(join(objects, id, 'prepared/assets.json')) || !existsSync(join(objects, id, 'prepared/runtime.json'))) continue;
    const assets = await read(id, 'prepared/assets.json'), runtime = await read(id, 'prepared/runtime.json'), color = surfaces[0].science.colors.at(-1) as string, rgb = [1, 3, 5].map(at => Number.parseInt(color.slice(at, at + 2), 16));
    const veil = runtime.tree.nodes.findIndex((node: { className?: string }) => node.className === `${id}-light-veil`);
    assert.equal(veil >= 0, profile.lightCurve !== undefined, `${id}: a veil for a page that plays its light curve, and for no other`);
    for (const [index, step] of steps.entries()) { const surface = assets.surfaces[step.id], variant = runtime.variants.find((one: { when: { datasetId: string } }) => one.when.datasetId === step.id);
      assert.ok(surface?.constantRaster && variant, `${id} ${step.id}`);
      surface.constantRaster.rgba.slice(0, 3).forEach((value: number, channel: number) => assert.ok(Math.abs(value - fromLinear(toLinear(rgb[channel]!) * shares[index]! / 100)) < 2, `${id} ${step.id}: ${String(surface.constantRaster.rgba)} for ${shares[index]}% of ${color}`));
      assert.equal(surface.limbUrl, assets.surfaces.color.limbUrl, `${id} ${step.id}: the Color dataset's limb plate, as one file`);
      assert.deepEqual(variant.writes.filter((write: { target: number }) => veil >= 0 && write.target === veil).map((write: { name: string; value: string }) => [write.name, write.value]), veil >= 0 ? [['display', 'none']] : [], `${id} ${step.id}`); }
  }
});
