/** Planets and companion stars of a generated system: bodies on hosted orbits around a placed star.
 *
 * Phase one writes each body's astronomy record, with its orbit from the spec's route (orbit.mts); the astronomy package is then
 * rebuilt, because the hosted-planet scaffold places the body with the package's own orbit code. Phase two writes the package:
 * the scaffold's shape-only planet (lit by its star, or glowing with its own heat when a temperature is cited), or, for a
 * companion star, the same colour lens a placed star has (lens.mts), from a Planck spectrum at its cited temperature. */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scaffoldHostedPlanetFiles, TODO as HOSTED_TODO } from '../new-hosted-planet.mts';
import { parseCieTable } from '../observation/disc-integrated-color.mts';
import { type Archive, type Publication } from './archives.mts';
import { CHECKED, planckChoice } from './color.mts';
import { bindInputs, CMF, installColorLens, json, type PackageFiles } from './lens.mts';
import { chooseLimb } from './limb.mts';
import { archiveRows, assembleArchiveOrbit, compositeMass, orbitizeHostedOrbit, type AssembledOrbit, type HostedOrbit } from './orbit.mts';
import { TODO } from './scaffold.mts';
import type { Cited, HostedSpec, StarSpec } from './spec.mts';

const JUPITER_RADIUS_KM = 71492, JUPITER_GM = 126686531.9, SOLAR_RADIUS_KM = 695700, GM_SUN = 132712440041.93938, EARTH_RADIUS_KM = 6371.0;
const fixed = (value: number, digits: number) => Number(value.toFixed(digits));

export interface HostedRecord {
  readonly spec: HostedSpec; readonly hostId: string; readonly system: string; readonly body: Record<string, unknown>; readonly order: number;
  readonly orbit: HostedOrbit; readonly orbitCitation: { readonly text: string; readonly url?: string; readonly bibcode?: string; readonly label: string };
  readonly radius: Cited; readonly mass: Cited; readonly documents: Map<string, string>; readonly todo: readonly string[];
}

/** The orbit and physical values of one hosted body, and the files that record how the orbit was chosen. */
export async function hostedRecord(spec: HostedSpec, host: { readonly spec: StarSpec; readonly body: Record<string, any> }, order: number, archive: Archive, root: string): Promise<HostedRecord> {
  const hostRadiusKm = Number(host.body.physical.meanRadiusKm), distance = Number(host.body.star.distanceParsecs), documents = new Map<string, string>(), todo: string[] = [];
  let orbit: HostedOrbit, assembled: AssembledOrbit | undefined, citation: HostedRecord['orbitCitation'];
  if ('whereistheplanet' in spec.orbit) {
    // The paper's posterior, one sample picked with its own measured positions (posterior-pick.py), in a scratch directory first.
    const o = spec.orbit, work = resolve(root, 'output/new-object', spec.id);
    await mkdir(work, { recursive: true });
    const measurements = await readFile(resolve(o.measurements), 'utf8'), csvName = o.measurements.split('/').at(-1)!;
    const pick = { whereistheplanetKey: o.whereistheplanet, ...(o.body ? { body: o.body } : {}), measurements: csvName, measurementsSource: o.measurementsSource };
    await writeFile(resolve(work, csvName), measurements); await writeFile(resolve(work, 'pick.json'), json(pick));
    const { astroqueryToolchainSync } = await import('../astronomy-packages/toolchain.mts'), toolchain = astroqueryToolchainSync();
    execFileSync(toolchain.python, [resolve(root, 'tools/objects/hosted-orbits/posterior-pick.py'), resolve(work, 'pick.json'), resolve(work, 'orbit.json')], { env: { ...process.env, ...toolchain.env }, stdio: ['ignore', 'ignore', 'inherit'] });
    const orbitText = await readFile(resolve(work, 'orbit.json'), 'utf8');
    orbit = orbitizeHostedOrbit(JSON.parse(orbitText), hostRadiusKm, distance, `${o.source} (${o.url})`, `src/objects/${spec.id}/source/orbits/pick.json`);
    for (const [name, text] of [[csvName, measurements], ['pick.json', json(pick)], ['orbit.json', orbitText]] as const) documents.set(`orbits/${name}`, text);
    citation = { text: o.source, url: o.url, label: o.source };
  } else if ('archive' in spec.orbit) {
    const planetName = spec.orbit.planetName ?? spec.name;
    assembled = assembleArchiveOrbit(await archiveRows(archive, planetName), spec.orbit.reference, await compositeMass(archive, planetName));
    orbit = assembled.orbit; if (assembled.todo) todo.push(assembled.todo);
    const row = assembled.rows.find(entry => spec.orbit && 'reference' in spec.orbit && spec.orbit.reference ? entry.reference === spec.orbit.reference || entry.label === spec.orbit.reference : entry.isDefault) ?? assembled.rows[0]!;
    citation = { text: `${row.label}${row.bibcode ? ` (${row.bibcode})` : ''}, via the NASA Exoplanet Archive`, ...(row.url ? { url: row.url } : {}), ...(row.bibcode ? { bibcode: row.bibcode } : {}), label: row.label };
  } else {
    const e = spec.orbit.elements, cite = `${spec.orbit.source} (${spec.orbit.url})`;
    orbit = { periodDays: e.periodDays!, semiMajorAxisStellarRadii: e.semiMajorAxisStellarRadii!, inclinationDegrees: e.inclinationDegrees!, eccentricity: e.eccentricity!,
      ...(e.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsisDegrees: e.argumentOfPeriapsisDegrees }), ...(spec.orbit.epoch ? { epochDefinition: spec.orbit.epoch } : {}), transitTimeBmjdTdb: e.transitTimeBmjdTdb!,
      ascendingNodePositionAngleDegrees: e.ascendingNodePositionAngleDegrees ?? 0,
      sources: { period: `${cite}: P ${e.periodDays} d`, shape: `${cite}: a/R* ${e.semiMajorAxisStellarRadii}, inclination ${e.inclinationDegrees} degrees`, eccentricity: `${cite}: e ${e.eccentricity}`,
        ...(e.argumentOfPeriapsisDegrees === undefined ? {} : { argumentOfPeriapsis: `${cite}: omega ${e.argumentOfPeriapsisDegrees} degrees (the star's)` }), phase: `${cite}: ${spec.orbit.epoch === 'periastron' ? 'periastron passage' : 'transit (inferior conjunction)'} at ${e.transitTimeBmjdTdb} BMJD_TDB`,
        orientation: e.ascendingNodePositionAngleDegrees === undefined ? 'Display convention: the orbit\'s position angle on the sky is not measured, so the ascending node is set at position angle 0 (celestial north).' : `${cite}: ascending node ${e.ascendingNodePositionAngleDegrees} degrees east of north` } };
    citation = { text: spec.orbit.source, url: spec.orbit.url, label: spec.orbit.source };
  }
  const fromRow = (picked: AssembledOrbit['radius'] | undefined, label: string): Cited => {
    if (!picked) throw new Error(`${spec.id}: give ${label} with its source; no archive row supplies it.`);
    return { value: picked.value, source: `${picked.row.label}${picked.row.bibcode ? ` (${picked.row.bibcode})` : ''}, via the NASA Exoplanet Archive`, url: picked.row.url ?? 'https://exoplanetarchive.ipac.caltech.edu/' };
  };
  const radius = spec.radius ?? fromRow(assembled?.radius, 'radius'), mass = spec.mass ?? fromRow(assembled?.mass, 'mass');
  const star = spec.kind === 'companion', unit = star ? { r: SOLAR_RADIUS_KM, gm: GM_SUN, rn: 'solar radii', mn: 'solar masses', rper: 'km per solar radius', gmn: 'the JPL solar GM' }
    : { r: JUPITER_RADIUS_KM, gm: JUPITER_GM, rn: 'Jupiter radii', mn: 'Jupiter masses', rper: 'km per Jupiter radius', gmn: "JPL's Jupiter GM" };
  const radiusKm = radius.value * unit.r, t = spec.temperature;
  const body = { id: spec.id, classification: star ? 'star' : 'exoplanet', order,
    physical: { name: spec.name, horizonsCode: null, meanRadiusKm: fixed(radiusKm, 1), gravitationalParameterKm3PerS2: fixed(mass.value * unit.gm, 2), parent: host.spec.id, ...(star ? { effectiveTemperatureK: t!.value } : {}) },
    physicalNotes: `Radius ${radius.value}${radius.uncertainty ? ` +/- ${radius.uncertainty}` : ''} ${unit.rn} from ${radius.source} (${radius.url}): ${fixed(radiusKm, 1).toLocaleString('en-US')} km at ${unit.r.toLocaleString('en-US')} ${unit.rper}. `
      + `GM from the mass ${mass.value}${mass.uncertainty ? ` +/- ${mass.uncertainty}` : ''} ${unit.mn} (${mass.source}, ${mass.url}) times ${unit.gmn}.${t ? ` Temperature ${t.value}${t.uncertainty ? ` +/- ${t.uncertainty}` : ''} K from ${t.source} (${t.url}).` : ''} A sphere: no oblateness is measured.`,
    hostedOrbit: orbit };
  return { spec, hostId: host.spec.id, system: host.spec.system, body, order, orbit, orbitCitation: citation, radius, mass, documents, todo };
}

/** The package of a hosted body whose astronomy record is built into the astronomy package. */
export async function hostedPackage(record: HostedRecord, hostBody: unknown, publications: Map<string, Publication>, archive: Archive, root: string, epochJdTt: number) {
  const { spec } = record, id = spec.id, o = `src/objects/${id}`, s = `${o}/source`, star = spec.kind === 'companion', t = spec.temperature;
  const scaffold = scaffoldHostedPlanetFiles({ id, name: spec.name, system: record.system, description: spec.description, paper: spec.paper.url, paperCredit: spec.paper.credit, order: record.order,
    rotation: record.orbit.eccentricity === 0 && !star ? 'synchronous' : 'unmeasured', ...(t ? { selfLuminous: { temperatureK: t.value, source: `${t.source} (${t.url})` } } : {}) }, record.body, hostBody, epochJdTt);
  const files: PackageFiles = new Map(scaffold), read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const recordOf = (url: string | undefined) => url ? publications.get(url) : undefined, label = (url: string | undefined, fallback: string) => { const p = recordOf(url); return p && p.creators.length ? `${p.creators[0]!.split(' ').at(-1)}${p.creators.length > 2 ? ' et al.' : ''} ${p.year}` : fallback; };
  const fact = (url: string | undefined, fallback: string, path: string, locator: string) => { const p = recordOf(url); if (!p) throw new Error(`${id}: no publication record for ${url ?? fallback}; cite it by arXiv, DOI or ADS link.`); return { catalogueId: p.id, url: p.url, label: label(url, fallback), checked: CHECKED, path, locator }; };

  let colorHex: string | undefined, limbSentence: string | undefined;
  if (star) {
    const cmfText = await readFile(resolve(root, 'src/objects/hd-189733/source', CMF)), cmf = parseCieTable(cmfText.toString('utf8'), 3);
    const logg = fixed(Math.log10(record.mass.value * GM_SUN * 1e15 / (record.radius.value * SOLAR_RADIUS_KM * 1e5) ** 2), 2);
    const limb = await chooseLimb(id, t!.value, logg, archive);
    const color = planckChoice(id, t!, 'The archives do not resolve this companion from its star', [], cmf);
    const installed = await installColorLens(files, id, color, limb, cmfText);
    colorHex = installed.hex; limbSentence = limb.sentence;
    const measurements = read(`${s}/measurements.json`);
    Object.assign(measurements, { surfaceGravityLogg: logg, surfaceGravitySource: `log g from the mass and radius in packages/astronomy/data/bodies/${id}.json, log10(GM/R^2) in cgs, rounded to two decimals` });
    files.set(`${s}/measurements.json`, json(measurements));
  }
  const measurements = read(`${s}/measurements.json`);
  measurements.massSource = `${record.mass.value} ${star ? 'solar' : 'Jupiter'} masses: ${record.mass.source} (${record.mass.url}).`;
  files.set(`${s}/measurements.json`, json(measurements));

  const content = read(`${s}/content/object.json`), period = record.orbit.periodDays;
  const radiusValue = star ? `${Number(record.radius.value.toPrecision(2))} solar radii` : record.radius.value >= 0.3 ? `${Number(record.radius.value.toPrecision(2))} Jupiter radii` : `${Number((record.radius.value * JUPITER_RADIUS_KM / EARTH_RADIUS_KM).toPrecision(2))} Earth radii`;
  const periodValue = period < 2 ? `${Math.round(period * 24)} hours` : period < 1000 ? `${Number(period.toPrecision(3))} days` : `${Math.round(period / 365.25)} years`;
  content.panel.facts = [
    { id: 'radius', label: 'Radius', value: radiusValue, source: fact(record.radius.url, record.radius.source, 'source/measurements.json', 'radiusKm; radiusSource') },
    { id: 'period', label: 'Year', value: periodValue, source: fact(record.orbitCitation.url, record.orbitCitation.label, 'source/measurements.json', 'orbitalPeriodDays; orbitalPeriodSource') },
    { id: 'mass', label: 'Mass', value: `${Number(record.mass.value.toPrecision(2))} ${star ? 'solar' : 'Jupiter'} masses`, source: fact(record.mass.url, record.mass.source, 'source/measurements.json', 'massSource') }];
  if (!star) {
    const control = content.lenses.controls[0];
    control.notes = `No image or colour of ${spec.name} is published: the sphere has its measured size, and the gray marks an unresolved surface. ${t ? 'It glows with its own heat, so no starlight falls on it.' : "The lighting is its own star's, at the measured orbit."}`;
  }
  content.provenance.physical.credit = `Radius from ${record.radius.source}; mass from ${record.mass.source}; orbit from ${record.orbitCitation.text}`;
  files.set(`${s}/content/object.json`, json(content));
  const rotation = read(`${s}/preparation/rotation.json`);
  rotation.source = String(rotation.source).replace(` (${HOSTED_TODO}: name the literature checked)`, ' in the sources this package cites');
  files.set(`${s}/preparation/rotation.json`, json(rotation));
  const text = read(`${o}/text.json`), paper = recordOf(spec.paper.url);
  if (!paper) throw new Error(`${id}: no publication record for its paper ${spec.paper.url}.`);
  if (!star) text.datasets = { shape: { title: 'Shape only', detail: 'Published radius', summary: 'A sphere at the published size. No picture of its surface exists.' } };
  for (const key of ['card', 'introduction'] as const) {
    text[key].text = spec.text ? spec.text[key] : `${TODO}: ${key === 'card' ? 'one sentence, 110 characters at most' : 'two sentences, 180 characters at most'}.`;
    text[key].sources = [{ catalogueId: paper.id, url: spec.paper.url, label: label(spec.paper.url, spec.paper.credit), checked: CHECKED, ...(spec.text ? { locator: spec.text.locator } : { locator: TODO, quote: TODO }) }];
  }
  files.set(`${o}/text.json`, json(text));
  const manifest = read(`${s}/manifest.json`);
  manifest.documents = [...manifest.documents, ...[...record.documents.keys()].map(path => ({ path, sourceBinding: { kind: 'local', reason: path.endsWith('pick.json')
    ? 'The whereistheplanet posterior and the measured positions that choose one sample from it (tools/objects/hosted-orbits/posterior-pick.py).' : path.endsWith('orbit.json')
      ? 'The sample kept, with the model at every measured position; the astronomy record takes its elements.' : 'The paper\'s published measurements, transcribed for orbitize!.' } }))];
  files.set(`${s}/manifest.json`, json(manifest));
  for (const [path, value] of record.documents) files.set(`${s}/${path}`, value);

  const hosted = star ? 'companion star' : 'planet';
  files.set(`${o}/NOTICE.md`, [`# ${spec.name} credits`, `Radius: ${record.radius.source}. Mass: ${record.mass.source}.${t ? ` Temperature: ${t.source}.` : ''}`,
    `Orbit: ${record.orbitCitation.text}${'whereistheplanet' in spec.orbit ? '; the posterior distributed by whereistheplanet (Wang et al. 2021)' : ''}.`,
    ...star ? ['Colour: a Planck spectrum at the cited temperature through the CIE 1931 2° colour-matching functions (CIE 2019, CC BY-SA 4.0, doi:10.25039/CIE.DS.xvudnb9b).'] : []].join('\n\n') + '\n');
  files.set(`${o}/README.md`, [`# ${spec.name}`, '', '## Sources', '', spec.text ? `${spec.text.introduction} This account was drafted from ${spec.paper.credit}'s values; the sections below are the data's own.` : `${spec.name} is a ${hosted} of ${record.hostId}. ${TODO}: what it is and why it is here, from ${spec.paper.credit}.`, '',
    `**Size and mass.** ${String(record.body.physicalNotes)}`, '', `**Orbit.** ${Object.values(record.orbit.sources).join(' ')}`, '',
    ...star ? [`**Colour.** A Planck spectrum at ${t!.value.toLocaleString('en-US')} K: ${colorHex}. ${limbSentence ? `The disc is ${limbSentence}.` : ''}`, ''] : [],
    '## Evidence', '', `Generated ${CHECKED} by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/${id}.json).`, '',
    ...spec.text ? [] : [`- ${TODO}: the tests and captures that prove the package.`], '', '## Known problems', '',
    ...record.todo.map(item => `- **Orbit convention.** ${item}.`), ...spec.text ? ['- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.'] : [`- ${TODO}: anything else not shown and why.`], '',
    '[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)', ''].join('\n'));
  bindInputs(files, id);
  // One marker for everything a person still writes.
  for (const [path, value] of files) if (typeof value === 'string' && value.includes(HOSTED_TODO)) files.set(path, value.replaceAll(HOSTED_TODO, TODO));
  return { files, hex: colorHex };
}
