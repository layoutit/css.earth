/** Planets and companion stars of a generated system: bodies on hosted orbits around a placed star.
 *
 * Phase one writes each body's astronomy record, with its orbit from the spec's route (orbit.mts); the astronomy package is then
 * rebuilt, because the hosted-planet scaffold places the body with the package's own orbit code. Phase two writes the package:
 * the scaffold's shape-only planet (lit by its star, or glowing with its own heat when a temperature is cited), or, for a
 * companion star, the same colour lens a placed star has (lens.mts), from a Planck spectrum at its cited temperature. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scaffoldHostedPlanetFiles, TODO as HOSTED_TODO } from './new-hosted-planet.mts';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { parseCieTable } from '@cssearth/bake/objects/color';
import { citedName, isCollaboration, type Archive, type Publication } from './archives.mts';
import { CHECKED, planckChoice } from './color.mts';
import { bindInputs, installColorLens, json, type PackageFiles } from './lens.mts';
import { quoteSource } from './prose.mts';
import { writeLedger } from './ledger.mts';
import { hostLightOf, installBandColorLens, installHostLight, installThermalLens, lensMarkerEntry, thermalFromArchive } from './planet-lenses.mts';
import { installPhaseCurveLens } from './phase-curve-lens.mts';
import { installPlanetCharts } from './planet-charts.mts';
import { chooseLimb } from './limb.mts';
import { storedHostedSpec, storedSpecDocument } from './refresh.mts';
import { archiveRows, assembleArchiveOrbit, assembleMeasuredOrbit, compositeMass, compositeRadius, orbitizeHostedOrbit, type AssembledOrbit, type HostedOrbit } from './orbit.mts';
import { TODO } from './scaffold.mts';
import type { Cited, HostedSpec, StarSpec } from './spec.mts';

// EARTH_GM is DE440's, km^3/s^2, the unit of the Jupiter and Sun values beside it.
export const JUPITER_RADIUS_KM = 71492, JUPITER_GM = 126686531.9, SOLAR_RADIUS_KM = 695700, GM_SUN = 132712440041.93938, EARTH_RADIUS_KM = 6371.0, EARTH_GM = 398600.435436;

/** A hosted body's radius and mass as its factsheet shows them: two figures kept as printed (3.0, not 3), whole numbers from 100;
 * a planet under 0.3 Jupiter radii reads both in Earth units, a companion star in solar units. Values are in the spec's units
 * (Jupiter for a planet, solar for a companion). */
export function sizeFacts(star: boolean, radius: number, mass: number) {
  const earthUnits = !star && radius < 0.3, figures = (value: number) => value >= 100 ? Math.round(value).toLocaleString('en-US') : value.toPrecision(2);
  return { radiusValue: star ? `${figures(radius)} solar radii` : earthUnits ? `${figures(radius * JUPITER_RADIUS_KM / EARTH_RADIUS_KM)} Earth radii` : `${figures(radius)} Jupiter radii`,
    massValue: star ? `${figures(mass)} solar masses` : earthUnits ? `${figures(mass * JUPITER_GM / EARTH_GM)} Earth masses` : `${figures(mass)} Jupiter masses` };
}
const fixed = (value: number, digits: number) => Number(value.toFixed(digits));

export interface HostedRecord {
  readonly spec: HostedSpec; readonly hostId: string; readonly system: string; readonly body: Record<string, unknown>; readonly order: number;
  readonly orbit: HostedOrbit; readonly orbitCitation: { readonly text: string; readonly url?: string; readonly bibcode?: string; readonly label: string };
  /** Absent only for a black hole no source measures the size of. */
  readonly radius: Cited | undefined; readonly mass: Cited & { readonly limit?: true; readonly unmeasured?: true }; readonly documents: Map<string, string>; readonly todo: readonly string[];
  /** The astronomy record exists under another owner and is kept as it is: only the package is written. */
  readonly kept?: true;
}

/** A body whose astronomy record another owner writes (spec route { "record": true }): its orbit and values are the record's, and the
 * spec's cited radius, mass and temperature must reproduce them, so the package's facts cannot drift from the record they describe. */
async function keptRecord(spec: HostedSpec, host: { readonly spec: StarSpec; readonly body: Record<string, any> }, root: string): Promise<HostedRecord> {
  const o = spec.orbit as Extract<HostedSpec['orbit'], { record: true }>, path = `packages/astronomy/data/bodies/${spec.id}.json`;
  const body = JSON.parse(await readFile(resolve(root, path), 'utf8')) as Record<string, any>, physical = body.physical ?? {};
  if (physical.parent !== host.spec.id) throw new Error(`${spec.id}: ${path} has parent ${physical.parent}, not ${host.spec.id}.`);
  if (!body.hostedOrbit) throw new Error(`${spec.id}: ${path} has no hostedOrbit to package.`);
  const star = spec.kind === 'companion', unit = star ? { r: SOLAR_RADIUS_KM, gm: GM_SUN } : { r: JUPITER_RADIUS_KM, gm: JUPITER_GM };
  const agree = (field: string, recorded: number, cited: number, digits: number) => {
    if (Math.abs(recorded - cited) > 0.5 * 10 ** -digits) throw new Error(`${spec.id}: ${path} ${field} is ${recorded}; the spec's cited value gives ${cited}. The record's owner and the spec must agree.`);
  };
  agree('physical.meanRadiusKm', Number(physical.meanRadiusKm), fixed(spec.radius!.value * unit.r, 0), 0);
  agree('physical.gravitationalParameterKm3PerS2', Number(physical.gravitationalParameterKm3PerS2), fixed(spec.mass!.value * unit.gm, 0), 0);
  if (spec.temperature) agree('physical.effectiveTemperatureK', Number(physical.effectiveTemperatureK), spec.temperature.value, 0);
  return { spec, hostId: host.spec.id, system: host.spec.system, body, order: Number(body.order), orbit: body.hostedOrbit as HostedOrbit,
    orbitCitation: { text: o.source, url: o.url, label: o.source }, radius: spec.radius!, mass: spec.mass!, documents: new Map(), todo: [], kept: true };
}

/** The orbit and physical values of one hosted body, and the files that record how the orbit was chosen. */
export async function hostedRecord(spec: HostedSpec, host: { readonly spec: StarSpec; readonly body: Record<string, any> }, order: number, archive: Archive, root: string): Promise<HostedRecord> {
  if ('record' in spec.orbit) return keptRecord(spec, host, root);
  const hostRadiusKm = Number(host.body.physical.meanRadiusKm), distance = Number(host.body.star.distanceParsecs), documents = new Map<string, string>(), todo: string[] = [];
  let orbit: HostedOrbit, assembled: AssembledOrbit | undefined, citation: HostedRecord['orbitCitation'];
  if ('whereistheplanet' in spec.orbit) {
    // The paper's posterior, one sample picked with its own measured positions (posterior-pick.py), in a scratch directory first.
    const o = spec.orbit, work = resolve(root, 'output/new-object', spec.id);
    await mkdir(work, { recursive: true });
    const measurements = await readFile(resolve(o.measurements), 'utf8'), csvName = o.measurements.split('/').at(-1)!;
    const pick = { whereistheplanetKey: o.whereistheplanet, ...(o.body ? { body: o.body } : {}), measurements: csvName, measurementsSource: o.measurementsSource };
    await writeFile(resolve(work, csvName), measurements); await writeFile(resolve(work, 'pick.json'), json(pick));
    const { astroqueryToolchainSync } = await import('@cssearth/telescope/node'), toolchain = astroqueryToolchainSync();
    execFileSync(toolchain.python, [resolve(import.meta.dirname, 'hosted-orbits/posterior-pick.py'), resolve(work, 'pick.json'), resolve(work, 'orbit.json')], { env: { ...process.env, ...toolchain.env }, stdio: ['ignore', 'ignore', 'inherit'] });
    const orbitText = await readFile(resolve(work, 'orbit.json'), 'utf8');
    orbit = orbitizeHostedOrbit(JSON.parse(orbitText), hostRadiusKm, distance, `${o.source} (${o.url})`, `src/objects/${spec.id}/source/orbits/pick.json`);
    for (const [name, text] of [[csvName, measurements], ['pick.json', json(pick)], ['orbit.json', orbitText]] as const) documents.set(`orbits/${name}`, text);
    citation = { text: o.source, url: o.url, label: o.source };
  } else if ('archive' in spec.orbit) {
    const planetName = spec.orbit.planetName ?? spec.name;
    const [rows, composite] = await Promise.all([archiveRows(archive, planetName), compositeMass(archive, planetName)]);
    assembled = spec.orbit.measured ? assembleMeasuredOrbit(rows, composite, await compositeRadius(archive, planetName), hostRadiusKm / 695700) : assembleArchiveOrbit(rows, spec.orbit.reference, composite);
    orbit = assembled.orbit; if (assembled.todo) todo.push(assembled.todo);
    const row = assembled.row ?? assembled.rows.find(entry => spec.orbit && 'reference' in spec.orbit && spec.orbit.reference ? entry.reference === spec.orbit.reference || entry.label === spec.orbit.reference : entry.isDefault) ?? assembled.rows[0]!;
    citation = { text: `${row.label}${row.bibcode ? ` (${row.bibcode})` : ''}, via the NASA Exoplanet Archive`, ...(row.url ? { url: row.url } : {}), ...(row.bibcode ? { bibcode: row.bibcode } : {}), label: row.label };
  } else if ('elements' in spec.orbit) {
    const e = spec.orbit.elements, cite = `${spec.orbit.source} (${spec.orbit.url})`;
    orbit = { periodDays: e.periodDays!, semiMajorAxisStellarRadii: e.semiMajorAxisStellarRadii!, inclinationDegrees: e.inclinationDegrees!, eccentricity: e.eccentricity!,
      ...(e.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsisDegrees: e.argumentOfPeriapsisDegrees }), ...(spec.orbit.epoch ? { epochDefinition: spec.orbit.epoch } : {}), transitTimeBmjdTdb: e.transitTimeBmjdTdb!,
      ascendingNodePositionAngleDegrees: e.ascendingNodePositionAngleDegrees ?? 0,
      sources: { period: `${cite}: P ${e.periodDays} d`, shape: `${cite}: a/R* ${e.semiMajorAxisStellarRadii}, inclination ${e.inclinationDegrees} degrees`, eccentricity: `${cite}: e ${e.eccentricity}`,
        ...(e.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsis: `${cite}: omega ${e.argumentOfPeriapsisDegrees} degrees (the star's)` }), phase: `${cite}: ${spec.orbit.epoch === 'periastron' ? 'periastron passage' : spec.orbit.epoch === 'superior-conjunction' ? 'the body behind its host (superior conjunction)' : 'transit (inferior conjunction)'} at ${e.transitTimeBmjdTdb} BMJD_TDB`,
        orientation: e.ascendingNodePositionAngleDegrees === undefined ? 'Display convention: the orbit\'s position angle on the sky is not measured, so the ascending node is set at position angle 0 (celestial north).' : `${cite}: ascending node ${e.ascendingNodePositionAngleDegrees} degrees east of north` } };
    citation = { text: spec.orbit.source, url: spec.orbit.url, label: spec.orbit.source };
  } else throw new Error(`${spec.id}: unreachable orbit route.`);
  const fromRow = (picked: AssembledOrbit['mass'] | undefined, label: string): Cited & { limit?: true; unmeasured?: true } => {
    if (!picked) throw new Error(`${spec.id}: give ${label} with its source; no archive row supplies it.`);
    return { value: picked.value, ...(picked.limit ? { limit: true as const } : {}), ...(picked.unmeasured ? { unmeasured: true as const } : {}), source: picked.unmeasured ? picked.row.label : `${picked.row.label}${picked.row.bibcode ? ` (${picked.row.bibcode})` : ''}, via the NASA Exoplanet Archive`, url: picked.row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  };
  const blackHole = spec.blackHole === true;
  const radius = blackHole ? spec.radius : spec.radius ?? fromRow(assembled?.radius, 'radius'), mass = spec.mass ?? fromRow(assembled?.mass, 'mass');
  const star = spec.kind === 'companion', unit = star ? { r: SOLAR_RADIUS_KM, gm: GM_SUN, rn: 'solar radii', mn: 'solar masses', rper: 'km per solar radius', gmn: 'the JPL solar GM' }
    : { r: JUPITER_RADIUS_KM, gm: JUPITER_GM, rn: 'Jupiter radii', mn: 'Jupiter masses', rper: 'km per Jupiter radius', gmn: "JPL's Jupiter GM" };
  const radiusKm = radius ? radius.value * unit.r : 0, t = spec.temperature;
  const body = { id: spec.id, classification: blackHole ? 'black-hole' : star ? 'star' : 'exoplanet', order,
    physical: { name: spec.name, horizonsCode: null, meanRadiusKm: fixed(radiusKm, 1), gravitationalParameterKm3PerS2: ('limit' in mass && mass.limit) || ('unmeasured' in mass && mass.unmeasured) ? 0 : fixed(mass.value * unit.gm, 2), parent: host.spec.id, ...(star && !blackHole ? { effectiveTemperatureK: t!.value } : {}) },
    physicalNotes: (radius ? `Radius ${radius.value}${radius.uncertainty ? ` +/- ${radius.uncertainty}` : ''} ${unit.rn} from ${radius.source} (${radius.url}): ${fixed(radiusKm, 1).toLocaleString('en-US')} km at ${unit.r.toLocaleString('en-US')} ${unit.rper}. `
      : 'No source measures a size for this black hole (no shadow or horizon is resolved), so the radius is the records\' unmeasured 0 and it is drawn as a point. ')
      + ('unmeasured' in mass && mass.unmeasured ? `No mass is measured: ${mass.source} (${mass.url}), so GM is 0, the records' unpublished value.`
        : 'limit' in mass && mass.limit ? `No mass is measured: ${mass.source} (${mass.url}) gives only an upper limit of ${mass.value} ${unit.mn}, so GM is 0, the records' unpublished value.`
        : `GM from the mass ${mass.value}${mass.uncertainty ? ` +/- ${mass.uncertainty}` : ''} ${unit.mn} (${mass.source}, ${mass.url}) times ${unit.gmn}.`) + `${t ? ` Temperature ${t.value}${t.uncertainty ? ` +/- ${t.uncertainty}` : ''} K from ${t.source} (${t.url}).` : ''}${blackHole ? '' : ' A sphere: no oblateness is measured.'}`,
    hostedOrbit: orbit };
  return { spec, hostId: host.spec.id, system: host.spec.system, body, order, orbit, orbitCitation: citation, radius, mass, documents, todo };
}

/** The package of a hosted body whose astronomy record is built into the astronomy package. */
export async function hostedPackage(record: HostedRecord, hostBody: unknown, publications: Map<string, Publication>, archive: Archive, root: string, epochJdTt: number) {
  const { spec } = record, id = spec.id, o = `src/objects/${id}`, s = `${o}/source`, star = spec.kind === 'companion', t = spec.temperature;
  if (spec.blackHole) throw new Error(`${id}: a black hole companion is an astronomy record only; it has no package.`);
  const radius = record.radius;
  if (!radius) throw new Error(`${id}: a packaged body needs its cited radius.`);
  const scaffold = scaffoldHostedPlanetFiles({ id, name: spec.name, system: record.system, description: spec.description, paper: spec.paper.url, paperCredit: spec.paper.credit, order: record.order,
    rotation: record.orbit.eccentricity === 0 && !star ? 'synchronous' : 'unmeasured', ...(t ? { selfLuminous: { temperatureK: t.value, source: `${t.source} (${t.url})` } } : {}) }, record.body, hostBody, epochJdTt);
  const files: PackageFiles = new Map(scaffold), read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const recordOf = (url: string | undefined) => url ? publications.get(url) : undefined, label = (url: string | undefined, fallback: string) => { const p = recordOf(url); return p && p.creators.length ? `${citedName(p.creators[0]!)}${p.creators.length > 2 && !isCollaboration(p.creators[0]!) ? ' et al.' : ''} ${p.year}` : fallback; };
  const fact = (url: string | undefined, fallback: string, path: string, locator: string) => { const p = recordOf(url); if (!p) throw new Error(`${id}: no publication record for ${url ?? fallback}; cite it by arXiv, DOI or ADS link.`); return { catalogueId: p.id, url: p.url, label: label(url, fallback), checked: CHECKED, path, locator }; };

  let colorHex: string | undefined, limbSentence: string | undefined;
  if (star) {
    const cmf = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
    const logg = fixed(Math.log10(record.mass.value * GM_SUN * 1e15 / (radius.value * SOLAR_RADIUS_KM * 1e5) ** 2), 2);
    const limb = await chooseLimb(id, t!.value, logg, archive);
    const color = planckChoice(id, t!, spec.colorReason ?? 'The archives do not resolve this companion from its star', [], cmf);
    const installed = await installColorLens(files, id, color, limb);
    colorHex = installed.hex; limbSentence = limb.sentence;
    const measurements = read(`${s}/measurements.json`);
    Object.assign(measurements, { surfaceGravityLogg: logg, surfaceGravitySource: `log g from the mass and radius in packages/astronomy/data/bodies/${id}.json, log10(GM/R^2) in cgs, rounded to two decimals` });
    files.set(`${s}/measurements.json`, json(measurements));
  }
  // A planet's colour from what is measured (planet-lenses.mts): its dayside temperature in eclipse, else its star's light on the gray.
  let colorLine: string | undefined, colorCredit: string | undefined;
  if (!star && spec.photometry) {
    const installed = await installBandColorLens(files, id, spec.name, spec.photometry);
    colorHex = installed.hex; colorCredit = installed.credit;
    colorLine = `**Colour.** Infrared false colour from the flux densities ${spec.photometry.source.citation} publishes (${spec.photometry.source.locator}): ${colorHex}. ${spec.photometry.displayRangeSource}`;
  } else if (!star && spec.thermal) {
    const { csv } = await thermalFromArchive(archive, 'archive' in spec.orbit ? spec.orbit.planetName ?? spec.name : spec.name);
    const installed = await installThermalLens(files, id, spec.name, spec.thermal, csv);
    colorHex = installed.hex; colorCredit = installed.credit;
    colorLine = `**Colour.** A black body at the ${spec.thermal.temperatureK.toLocaleString('en-US')} K dayside brightness temperature measured in secondary eclipse at ${spec.thermal.wavelengthMicrometres} µm (${spec.thermal.source}): ${colorHex}. Chosen from the archive's emission rows by rule: ${spec.thermal.chosen}. Reflected starlight is not included.`;
  } else if (!star && !t) {
    const light = await hostLightOf(root, record.hostId);
    if (light) { installHostLight(files, id, light); colorLine = `**Colour.** No image or measured colour exists. The neutral gray is lit by ${record.hostId}'s measured colour (${light.srgb}, ${light.source}) at the gray's own brightness.`; }
  }
  const measurements = read(`${s}/measurements.json`);
  measurements.massSource = record.mass.unmeasured ? `Not measured: ${record.mass.source} (${record.mass.url}).` : `${record.mass.limit ? 'Under ' : ''}${record.mass.value} ${star ? 'solar' : 'Jupiter'} masses: ${record.mass.source} (${record.mass.url}).`;
  files.set(`${s}/measurements.json`, json(measurements));

  const content = read(`${s}/content/object.json`), period = record.orbit.periodDays;
  const { radiusValue, massValue } = sizeFacts(star, radius.value, record.mass.value);
  const periodValue = period < 2 ? `${Math.round(period * 24)} hours` : period < 1000 ? `${Number(period.toPrecision(3))} days` : `${Math.round(period / 365.25)} years`;
  // A value the archive calculates from a relation, not a paper's measurement, says so on the fact itself, not only in its source.
  const model = (value: Cited) => value.source.includes('a model, not a measurement') ? ' (model)' : '';
  content.panel.facts = [
    { id: 'radius', label: 'Radius', value: `${radiusValue}${model(radius)}`, source: fact(radius.url, radius.source, 'source/measurements.json', 'radiusKm; radiusSource') },
    { id: 'period', label: 'Year', value: periodValue, source: fact(record.orbitCitation.url, record.orbitCitation.label, 'source/measurements.json', 'orbitalPeriodDays; orbitalPeriodSource') },
    { id: 'mass', label: 'Mass', value: record.mass.unmeasured ? 'Not measured' : `${record.mass.limit ? 'Under ' : ''}${massValue}${model(record.mass)}`, source: fact(record.mass.url, record.mass.source, 'source/measurements.json', 'massSource') }];
  // A planet still on the shape lens: its notes say so; a thermal, band-colour or host-lit lens wrote its own.
  if (!star && !spec.photometry && !spec.thermal) {
    const control = content.lenses.controls[0];
    // The base note replaces the scaffold's TODO; host light, when installed, adds its sentence after it.
    const hostLit = String(control.notes).match(/ The gray takes the colour of [^.]*'s light, as its colour lens measures it\./u)?.[0] ?? '';
    control.notes = `No image or colour of ${spec.name} is published: the sphere has its measured size, and the gray marks an unresolved surface. ${t ? 'It glows with its own heat, so no starlight falls on it.' : "The lighting is its own star's, at the measured orbit."}${hostLit}`;
  }
  content.provenance.physical.credit = `Radius from ${radius.source}; mass from ${record.mass.source}; orbit from ${record.orbitCitation.text}`;
  files.set(`${s}/content/object.json`, json(content));
  const rotation = read(`${s}/preparation/rotation.json`);
  rotation.source = String(rotation.source).replace(` (${HOSTED_TODO}: name the literature checked)`, ' in the sources this package cites');
  files.set(`${s}/preparation/rotation.json`, json(rotation));
  const text = read(`${o}/text.json`), paper = recordOf(spec.paper.url);
  if (!paper) throw new Error(`${id}: no publication record for its paper ${spec.paper.url}.`);
  if (!star && !spec.photometry && !spec.thermal) text.datasets = { shape: { title: 'Shape only', detail: 'Published radius', summary: 'A sphere at the published size. No picture of its surface exists.' } };
  for (const key of ['card', 'introduction'] as const) {
    text[key].text = spec.text ? spec.text[key] : `${TODO}: ${key === 'card' ? 'one sentence, 110 characters at most' : 'two sentences, 180 characters at most'}.`;
    text[key].sources = [{ catalogueId: paper.id, url: spec.paper.url, label: label(spec.paper.url, spec.paper.credit), checked: CHECKED, ...(spec.text ? { locator: spec.text.locator } : { locator: TODO, quote: TODO }) }, ...quoteSource(spec.text?.quotes, key, publications)];
  }
  files.set(`${o}/text.json`, json(text));
  // Heat maps from published phase-curve fits join the colour lens, which stays the default (phase-curve-lens.mts).
  const heat: { readonly line: string; readonly entry: NonNullable<HostedSpec['phaseCurves']>[number] }[] = [];
  for (const entry of star ? [] : spec.phaseCurves ?? []) {
    const { minimum, maximum, hottest } = await installPhaseCurveLens(files, id, spec.name, entry);
    heat.push({ entry, line: `**${entry.label} heat map.** ${entry.credit}'s published fit to ${entry.observed} ([record](source/${entry.path})), drawn as a map of longitude without refitting: ${minimum.toLocaleString('en-US')} to ${maximum.toLocaleString('en-US')} K, hottest ${hottest === 0 ? 'at noon' : `${Math.abs(hottest)}° ${hottest > 0 ? 'east' : 'west'} of noon`}. It has no north-south information.` });
  }
  const manifest = read(`${s}/manifest.json`);
  manifest.documents = [...manifest.documents, ...[...record.documents.keys()].map(path => ({ path, sourceBinding: { kind: 'local', reason: path.endsWith('pick.json')
    ? 'The whereistheplanet posterior and the measured positions that choose one sample from it (packages/telescope-cli/src/new-object/hosted-orbits/posterior-pick.py).' : path.endsWith('orbit.json')
      ? 'The sample kept, with the model at every measured position; the astronomy record takes its elements.' : 'The paper\'s published measurements, transcribed for orbitize!.' } })), storedSpecDocument];
  // The spec this package was made from, so `--refresh` can make it again (refresh.mts).
  files.set(`${s}/preparation/new-object.json`, storedHostedSpec(spec, record.hostId, record.order));
  files.set(`${s}/manifest.json`, json(manifest));
  for (const [path, value] of record.documents) files.set(`${s}/${path}`, value);

  const hosted = star ? 'companion star' : 'planet';
  files.set(`${o}/NOTICE.md`, [`# ${spec.name} credits`, `Radius: ${radius.source}. Mass: ${record.mass.source}.${t ? ` Temperature: ${t.source}.` : ''}`,
    `Orbit: ${record.orbitCitation.text}${'whereistheplanet' in spec.orbit ? '; the posterior distributed by whereistheplanet (Wang et al. 2021)' : ''}.`,
    ...star ? ['Colour: a Planck spectrum at the cited temperature through the CIE 1931 2° colour-matching functions (CIE 2019, CC BY-SA 4.0, doi:10.25039/CIE.DS.xvudnb9b).'] : colorCredit ? [colorCredit] : []].join('\n\n') + '\n');
  files.set(`${o}/README.md`, [`# ${spec.name}`, '', '## Sources', '', spec.text ? `${spec.text.introduction} This account was drafted from ${spec.paper.credit}'s values; the sections below are the data's own.` : `${spec.name} is a ${hosted} of ${record.hostId}. ${TODO}: what it is and why it is here, from ${spec.paper.credit}.`, '',
    `**Size and mass.** ${String(record.body.physicalNotes)}`, '', `**Orbit.** ${Object.values(record.orbit.sources).join(' ')}`, '',
    ...star ? [`**Colour.** A Planck spectrum at ${t!.value.toLocaleString('en-US')} K: ${colorHex}, because ${(spec.colorReason ?? 'The archives do not resolve this companion from its star').replace(/^[A-Z](?=[a-z])/u, c => c.toLowerCase())}. ${limbSentence ? `The disc is ${limbSentence}.` : ''}`, ''] : colorLine ? [colorLine, ''] : [],
    ...heat.flatMap(({ line }) => [line, '']),
    '## Evidence', '', `Generated ${CHECKED} by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/${id}.json).`, '',
    ...spec.text ? [] : [`- ${TODO}: the tests and captures that prove the package.`], '', '## Known problems', '',
    ...record.todo.map(item => `- **Orbit convention.** ${item}.`), ...spec.text ? [`- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person${spec.text.quotes ? `; their quotes are sentences of the Wikipedia article "${spec.text.quotes.title}" (revision ${spec.text.quotes.revision}), verbatim, CC BY-SA 4.0` : ''}.`] : [`- ${TODO}: anything else not shown and why.`], '',
    '[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)', ''].join('\n'));
  // The Charts tab: the system's orbits and any archive spectra (planet-charts.mts), with their README paragraph.
  if (!star) await installPlanetCharts(files, id, spec.name, { id: record.hostId, name: String((hostBody as { physical?: { name?: unknown } } | undefined)?.physical?.name ?? record.system.replace(/ system$/u, '')) }, archive, undefined, 'archive' in spec.orbit ? spec.orbit.planetName : undefined);
  // The ledger records each value's source and the colour chosen, with the links they cite.
  const unitName = star ? 'solar radii' : 'Jupiter radii';
  writeLedger(files, id, [
    { id: 'radius', subject: 'Radius', evidence: [radius.url], finding: `${radius.value}${radius.uncertainty ? ` +/- ${radius.uncertainty}` : ''} ${unitName} from ${radius.source}.` },
    { id: 'mass', subject: 'Mass', evidence: [record.mass.url], finding: String(measurements.massSource) },
    { id: 'orbit', subject: 'Orbit', evidence: record.orbitCitation.url ? [record.orbitCitation.url] : [], finding: `${Object.values(record.orbit.sources).join('; ')}.` },
    ...star && t ? [{ id: 'colour', subject: 'Colour', evidence: [t.url], finding: `A Planck spectrum at ${t.value} K from ${t.source}: ${colorHex}, because ${(spec.colorReason ?? 'The archives do not resolve this companion from its star').replace(/^[A-Z](?=[a-z])/u, c => c.toLowerCase())}.${limbSentence ? ` The disc is ${limbSentence}.` : ''}` }]
      : spec.photometry ? [{ id: 'colour', subject: 'Colour', evidence: [spec.photometry.source.url], finding: String(colorLine).replace('**Colour.** ', '') }]
      : spec.thermal ? [{ id: 'colour', subject: 'Colour', evidence: [spec.thermal.url], finding: String(colorLine).replace('**Colour.** ', '') }] : [],
    ...heat.map(({ entry, line }) => ({ id: entry.lens, subject: `${entry.label} heat map`, evidence: [entry.url], finding: line.replace(/^\*\*[^*]+\*\* /u, '') })),
  ]);
  // A planet's marker is its lens drawn as a disc (the companion star's comes from its colour lens, lens.mts).
  if (!star) lensMarkerEntry(files, id);
  bindInputs(files, id);
  // One marker for everything a person still writes.
  for (const [path, value] of files) if (typeof value === 'string' && value.includes(HOSTED_TODO)) files.set(path, value.replaceAll(HOSTED_TODO, TODO));
  return { files, hex: colorHex };
}
