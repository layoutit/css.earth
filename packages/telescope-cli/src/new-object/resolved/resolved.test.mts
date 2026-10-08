import assert from 'node:assert/strict';
import test from 'node:test';
import { isConventionOnly, surfaceMapFiles } from '../maps/surface-maps.mts';
import { measuredAxisRotation, reducedSurface, RESOLVED_CONSUMER, RESOLVED_MAPS, resolvedSourceRecords, span, unseenDegrees, withSurfaceLedger, withSurfaceNotice, withSurfaceReadme } from './resolved-maps.mts';

const TABLE = 'TITLE     = "test"\nVARIABLES = "Longitude [Deg]" "Latitude [Deg]" "Brightness [%]" "Facing"\nZONE I=73, J=37, K=1, ZONETYPE=Ordered\n';
const CHOICE = { program: 'star-mirc-2011-09', id: 'surface-2011-09', label: 'September 2011' };
const cell = (value: number, what: string) => ({ value, source: `Author et al. (2021), ApJ 1, 1, Table 4 (https://arxiv.org/abs/2107.00001): ${what}` });
/** A season's receipt as surface-star.mts writes it: three nights, the twin 2% larger not fitting on the sphere. */
const receipt = (cast = true) => ({ schema: 'cssearth-star-surface-map@1', season: CHOICE.program, object: 'hd-1', title: 'HD 1, CHARA/MIRC', target: 'HD 1', instrument: 'CHARA/MIRC', band: 'CHARA/MIRC H band (1.49-1.73 um)',
  papers: [{ record: 'arxiv-2107-00001', citation: 'Author et al. (2021), ApJ 1, 1', title: 'Author et al. (2021): A star', arxiv: '2107.00001', doi: '10.1000/x', creators: ['A. Author'], year: '2021', locator: 'Table 4' }],
  data: { record: 'code-demos-hd-1', title: 'HD 1 nights', url: 'https://github.com/example/code/tree/abc/demos/data', publisher: 'Example', license: 'Public', locator: 'Three files', credit: 'CHARA Array/MIRC, as calibrated by the authors' },
  star: { diameterMas: cell(2.742, 'radius'), limbPowerLaw: cell(0.231, 'limb'), inclinationDegrees: cell(85.63, 'inclination'), positionAngleDegrees: cell(26.09, 'position angle'), rotationPeriodDays: cell(54.2, 'period') },
  recipe: { level: 3, regularizer: 'sobel2', weight: 10, iterations: 1000, source: 'the authors\' script' }, referenceNight: '2011-09-14', codes: { rotir: 'ad308759b741b861b6c19fedd001c323a3a64479', oitools: 'f42d2beaf2760cb4beaeba0e0d0f1674a3c6c66a' }, beamMas: 0.5044,
  nights: [{ night: '2011-09-02', vis2: 360, closurePhases: 432, subObserverLongitude: 79.131 }, { night: '2011-09-14', vis2: 864, closurePhases: 1104, subObserverLongitude: 0 }, { night: '2011-09-24', vis2: 200, closurePhases: 240, subObserverLongitude: -66.78 }],
  points: { vis2: 1424, closurePhases: 1776 }, fit: { vis2: 1.717641, closurePhase: 2.300958, spotlessVis2: 3.127638, spotlessClosurePhase: 28.291627 },
  spots: { ratio: 2.143, scale: 1.01, twins: [{ scale: 1, ratio: 2.94, fits: true, chi2: { vis2: 1.02, closurePhase: 1.03 } }, { scale: 1.02, ratio: 1.4, fits: false, chi2: { vis2: 3.7, closurePhase: 9.4 } }] },
  halves: { correlation: 0.828 }, verdict: cast ? { cast: true, reasons: [] } : { cast: false, reasons: ['its spots are no stronger than a spotless disc\'s (ratio 1.40, limit 2)'] }, table: { minimumPercent: 71.777, maximumPercent: 110.192 } });
const HOST = () => ({ content: { datasets: { defaultDataset: 'color', controls: [{ id: 'color', label: 'Color' }] } }, text: { datasets: { color: { title: 'Color' } } }, manifest: { inputs: [{ id: 'star-color', path: 'photometry/color.json', consumers: ['datasets'] }] },
  raster: { surfaces: [{ id: 'color', output: 'hd-1-surface-{id}{suffix}.webp', thumbnail: 'hd-1-dataset-{id}.webp', science: { kind: 'stellar-photometric-color' } }] },
  descriptor: { properties: { recipe: { surfaces: [{ id: 'body', datasets: [{ id: 'color', source: 'content', material: 'emission' }] }] } } } });

test('a season that did not pass its checks is no map, and one that did says what it was fitted with', () => {
  assert.throws(() => reducedSurface(CHOICE, receipt(false), TABLE), /is not cast: its spots are no stronger/u);
  assert.throws(() => reducedSurface({ ...CHOICE, program: 'another' }, receipt(), TABLE), /not this season's/u);
  assert.throws(() => reducedSurface(CHOICE, receipt(), TABLE.replace(' "Facing"', '')), /not a surface map/u);
  const map = reducedSurface(CHOICE, receipt(), TABLE);
  assert.deepEqual([map.inclinationDegrees, map.positionAngleDegrees, map.periodDays, map.diameterMas, map.spotScale], [85.63, 26.09, 54.2, 2.742, 1.01]);
  assert.deepEqual(map.unfitTwins, [{ scale: 1.02, closurePhase: 9.4 }]);
  assert.equal(span(map.nights), '2 to 24 September 2011'); assert.ok(Math.abs(unseenDegrees(map) - 34.089) < 1e-6);
});

test('the page gains the star in its color over the map, the map with its scale, and an outline of what was never seen', () => {
  const map = reducedSurface(CHOICE, receipt(), TABLE), { files, opensOn } = surfaceMapFiles(RESOLVED_MAPS, { host: 'hd-1', maps: [CHOICE] }, { id: 'hd-1', name: 'HD 1', colorHex: '#ffddbb' }, [map], HOST());
  const raster = JSON.parse(files.get('src/objects/hd-1/source/preparation/raster.json')!) as { surfaces: { id: string; science: Record<string, unknown> }[] };
  const content = JSON.parse(files.get('src/objects/hd-1/source/content/object.json')!) as { datasets: { defaultDataset: string; controls: { id: string; notes?: string; step?: unknown }[] } };
  const manifest = JSON.parse(files.get('src/objects/hd-1/source/manifest.json')!) as { inputs: { path: string }[]; generatedIntermediates: { id: string; path: string; generator?: string; sourceBinding?: { references: { catalogueId: string }[] } }[] };
  assert.equal(opensOn, 'color-surface'); assert.deepEqual(content.datasets.controls.map(control => control.id), ['color-surface', 'surface-2011-09', 'color']);
  const drawn = raster.surfaces.find(surface => surface.id === 'surface-2011-09')!.science, natural = raster.surfaces.find(surface => surface.id === 'color-surface')!.science;
  assert.deepEqual([drawn.format, drawn.variable, drawn.outlineZeroOf, drawn.consumer, drawn.minimum, drawn.maximum], ['tecplot-lonlat-map', 'Brightness [%]', 'Facing', RESOLVED_CONSUMER, 70, 130]);
  assert.equal(drawn.outlineLatitudes, undefined); assert.equal(natural.outlineZeroOf, undefined); assert.equal(natural.limbOf, 'color');
  // One map has no steps; its table is built here, kept out of git and restored from the source cache, and is bound to the nights, the paper and the code.
  assert.equal(content.datasets.controls[1]!.step, undefined);
  const input = manifest.generatedIntermediates.find(one => one.path === 'science/interferometry/star-mirc-2011-09.dat')!;
  assert.equal(input.generator, 'packages/telescope-cli/src/archives/interferometry/surface-star.mts'); assert.ok(!manifest.inputs.some(one => one.path === input.path));
  assert.deepEqual(input.sourceBinding!.references.map(reference => reference.catalogueId), ['code-demos-hd-1', 'arxiv-2107-00001', 'rotir-jl']);
  assert.equal(files.get('src/objects/hd-1/source/science/interferometry/star-mirc-2011-09.dat'), TABLE);
  for (const control of content.datasets.controls.slice(0, 2)) assert.match(control.notes!, /not (?:a|their) published map|made in this project/u);
  assert.match(content.datasets.controls[0]!.notes!, /34° of longitude that faced the Earth on none of the nights/u);
  assert.deepEqual([...resolvedSourceRecords('2026-10-08', [map]).keys()], ['src/sources/code-demos-hd-1.json', 'src/sources/arxiv-2107-00001.json', 'src/sources/rotir-jl.json']);
});

test('a convention page takes the measured tilt and pole direction, and the records say what was checked', () => {
  const map = reducedSurface(CHOICE, receipt(), TABLE), convention = { schema: 'cssearth-display-orientation@1', rightAscensionDegrees: 174.4, declinationDegrees: 43.5, displayMeridianDegrees: -90, source: 'No measured rotation axis or period is used.' };
  assert.equal(isConventionOnly(convention), true);
  const measured = measuredAxisRotation(convention, { rightAscensionDegrees: 354.39, declinationDegrees: 46.46 }, map);
  assert.equal(isConventionOnly(measured), false); assert.match(String(measured.source), /inclination 85\.63 degrees.*position angle 26\.09 degrees east of north.*54\.2 d/u);
  // The pole tilted 4.4 degrees toward us and 26 degrees east of north: north of the star on the sky, away from its own declination by about that.
  assert.ok(Number(measured.declinationDegrees) > 20 && Number(measured.declinationDegrees) < 46.46);
  const readme = '# HD 1\n\n## Sources\n\n**Limb.** x\n\n## Evidence\n\ny\n\n## Known problems\n\n- **Assumptions of the frame.** The axis\'s position angle and the rotation phase are conventions.\n- **Model limb.** z\n';
  const written = withSurfaceReadme(readme, map);
  assert.match(written, /\*\*Surface from interferometry\.\*\* .*1,424 squared visibilities and 1,776 closure phases.*chi-squared of 1\.72 on the squared visibilities and 2\.30 on the closure phases.*2\.14 times.*2\.77 mas.*correlation 0\.83.*2% larger do not fit on the sphere at all \(closure phases 9\.40\)/su);
  assert.ok(written.indexOf('**Surface from interferometry.**') < written.indexOf('## Evidence'));
  assert.match(written, /- \*\*Surface map\.\*\* It is infrared brightness/u); assert.doesNotMatch(written, /position angle and the rotation phase are conventions/u);
  assert.equal(withSurfaceReadme(written, map), written);
  const ledger = withSurfaceLedger({ schema: 'cssearth-investigation-ledger@1', objectId: 'hd-1', entries: [{ id: 'placement', subject: 'Placement', status: 'included', finding: 'x' }] }, map) as { entries: { id: string; status: string; finding: string }[] };
  assert.deepEqual(ledger.entries.map(entry => entry.id), ['placement', 'surface-star-mirc-2011-09', 'rotation-axis']);
  assert.match(ledger.entries[1]!.finding, /Spotless twins of 2\.80 mas do not fit on the 2\.742 mas sphere/u);
  assert.deepEqual(withSurfaceLedger(ledger, map), ledger);
  const notice = withSurfaceNotice('# HD 1 credits\n\nColor: x.\n', map);
  assert.match(notice, /^# HD 1 credits\n\nColor: x\.\n\nSurface map: CHARA Array\/MIRC, as calibrated by the authors; .*Author et al\. \(2021\), ApJ 1, 1; fitted in this project with ROTIR\.jl ad308759 and OITOOLS\.jl f42d2bea/u);
  assert.equal(withSurfaceNotice(notice, map), notice);
});
