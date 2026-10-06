/** A fast rotator's measured shape (spec `gravityDarkening`): a published Roche-von Zeipel fit, the model interferometry fits to a star
 * that spins near break-up (Achernar: Domiciano de Souza et al. 2014; Altair, Regulus and Vega carry the same record, made by hand).
 * The fit gives the equatorial and polar radii, the gravity-darkening exponent, the pole's temperature, and where the pole lies on the
 * sky. The generated star is then drawn as that fit says: flattened, with its measured pole up, its poles brighter and bluer than its
 * equator (packages/bake/src/objects/stellar/gravity-darkening.ts reads the record at bake).
 *
 * The spec's record is the Roche-von Zeipel record itself (ROCHE_VON_ZEIPEL_SCHEMA), each value with the table cell it was read from; it is written
 * beside the star and declared in its manifest. The spec's radius must be the volume-equivalent sphere of the two fitted radii: the
 * astronomy record holds one radius, and the scene draws the equatorial one on the outline. Only the pole-to-equator contrast is the
 * model's; the disc color stays the star's measured one. The spin phase stays a display convention: nothing turns. */
import { inclinedPoleOrientation, parseGravityDarkeningRecord, ROCHE_VON_ZEIPEL_SCHEMA } from '@cssearth/bake/objects/stellar';
import { CHECKED } from './color.mts';
import { json, type PackageFiles } from './dataset.mts';
import type { StarSpec } from './spec-types.mts';

export const ROCHE_RECORD_PATH = 'photometry/gravity-darkening.json';
const CONVENTION_NOTE = " presentationUp: the display axis is a sky-plane convention; the spin axis's position angle on the sky is not measured.";

/** The record the spec carries, read as the bake reads it; a fit with no view of the pole cannot place it. */
export function rocheRecord(spec: StarSpec) {
  const shape = spec.gravityDarkening;
  if (!shape) throw new TypeError(`${spec.id}: no gravityDarkening in the spec.`);
  const record = parseGravityDarkeningRecord({ ...shape.record, schema: ROCHE_VON_ZEIPEL_SCHEMA, objectId: spec.id });
  if (record.inclinationDegrees === undefined || record.polePositionAngleDegrees === undefined)
    throw new TypeError(`${spec.id}: gravityDarkening.record needs view.inclinationDegrees and view.polePositionAngleDegrees, the pole's place on the sky.`);
  const volumeEquivalentSolar = Math.cbrt(record.equatorialRadiusSolar ** 2 * record.polarRadiusSolar);
  if (spec.radius === 'gaia-flame' || Math.abs(spec.radius.value / volumeEquivalentSolar - 1) > 0.001)
    throw new TypeError(`${spec.id}: a flattened star's radius is the volume-equivalent sphere of its fit, ${volumeEquivalentSolar.toFixed(3)} solar radii (equatorial ${record.equatorialRadiusSolar}, polar ${record.polarRadiusSolar}), not ${spec.radius === 'gaia-flame' ? 'gaia-flame' : spec.radius.value}.`);
  return { ...record, inclinationDegrees: record.inclinationDegrees, polePositionAngleDegrees: record.polePositionAngleDegrees, volumeEquivalentSolar };
}

/** Rewrite the generated package so it draws the fit: the record and its manifest entry, the flattened geometry, the measured pole, the
 * latitude darkening, and the words that said the axis was a convention. `publicationId` is the fit's catalogued paper. */
export function installRocheShape(files: PackageFiles, spec: StarSpec, star: { readonly ra: number; readonly dec: number }, publicationId: string) {
  const shape = spec.gravityDarkening!, record = rocheRecord(spec), { id } = spec, o = `src/objects/${id}`, s = `${o}/source`;
  const read = (path: string) => { const text = files.get(path); if (text === undefined) throw new TypeError(`${id}: ${path} was not generated.`); return JSON.parse(String(text)) as Record<string, any>; };
  const replace = (path: string, from: string, to: string, required = true) => {
    const text = files.get(path);
    if (text === undefined || !String(text).includes(from)) { if (required) throw new TypeError(`${id}: ${path} does not hold "${from.slice(0, 60)}".`); return; }
    files.set(path, String(text).replace(from, to));
  };
  const eq = record.equatorialRadiusSolar, pol = record.polarRadiusSolar, fit = `${shape.credit} (${shape.url})`;
  const sentence = `A Roche surface flattened by rotation, ${eq} solar radii at the equator and ${pol} at the poles, its pole ${record.inclinationDegrees} degrees from the line of sight at position angle ${record.polePositionAngleDegrees} degrees, and gravity darkened with exponent ${record.beta} from a ${record.poleTemperatureK.toLocaleString('en-US')} K pole: ${fit}`;

  files.set(`${s}/${ROCHE_RECORD_PATH}`, json({ schema: ROCHE_VON_ZEIPEL_SCHEMA, objectId: id, ...shape.record }));
  const manifest = read(`${s}/manifest.json`);
  manifest.inputs.push({ id: `${id}-roche-von-zeipel`, path: ROCHE_RECORD_PATH, origin: shape.url, credit: shape.credit, license: 'Factual numerical measurements; source attribution retained',
    acquisition: "Transcribed from the paper's table, with each cell quoted", redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['assets', 'datasets', 'rotation'],
    sourceBinding: { kind: 'local', reason: 'Published model parameters transcribed in this package with their table cells; repinned when edited.' } });
  files.set(`${s}/manifest.json`, json(manifest));

  const raster = read(`${s}/preparation/raster.json`), science = raster.surfaces[0].science;
  science.gravityDarkening = ROCHE_RECORD_PATH;
  science.qualification = `${science.qualification} The surface is darkened by latitude from the published Roche-von Zeipel fit of ${shape.credit}: the hot poles brighter and bluer, the cool equator dimmer and redder.`;
  files.set(`${s}/preparation/raster.json`, json(raster));

  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.polarRadius = Number((geometry.surface.radius * pol / eq).toFixed(4));
  files.set(`${s}/preparation/geometry.json`, json(geometry));

  const rotation = read(`${s}/preparation/rotation.json`);
  Object.assign(rotation, inclinedPoleOrientation({ rightAscensionDegrees: star.ra, declinationDegrees: star.dec }, record.inclinationDegrees, record.polePositionAngleDegrees), {
    source: `Measured axis: ${shape.credit}, inclination ${record.inclinationDegrees} degrees from the line of sight and pole position angle ${record.polePositionAngleDegrees} degrees east of north (source/${ROCHE_RECORD_PATH}), the pole tilted toward us; computed by inclinedPoleOrientation in packages/bake/src/objects/stellar/gravity-darkening.ts.`,
    coordinateSystem: 'ICRF/J2000. +Z is the measured rotation pole, the one tilted toward the Earth. +X is the display meridian, set so that grid longitude 0 faces the Sun and Earth at the scene epoch; east longitude. No spin is propagated: the surface has no longitude features to show it.',
    qualification: `The pole direction is measured by interferometry (${shape.credit}). The spin phase and prime meridian are a display convention; the rotation is not animated.` });
  files.set(`${s}/preparation/rotation.json`, json(rotation));

  const measurements = read(`${s}/measurements.json`);
  measurements.angularDiameterSource = String(measurements.angularDiameterSource).replace('No interferometric diameter of this star is used.', "The record's radius is the volume-equivalent sphere of the fit's two radii; the fit gives the radii, not one diameter.");
  measurements.shape = { ...measurements.shape, qualification: `${sentence}. The disc color is the star's measured one; only the pole-to-equator contrast is the model's.` };
  files.set(`${s}/measurements.json`, json(measurements));

  const body = `packages/astronomy/data/bodies/${id}.json`;
  replace(body, JSON.stringify(CONVENTION_NOTE).slice(1, -1), JSON.stringify(` The scene draws the measured flattening (${shape.credit}), with the equatorial radius, ${eq} solar radii, on the outline. presentationUp: the display axis, the measured rotation pole, is up.`).slice(1, -1));

  const content = read(`${s}/content/object.json`);
  content.provenance.physical.credit = String(content.provenance.physical.credit).replace('; no measured rotation axis (display convention)', `; measured rotation pole and flattening (${shape.credit})`);
  // The outline is the equator: the radius a reader is told is the one drawn, cited to the fit.
  const fitSource = { catalogueId: publicationId, url: shape.url, label: shape.credit, checked: CHECKED, path: `source/${ROCHE_RECORD_PATH}` };
  content.panel.facts = content.panel.facts.map((fact: { id: string }) => fact.id === 'radius' ? { ...fact, value: `${eq} solar radii at the equator`, source: { ...fitSource, locator: 'model.equatorialRadiusSolar' } } : fact);
  if (shape.rotationPeriodHours !== undefined) content.panel.facts.push({ id: 'rotation', label: 'Day', value: shape.rotationPeriodHours >= 48 ? `${(shape.rotationPeriodHours / 24).toFixed(1)} days` : `${Math.round(shape.rotationPeriodHours)} hours`,
    source: { ...fitSource, locator: 'note' } });
  files.set(`${s}/content/object.json`, json(content));

  // The dataset's words, as the fast rotators made by hand say them: what colors the disc, and that the spin shades it.
  const text = read(`${o}/text.json`), color = text.datasets?.color;
  if (color) {
    const basis = String(color.detail).replace(/^From its /u, ''), measured = /spectrum/u.test(basis);
    color.detail = `${basis.charAt(0).toUpperCase()}${basis.slice(1)} and spin`;
    color.summary = `${measured ? 'Measured color' : "The color of the star's temperature"}, with hot bright poles and a cool equator from the star's fast spin.${/model atmosphere/u.test(String(color.summary)) ? ' The darker edge is a model.' : ''}`;
    files.set(`${o}/text.json`, json(text));
  }

  const readme = String(files.get(`${o}/README.md`) ?? ''), limbAt = readme.indexOf('\n\n## Evidence');
  if (limbAt < 0) throw new TypeError(`${id}: the README has no Evidence section to place the shape before.`);
  files.set(`${o}/README.md`, `${readme.slice(0, limbAt)}\n\n**Shape.** ${sentence}. The record is [gravity-darkening.json](source/${ROCHE_RECORD_PATH}), each value with its table cell.${shape.rotationPeriodHours === undefined ? '' : ` It turns once in ${shape.rotationPeriodHours} hours; the scene does not turn it.`}${readme.slice(limbAt)}`
    .replace("- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.", '- **Assumptions of the frame.** The pole is measured; the rotation phase is a convention, and the star is not turned.'));
  files.set(`${o}/NOTICE.md`, `${String(files.get(`${o}/NOTICE.md`) ?? '').trimEnd()}\n\nShape, pole and gravity darkening: ${fit}.\n`);
  replace(`src/renderers/css/styles/${id}-surfaces.css`, 'No spin: the rotation axis and period are unmeasured.', 'The rotation pole is measured; no spin is propagated.', false);

  const ledger = read(`${o}/investigations.json`);
  ledger.entries.push({ id: 'shape', subject: 'Shape and pole', status: 'included', finding: `${sentence}.`.replace(/\s+/gu, ' '), evidence: [shape.url] });
  files.set(`${o}/investigations.json`, json(ledger));
}
