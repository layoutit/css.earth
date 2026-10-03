/** A fast rotator's published Roche-von Zeipel fit turns a generated sphere into the flattened, gravity-darkened star (roche-shape.mts). */
import assert from 'node:assert/strict';
import test from 'node:test';
import { installRocheShape, rocheRecord, ROCHE_RECORD_PATH } from './roche-shape.mts';
import { parseStarSpec } from './spec.mts';

// Achernar: Domiciano de Souza et al. (2014), A&A 569, A10, Table 6, as the open copy prints it.
const paper = 'https://doi.org/10.1051/0004-6361/201424144', credit = 'Domiciano de Souza et al. (2014), A&A 569, A10';
const record = { source: `${credit}, Table 6`, model: { omega: { value: 0.98 }, beta: { value: 0.166 }, poleTemperatureK: { value: 17124 }, equatorTemperatureK: { value: 12673 },
  polarRadiusSolar: { value: 6.78 }, equatorialRadiusSolar: { value: 9.16 } }, view: { inclinationDegrees: { value: 60.6 }, polePositionAngleDegrees: { value: 216.9 } } };
const cited = (value: number) => ({ value, source: 'a paper', url: paper });
const base = { id: 'achernar', name: 'Achernar', description: 'A star.', target: 'HD 10144', paper: { url: paper, credit }, radius: cited(8.286), mass: cited(5.99), temperature: cited(15539),
  gravityDarkening: { record, credit, url: paper, rotationPeriodHours: 37.25 } };

test('the spec takes a Roche fit with its pole, at the radius of the fit\'s volume-equivalent sphere, and not beside a spin', () => {
  const fit = rocheRecord(parseStarSpec(base));
  assert.ok(Math.abs(fit.volumeEquivalentSolar - 8.2859) < 1e-4, 'cbrt(9.16^2 x 6.78)');
  assert.throws(() => rocheRecord(parseStarSpec({ ...base, radius: cited(8.14) })), /achernar: a flattened star's radius is the volume-equivalent sphere of its fit, 8\.286 solar radii \(equatorial 9\.16, polar 6\.78\), not 8\.14/u);
  assert.throws(() => rocheRecord(parseStarSpec({ ...base, gravityDarkening: { ...base.gravityDarkening, record: { ...record, view: undefined } } })), /needs view\.inclinationDegrees and view\.polePositionAngleDegrees/u);
  assert.throws(() => parseStarSpec({ ...base, spin: { inclinationDegrees: 60, source: 'x', url: paper } }), /give gravityDarkening or spin, not both/u);
});

test('the fit rewrites a generated sphere: its record and manifest entry, flattened geometry, measured pole, latitude darkening and a Day fact', () => {
  const spec = parseStarSpec(base), o = 'src/objects/achernar', s = `${o}/source`, json = (value: unknown) => JSON.stringify(value);
  const note = " presentationUp: the display axis is a sky-plane convention; the spin axis's position angle on the sky is not measured.";
  const files = new Map<string, string | Buffer>([
    [`${s}/manifest.json`, json({ inputs: [] })],
    [`${s}/preparation/raster.json`, json({ surfaces: [{ science: { kind: 'stellar-photometric-color', qualification: 'Photosphere color.' } }] })],
    [`${s}/preparation/geometry.json`, json({ surface: { radius: 248, polarRadius: 248 } })],
    [`${s}/preparation/rotation.json`, json({ schema: 'cssearth-display-orientation@1', phase: 'arbitrary-display-phase' })],
    [`${s}/measurements.json`, json({ angularDiameterSource: 'Computed. No interferometric diameter of this star is used.', shape: { kind: 'uniform-disc-sphere', qualification: 'A sphere.' } })],
    [`${o}/text.json`, json({ datasets: { color: { title: 'Photosphere color', detail: 'From its spectrum', summary: "The color of the star's light, dimmed toward the edge by a model atmosphere." } } })],
    [`${s}/content/object.json`, json({ panel: { facts: [{ id: 'radius', label: 'Radius', value: '8.3 solar radii' }] }, provenance: { physical: { credit: 'radius; no measured rotation axis (display convention)' } } })],
    ['packages/astronomy/data/bodies/achernar.json', json({ physicalNotes: `Radius.${note}` })],
    [`${o}/README.md`, "# Achernar\n\n**Limb.** A law.\n\n## Evidence\n\n## Known problems\n\n- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.\n"],
    [`${o}/NOTICE.md`, '# Achernar credits\n'], [`${o}/investigations.json`, json({ entries: [] })]]);
  // Achernar's Hipparcos position.
  installRocheShape(files, spec, { ra: 24.42813208, dec: -57.23665985 }, 'doi-10-1051-0004-6361-201424144');
  const read = (path: string) => JSON.parse(String(files.get(path)));
  assert.deepEqual(read(`${s}/${ROCHE_RECORD_PATH}`).model.equatorialRadiusSolar, { value: 9.16 });
  assert.deepEqual(read(`${s}/manifest.json`).inputs.map((input: { id: string; path: string }) => [input.id, input.path]), [['achernar-roche-von-zeipel', ROCHE_RECORD_PATH]]);
  assert.equal(read(`${s}/preparation/raster.json`).surfaces[0].science.gravityDarkening, ROCHE_RECORD_PATH);
  assert.equal(read(`${s}/preparation/geometry.json`).surface.polarRadius, 183.5633, '248 x 6.78 / 9.16');
  const rotation = read(`${s}/preparation/rotation.json`);
  // The visible pole points south-west on the sky (position angle 216.9) and 60.6 degrees off the line of sight.
  assert.ok(Math.abs(rotation.rightAscensionDegrees - 235.9907) < 1e-3 && Math.abs(rotation.declinationDegrees - 2.0503) < 1e-3, `${rotation.rightAscensionDegrees}, ${rotation.declinationDegrees}`);
  assert.match(rotation.qualification, /pole direction is measured by interferometry/u);
  assert.match(read('packages/astronomy/data/bodies/achernar.json').physicalNotes, /draws the measured flattening .* equatorial radius, 9\.16 solar radii, on the outline\. presentationUp: the display axis, the measured rotation pole, is up\.$/u);
  assert.deepEqual(read(`${s}/content/object.json`).panel.facts.map((fact: { label: string; value: string }) => [fact.label, fact.value]), [['Radius', '9.16 solar radii at the equator'], ['Day', '37 hours']]);
  assert.deepEqual(read(`${o}/text.json`).datasets.color, { title: 'Photosphere color', detail: 'Spectrum and spin', summary: "Measured color, with hot bright poles and a cool equator from the star's fast spin. The darker edge is a model." });
  assert.match(String(files.get(`${o}/README.md`)), /\*\*Shape\.\*\* A Roche surface flattened by rotation, 9\.16 solar radii at the equator and 6\.78 at the poles[\s\S]*The pole is measured; the rotation phase is a convention/u);
  assert.deepEqual(read(`${o}/investigations.json`).entries.map((entry: { id: string }) => entry.id), ['shape']);
});
