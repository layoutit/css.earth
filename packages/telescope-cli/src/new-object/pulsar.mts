/** A pulsar with a published surface map, as a placed star: the `pulsars` entries of a spec file (spec.mts lists the stars').
 *
 * A neutron star is too small to image, so everything here is cited: its timing position, proper motion and distance, its mass, the
 * radius a pulse-profile fit infers, its spin, and the fit's hot regions as `cssearth-published-hot-regions@1`, which the
 * `published-hot-region-map` format draws without refitting (packages/bake/src/objects/raster/hot-region-map.ts). The record may add
 * `bulk`, the temperature another paper measures for the surface outside the hot regions; without it that surface is no data. No
 * visible color is measured, so the astronomy record has no temperature and the catalogue dot is the shared neutral gray.
 *
 *   { "pulsars": [{ "id", "name", "description", "system"?, "order"?, "aliases"?,
 *     "paper": { "url", "credit" },
 *     "position": { "rightAscensionDegrees", "declinationDegrees", "epochJulianYear", "properMotionRaMasPerYear", "properMotionDecMasPerYear", "source", "url" },
 *     "distance": cited parsecs, "radialVelocity": cited km/s, "radius": cited km, "mass": cited solar masses,
 *     "spin": { "frequencyHz", "inclinationDegrees", "source", "url" },
 *     "hotRegions": { "label", "path", "url", "credit", "observed", "record" },
 *     "limb": { "nsxTable": path to nsx_H_v200804.out on this machine },
 *     "posterior"?: { "samples": path to the fit's equal-weight posterior samples on this machine, "parameters": [its column names, in order],
 *       "keep": how many evenly spaced samples to keep, "url", "credit" },
 *     "text": { "card", "introduction", "locator" }, "notes"?: [ … ] }] }
 *
 * `spin.inclinationDegrees` is the angle from the north rotation pole to the line of sight toward Earth, 0 to 180, in the fit's own
 * frame; the map's longitude 0 is the meridian that faces Earth at the fit's phase zero, and the star is drawn at that phase.
 *
 * With `posterior`, and a record whose own `posterior` says which column feeds which region parameter, the map is the mean over a
 * thinned set of the fit's posterior samples instead of its single best sample: the samples are kept beside the star as a small
 * tab-separated file, every k-th row of the deposit, with only the columns the regions read.
 *
 * The limb: the fits read a hydrogen atmosphere's emergent intensity from the NSX table (nsx-atmosphere.ts in @cssearth/bake). Its
 * bolometric intensity against the emission angle, at the star's gravity and the temperature most of the disc is at, is fitted with
 * the quadratic law and kept beside the star with the profile it was fitted to, so the law can be checked without the 256 MB table
 * (X-PSI's tutorial files, https://doi.org/10.5281/zenodo.7113931, hold it). */
import { readFile } from 'node:fs/promises';
import { skyBasis, directionFromRaDec } from '@cssearth/astronomy';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { NEUTRAL_CATALOGUE_COLOR } from '@cssearth/objects';
import { parseHotRegionSamples, parsePublishedHotRegions, publishedHotRegionMap } from '@cssearth/bake/objects/raster';
import { checkLimbLaw, fitQuadraticLimb, neutronStarLog10Gravity, nsxLimbProfile, readNsxTable, type NsxTable } from '@cssearth/bake/objects/stellar';
import { CHECKED } from './color.mts';
import { bindInputs, json, type PackageFiles } from './dataset.mts';
import { fetchPublication, liveArchive, type Archive, type Publication } from './archives.mts';
import { scaffoldStarFiles } from './scaffold.mts';
import { writeLedger } from './ledger.mts';
import { datasetMarkerEntry } from './planet-datasets.mts';
import { storedSpecDocument, STORED_SPEC } from './refresh.mts';
import type { Cited, DraftText } from './spec.mts';

const GM_SUN = 132712440041.93938, PARSEC_KM = 3.085677581491367e13, MAS_RAD = Math.PI / 180 / 3.6e6;
const PLASMA = ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'];
const URL_PATTERN = /^https:\/\/\S+$/u;
const NSX = { path: 'photometry/nsx-limb-darkening.json', url: 'https://doi.org/10.5281/zenodo.7113931',
  credit: 'NSX hydrogen atmosphere table nsx_H_v200804.out (Ho & Lai 2001, MNRAS 327, 1081; Ho & Heinke 2009, Nature 462, 71), distributed with X-PSI' } as const;

export interface PulsarSpec {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string; readonly order?: number; readonly aliases?: readonly string[];
  readonly paper: { readonly url: string; readonly credit: string };
  readonly position: { readonly rightAscensionDegrees: number; readonly declinationDegrees: number; readonly epochJulianYear: number; readonly properMotionRaMasPerYear: number; readonly properMotionDecMasPerYear: number; readonly source: string; readonly url: string };
  readonly distance: Cited; readonly radialVelocity: Cited; readonly radius: Cited; readonly mass: Cited;
  readonly spin: { readonly frequencyHz: number; readonly inclinationDegrees: number; readonly source: string; readonly url: string };
  readonly hotRegions: { readonly label: string; readonly path: string; readonly url: string; readonly credit: string; readonly observed: string; readonly record: Readonly<Record<string, unknown>> };
  readonly limb: { readonly nsxTable: string };
  readonly posterior?: { readonly samples: string; readonly parameters: readonly string[]; readonly keep: number; readonly url: string; readonly credit: string };
  readonly text: DraftText; readonly notes: readonly string[];
}

export function parsePulsarSpec(value: unknown): PulsarSpec {
  const input = requireRecord(value, 'pulsar spec'), id = requireString(input.id, 'id'), at = (label: string) => `${id}.${label}`;
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`${id}: a pulsar id is lowercase letters, digits and hyphens.`);
  const known = new Set(['id', 'name', 'system', 'description', 'order', 'aliases', 'paper', 'position', 'distance', 'radialVelocity', 'radius', 'mass', 'spin', 'hotRegions', 'limb', 'posterior', 'text', 'notes']);
  const unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${id}: unknown pulsar spec fields ${unknown.join(', ')}.`);
  const url = (source: unknown, label: string) => { const text = requireString(source, label); if (!URL_PATTERN.test(text)) throw new TypeError(`${label} must be an https URL, not ${text}.`); return text; };
  const cited = (source: unknown, label: string, range: readonly [number, number]): Cited => {
    const c = requireRecord(source, label), number = requireFiniteNumber(c.value, `${label}.value`);
    if (number < range[0] || number > range[1]) throw new RangeError(`${label}.value ${number} is outside ${range[0]} to ${range[1]}.`);
    const uncertainty = c.uncertainty === undefined ? undefined : requireFiniteNumber(c.uncertainty, `${label}.uncertainty`);
    if (uncertainty !== undefined && !(uncertainty > 0)) throw new RangeError(`${label}.uncertainty must be positive.`);
    return { value: number, source: requireString(c.source, `${label}.source`), url: url(c.url, `${label}.url`), ...(uncertainty === undefined ? {} : { uncertainty }) };
  };
  const within = (number: number, label: string, low: number, high: number) => { if (!(number >= low && number <= high)) throw new RangeError(`${label} ${number} is outside ${low} to ${high}.`); return number; };
  const name = requireString(input.name, at('name')), paper = requireRecord(input.paper, at('paper')), position = requireRecord(input.position, at('position'));
  const spin = requireRecord(input.spin, at('spin')), regions = requireRecord(input.hotRegions, at('hotRegions')), text = requireRecord(input.text, at('text'));
  const path = requireString(regions.path, at('hotRegions.path'));
  if (!/^science\/[a-z0-9-]+\/[a-z0-9.-]+\.json$/u.test(path)) throw new TypeError(`${at('hotRegions.path')} ${path}: a record lives at science/<paper>/<name>.json.`);
  const record = requireRecord(regions.record, at('hotRegions.record')), bulk = parsePublishedHotRegions(record).bulk;
  if (bulk) url(bulk.url, at('hotRegions.record.bulk.url'));
  const card = requireString(text.card, at('text.card')), introduction = requireString(text.introduction, at('text.introduction'));
  if (card.length > 110) throw new RangeError(`${at('text.card')} is ${card.length} characters; the card budget is 110.`);
  if (introduction.length > 180) throw new RangeError(`${at('text.introduction')} is ${introduction.length} characters; the budget is 180.`);
  const aliases = input.aliases === undefined ? undefined : requireArray(input.aliases, at('aliases')).map(alias => requireString(alias, at('aliases')));
  return { id, name, system: input.system === undefined ? `${name} system` : requireString(input.system, at('system')), description: requireString(input.description, at('description')),
    ...(input.order === undefined ? {} : { order: requireFiniteNumber(input.order, at('order')) }), ...(aliases?.length ? { aliases } : {}),
    paper: { url: url(paper.url, at('paper.url')), credit: requireString(paper.credit, at('paper.credit')) },
    position: { rightAscensionDegrees: within(requireFiniteNumber(position.rightAscensionDegrees, at('position.rightAscensionDegrees')), at('position.rightAscensionDegrees'), 0, 360),
      declinationDegrees: within(requireFiniteNumber(position.declinationDegrees, at('position.declinationDegrees')), at('position.declinationDegrees'), -90, 90),
      epochJulianYear: within(requireFiniteNumber(position.epochJulianYear, at('position.epochJulianYear')), at('position.epochJulianYear'), 1950, 2100),
      properMotionRaMasPerYear: requireFiniteNumber(position.properMotionRaMasPerYear, at('position.properMotionRaMasPerYear')), properMotionDecMasPerYear: requireFiniteNumber(position.properMotionDecMasPerYear, at('position.properMotionDecMasPerYear')),
      source: requireString(position.source, at('position.source')), url: url(position.url, at('position.url')) },
    // A neutron star: 5 to 30 km and 0.5 to 3 solar masses bound every equation of state and every measured mass.
    distance: cited(input.distance, at('distance'), [1, 1e6]), radialVelocity: cited(input.radialVelocity, at('radialVelocity'), [-2000, 2000]), radius: cited(input.radius, at('radius'), [5, 30]), mass: cited(input.mass, at('mass'), [0.5, 3]),
    spin: { frequencyHz: within(requireFiniteNumber(spin.frequencyHz, at('spin.frequencyHz')), at('spin.frequencyHz'), 0.01, 2000), inclinationDegrees: within(requireFiniteNumber(spin.inclinationDegrees, at('spin.inclinationDegrees')), at('spin.inclinationDegrees'), 0, 180),
      source: requireString(spin.source, at('spin.source')), url: url(spin.url, at('spin.url')) },
    hotRegions: { label: requireString(regions.label, at('hotRegions.label')), path, url: url(regions.url, at('hotRegions.url')), credit: requireString(regions.credit, at('hotRegions.credit')), observed: requireString(regions.observed, at('hotRegions.observed')), record },
    ...(input.posterior === undefined ? {} : { posterior: (() => {
      const p = requireRecord(input.posterior, at('posterior')), keep = requireFiniteNumber(p.keep, at('posterior.keep'));
      if (!(Number.isInteger(keep) && keep >= 100 && keep <= 20000)) throw new RangeError(`${at('posterior.keep')} ${keep} is outside 100 to 20,000 samples.`);
      if (requireRecord(record, at('hotRegions.record')).posterior === undefined) throw new TypeError(`${id}: posterior samples need hotRegions.record.posterior, which says which column feeds which region parameter.`);
      return { samples: requireString(p.samples, at('posterior.samples')), parameters: requireArray(p.parameters, at('posterior.parameters')).map(name => requireString(name, at('posterior.parameters'))), keep,
        url: url(p.url, at('posterior.url')), credit: requireString(p.credit, at('posterior.credit')) };
    })() }),
    limb: { nsxTable: requireString(requireRecord(input.limb, `${at('limb')} (a pulsar is drawn with its atmosphere's limb: give limb.nsxTable, the path of nsx_H_v200804.out from ${NSX.url})`).nsxTable, at('limb.nsxTable')) },
    text: { card, introduction, locator: requireString(text.locator, at('text.locator')) },
    notes: input.notes === undefined ? [] : requireArray(input.notes, at('notes')).map(note => requireString(note, at('notes'))) };
}

/** The astronomy record: the timing position and motion, the cited distance, radius and mass. */
export function pulsarRecord(spec: PulsarSpec, order: number) {
  const plus = (value: Cited, unit: string) => `${value.value}${value.uncertainty ? ` +/- ${value.uncertainty}` : ''} ${unit} from ${value.source} (${value.url})`;
  return { id: spec.id, classification: 'star', order,
    physical: { name: spec.name, horizonsCode: null, meanRadiusKm: spec.radius.value, gravitationalParameterKm3PerS2: Number((GM_SUN * spec.mass.value).toFixed(5)), parent: null },
    physicalNotes: `A neutron star. Radius ${plus(spec.radius, 'km')}: inferred from the shape of its X-ray pulse, not imaged. Mass ${plus(spec.mass, 'solar masses')}; GM is that mass times the JPL solar GM. `
      + `The record carries no effective temperature: no visible color of the star is measured, and its surface temperatures are in its hot-region record. Spin ${spec.spin.frequencyHz} turns per second, the north rotation pole ${spec.spin.inclinationDegrees} degrees from the line of sight, from ${spec.spin.source} (${spec.spin.url}). `
      + 'presentationUp: the display axis has the published tilt; its position angle on the sky is a convention.',
    star: { rightAscensionDegrees: spec.position.rightAscensionDegrees, declinationDegrees: spec.position.declinationDegrees, positionEpochJulianYear: spec.position.epochJulianYear, distanceParsecs: spec.distance.value,
      properMotionRaMasPerYear: spec.position.properMotionRaMasPerYear, properMotionDecMasPerYear: spec.position.properMotionDecMasPerYear, radialVelocityKmPerS: spec.radialVelocity.value, presentationUp: 'display-axis',
      sources: { position: `${spec.position.source} (${spec.position.url}): pulsar timing position at epoch J${spec.position.epochJulianYear}.`,
        distance: `${plus(spec.distance, 'pc')}.`,
        properMotion: `${spec.position.source} (${spec.position.url}): ${spec.position.properMotionRaMasPerYear}, ${spec.position.properMotionDecMasPerYear} mas/yr.`,
        radialVelocity: `${plus(spec.radialVelocity, 'km/s')}.` } } };
}

/** The pole and display meridian of a star whose north pole is `inclination` degrees from the line of sight toward Earth, tilted
 * toward celestial north: an IAU pole and W angle with body longitude 0 on the meridian that faces Earth. */
export function tiltedOrientation(rightAscensionDegrees: number, declinationDegrees: number, inclinationDegrees: number) {
  const { north } = skyBasis(rightAscensionDegrees, declinationDegrees), toEarth = directionFromRaDec(rightAscensionDegrees, declinationDegrees).map(value => -value);
  const i = inclinationDegrees * Math.PI / 180, pole = [0, 1, 2].map(k => Math.sin(i) * north[k]! + Math.cos(i) * toEarth[k]!);
  const length = Math.hypot(pole[0]!, pole[1]!);
  if (length < 1e-12) throw new TypeError('A rotation pole on the celestial pole has no node.');
  const node = [-pole[1]! / length, pole[0]! / length, 0], dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const cross = [node[1]! * toEarth[2]! - node[2]! * toEarth[1]!, node[2]! * toEarth[0]! - node[0]! * toEarth[2]!, node[0]! * toEarth[1]! - node[1]! * toEarth[0]!];
  return { rightAscensionDegrees: (Math.atan2(pole[1]!, pole[0]!) * 180 / Math.PI + 360) % 360, declinationDegrees: Math.asin(Math.max(-1, Math.min(1, pole[2]!))) * 180 / Math.PI,
    displayMeridianDegrees: Math.atan2(dot(pole, cross), dot(node, toEarth)) * 180 / Math.PI };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const millionKelvin = (kelvin: number) => `${(kelvin / 1e6).toFixed(2).replace(/0$/u, '')} million K`;

/** Every file of the package and its shared records. Pure apart from the publication lookups; the caller writes. */
export async function generatePulsar(spec: PulsarSpec, { archive = liveArchive, order, epochJdTt, nsxTable, posteriorText }: { archive?: Archive; order: number; epochJdTt: number; nsxTable?: NsxTable; posteriorText?: string }) {
  const id = spec.id, o = `src/objects/${id}`, s = `${o}/source`, body = pulsarRecord(spec, order);
  const parsed = parsePublishedHotRegions(spec.hotRegions.record);
  // The posterior: every k-th row of the deposit's equal-weight samples, with only the columns the record's regions read.
  const thinned = spec.posterior && parsed.posterior ? await (async () => {
    const rows = (posteriorText ?? await readFile(spec.posterior!.samples, 'utf8')).split('\n').filter(line => line.trim()), names = spec.posterior!.parameters;
    const used = [...new Set(JSON.stringify(parsed.posterior!.columns).match(/"column":"[^"]+"/gu)?.map(match => match.slice(10, -1)) ?? [])], indices = used.map(name => names.indexOf(name));
    if (indices.some(index => index < 0)) throw new TypeError(`${id}: posterior.parameters lacks ${used.filter((_, i) => indices[i]! < 0).join(', ')}.`);
    const step = Math.max(1, Math.floor(rows.length / spec.posterior!.keep)), kept = rows.filter((_, index) => index % step === 0).map(row => { const cells = row.trim().split(/\s+/u);
      if (cells.length < names.length) throw new TypeError(`${id}: a posterior row has ${cells.length} columns, fewer than the ${names.length} named.`);
      return indices.map(index => Number(cells[index]).toPrecision(7)).join('\t'); });
    const tsv = `${[used.join('\t'), ...kept].join('\n')}\n`;
    return { tsv, rows: rows.length, step, samples: parseHotRegionSamples(parsed, tsv) };
  })() : null;
  const map = publishedHotRegionMap(parsed, thinned?.samples), regions = map.report.regions, bulk = map.report.bulk;
  const urls = [...new Set([...bulk ? [bulk.url] : [], spec.paper.url, spec.position.url, spec.distance.url, spec.radialVelocity.url, spec.radius.url, spec.mass.url, spec.spin.url, spec.hotRegions.url])];
  const publications = new Map<string, Publication>();
  for (const link of urls) { const publication = await fetchPublication(archive, link); if (!publication) throw new TypeError(`${id}: no publication record was read for ${link}; cite the paper by arXiv, DOI or ADS link.`); publications.set(link, publication); }
  const source = (cited: { readonly url: string; readonly source: string }) => ({ catalogueId: publications.get(cited.url)!.id, url: cited.url, label: cited.source, checked: CHECKED });

  const files: PackageFiles = new Map(scaffoldStarFiles({ id, name: spec.name, system: spec.system, description: spec.description, paper: spec.paper.url, paperCredit: spec.paper.credit, order, neutronStar: true, ...(spec.aliases ? { aliases: spec.aliases } : {}) }, body, epochJdTt));
  const read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  files.set(`packages/astronomy/data/bodies/${id}.json`, `${JSON.stringify(body, null, 1)}\n`);
  files.set(`${s}/${spec.hotRegions.path}`, json(spec.hotRegions.record));
  if (thinned) files.set(`${s}/${parsed.posterior!.path}`, thinned.tsv);

  // The map: its range is the drawn temperatures rounded out to 100,000 K.
  const kelvins = regions.flatMap(region => [region.superseding.kelvin, ...region.ceding ? [region.ceding.kelvin] : []]), hottest = Math.max(...kelvins), coolest = Math.min(...kelvins);
  // The drawn range: the best sample's temperatures, or with a posterior the map's own extremes on a one-degree grid.
  let drawnHigh = hottest;
  if (thinned) { drawnHigh = 0; for (let latitude = -89.5; latitude < 90; latitude++) for (let longitude = -179.5; longitude < 180; longitude++) drawnHigh = Math.max(drawnHigh, map.sample(longitude, latitude)!); }
  const minimum = Math.floor((bulk?.kelvin ?? coolest) / 1e5) * 1e5, maximum = Math.ceil(drawnHigh / 1e5) * 1e5, labels = [minimum, (minimum + maximum) / 2, maximum].map(value => String(Number((value / 1e6).toFixed(2))));
  const share = regions.reduce((sum, region) => sum + region.superseding.sphereShare, 0), dataset = 'temperature', consumer = `${dataset}-hot-region-map`, input = `${id}-${dataset}-hot-regions`;
  const drawnWords = thinned ? `the mean over ${thinned.samples.length.toLocaleString('en-US')} of the fit's ${thinned.rows.toLocaleString('en-US')} posterior samples (every ${ordinal(thinned.step)}), so an edge is sharp where the samples agree and graded where they differ` : "the fit's single best sample";
  const angularDiameterMas = 2 * spec.radius.value / (spec.distance.value * PARSEC_KM) / MAS_RAD;

  // The limb: the bolometric profile of the atmosphere table at the star's gravity, fitted at the temperature most of the disc is at.
  const table = nsxTable ?? await readNsxTable(spec.limb.nsxTable), log10Gravity = neutronStarLog10Gravity(spec.mass.value, spec.radius.value);
  const largest = regions.reduce((a, b) => b.superseding.sphereShare > a.superseding.sphereShare ? b : a), discKelvin = bulk?.kelvin ?? largest.superseding.kelvin;
  const lawAt = (kelvin: number) => { const profile = nsxLimbProfile(table, Math.log10(kelvin), log10Gravity); return { kelvin, profile, ...fitQuadraticLimb(profile) }; };
  const limb = lawAt(discKelvin), others = [...new Set(kelvins)].filter(kelvin => kelvin !== discKelvin).map(lawAt);
  checkLimbLaw({ u1: limb.u1, u2: limb.u2 });
  const round = (value: number, digits: number) => Number(value.toFixed(digits)), fitted = `least-squares fit to the table's ${limb.profile.mu.filter(mu => mu >= 0.05).length} emission cosines of 0.05 and above; largest miss ${limb.largestMiss.toFixed(3)} of the centre intensity`;
  const limbSentence = `dimmed toward the limb by the quadratic law (u1 ${limb.u1.toFixed(3)}, u2 ${limb.u2.toFixed(3)}) fitted to the bolometric intensity of the ${NSX.credit}, at log g ${log10Gravity.toFixed(2)} and ${Math.round(discKelvin).toLocaleString('en-US')} K`;
  files.set(`${s}/${NSX.path}`, json({ schema: 'cssearth-published-limb-darkening@1', objectId: id, source: `${NSX.credit} (${NSX.url})`,
    band: "Bolometric: the table's specific intensity integrated over photon energy", law: 'I(mu)/I(1) = 1 - u1 (1 - mu) - u2 (1 - mu)^2', basis: 'model-prior',
    u1: { value: round(limb.u1, 4), fixed: fitted }, u2: { value: round(limb.u2, 4), fixed: fitted },
    computed: { log10Gravity: round(log10Gravity, 4), gravity: 'GM/R^2 (1 - 2GM/Rc^2)^(-1/2) from the cited mass and radius, in cgs', temperatureK: Math.round(discKelvin),
      profile: limb.profile.mu.map((mu, index) => ({ mu, intensity: round(limb.profile.intensity[index]!, 5) })),
      otherTemperatures: others.map(other => ({ temperatureK: Math.round(other.kelvin), u1: round(other.u1, 4), u2: round(other.u2, 4) })) },
    note: `One law is drawn over the whole disc, at the temperature most of it is at. ${bulk ? 'The table is the fully ionized atmosphere the hot-region fit uses; the paper that measures the cooler surface models it with a partially ionized one, which this table does not hold. ' : ''}The hot regions' own laws are in otherTemperatures.` }));

  files.set(`${s}/measurements.json`, json({ schema: 'cssearth-neutron-star@1', id,
    radiusKm: spec.radius.value, radiusSource: `${spec.radius.source} (${spec.radius.url}): ${spec.radius.value}${spec.radius.uncertainty ? ` +/- ${spec.radius.uncertainty}` : ''} km, inferred from the pulse shape.`,
    massSolar: spec.mass.value, massSource: `${spec.mass.source} (${spec.mass.url})`,
    distanceParsecs: spec.distance.value, distanceSource: String(body.star.sources.distance),
    spinFrequencyHz: spec.spin.frequencyHz, spinInclinationDegrees: spec.spin.inclinationDegrees, spinSource: `${spec.spin.source} (${spec.spin.url})`,
    angularDiameterMas: Number(angularDiameterMas.toPrecision(3)), angularDiameterSource: `Computed here from the radius and distance: 2 x ${spec.radius.value} km at ${spec.distance.value} pc. No telescope resolves it.`,
    shape: { kind: 'sphere', qualification: 'A sphere at the radius the pulse-profile fit infers. The star spins fast enough to be slightly flattened, and gravity bends its light so that more than half the surface is visible at once; neither is drawn.' } }));

  const raster = read(`${s}/preparation/raster.json`);
  raster.surfaces = [{ id: dataset, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: spec.hotRegions.path, falseColor: true,
    science: { kind: 'terrestrial-scientific', id: dataset, label: spec.hotRegions.label, format: 'published-hot-region-map', path: spec.hotRegions.path, consumer, sampling: 'bilinear', displaySampling: 'bilinear',
      outputLongitudeOrigin: 0, units: 'K', minimum, maximum, colors: PLASMA, labels,
      limbDarkening: { law: 'quadratic', published: true, path: NSX.path },
      description: `Effective temperature of the hot regions in ${spec.hotRegions.credit}'s fit to ${spec.hotRegions.observed}. ${bulk ? `The rest of the surface is at the ${Math.round(bulk.kelvin).toLocaleString('en-US')} K of ${bulk.source}.` : 'The rest of the surface has no value in the fit.'}`, title: `${spec.hotRegions.label} · published hot-region fit`, sourceUrl: spec.hotRegions.url } }];
  raster.emission.metadata.limbMaterial.composition = 'black alpha darkens the surface according to the limb-darkening law; transparent outside the silhouette';
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`);
  descriptor.properties.recipe.surfaces[0].datasets = [{ id: dataset, source: 'content', material: 'emission' }];
  descriptor.properties.catalog.color = NEUTRAL_CATALOGUE_COLOR;
  files.set(`${o}/object.json`, json(descriptor));
  const geometry = read(`${s}/preparation/geometry.json`);
  geometry.surface.surface.url = `/scenes/${id}/${id}-surface-${dataset}@2x.webp`; geometry.surface.poles.url = `/scenes/${id}/${id}-poles-${dataset}@2x.webp`;
  Object.assign(geometry.output.body, { sourceProjection: `the hot-region dataset: the published regions on the reference sphere, the rest ${bulk ? 'at its published temperature' : 'marked as no data'}`, polarPreparation: 'the same map on the polar tiles',
    axialTiltNote: "the rotation record tilts the north pole by the published inclination; the axis's position angle on the sky is a convention, and this profile's tilt is not used for the frame" });
  files.set(`${s}/preparation/geometry.json`, json(geometry));
  const navigation = read(`${s}/preparation/navigation.json`);
  // The marker author draws the map as a disc already: no mask or shading is added to it.
  navigation.operations = navigation.operations.filter((operation: { type: string }) => operation.type === 'resize' || operation.type === 'png');
  files.set(`${s}/preparation/navigation.json`, json(navigation));

  const orientation = tiltedOrientation(spec.position.rightAscensionDegrees, spec.position.declinationDegrees, spec.spin.inclinationDegrees);
  files.set(`${s}/preparation/rotation.json`, json({ schema: 'cssearth-display-orientation@1', ...orientation, phase: 'arbitrary-display-phase',
    source: `North rotation pole ${spec.spin.inclinationDegrees} degrees from the line of sight toward Earth: ${spec.spin.source} (${spec.spin.url}). The direction of the axis on the sky is not used from any measurement; it is tilted toward celestial north as a convention: sin(i) x sky-north + cos(i) x (direction to Earth), RA ${orientation.rightAscensionDegrees.toFixed(4)}, Dec ${orientation.declinationDegrees >= 0 ? '+' : ''}${orientation.declinationDegrees.toFixed(4)}. Longitude 0 is the meridian that faces Earth, the fit's phase zero.`,
    coordinateSystem: 'ICRF/J2000. +Z is the north rotation pole above; +X is the display meridian, set so that longitude 0 faces the Sun and Earth at the scene epoch; east longitude. No spin is propagated.',
    qualification: `The tilt of the axis is published; its position angle on the sky is a display convention. ${spec.name} turns ${spec.spin.frequencyHz.toFixed(1)} times a second, so the star is drawn at one instant: the fit's phase zero.` }));

  const palette = PLASMA.map(hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)));
  const content = read(`${s}/content/object.json`);
  content.panel.facts = [
    { id: 'radius', label: 'Radius', value: `${spec.radius.value} km`, source: { ...source(spec.radius), path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
    { id: 'mass', label: 'Mass', value: `${spec.mass.value} solar masses`, source: { ...source(spec.mass), path: 'source/measurements.json', locator: 'massSolar; massSource' } },
    { id: 'rotation', label: 'Spin', value: `${Math.round(spec.spin.frequencyHz)} turns a second`, source: { ...source(spec.spin), path: 'source/measurements.json', locator: 'spinFrequencyHz; spinSource' } },
    { id: 'distance', label: 'Distance from the Sun', value: `${Math.round(spec.distance.value).toLocaleString('en-US')} parsecs`, source: { ...source(spec.distance), path: 'source/measurements.json', locator: 'distanceParsecs; distanceSource' } }];
  content.datasets = { titleKey: 'datasets', defaultDataset: dataset, controls: [{ id: dataset, label: spec.hotRegions.label, qualification: `Published fit · ${spec.hotRegions.credit} · ${spec.hotRegions.observed}`,
    thumbnail: `${id}-dataset-${dataset}.webp`, surface: `${id}-surface-${dataset}@2x.webp`, poles: `${id}-poles-${dataset}@2x.webp`, source: { id: input, path: '../manifest.json', url: spec.hotRegions.url }, falseColor: true,
    legend: { kind: 'scale', title: bulk ? 'Surface temperature' : 'Hot-region temperature', labels, recipe: { palette, labels }, meta: 'million K', sourceUrl: spec.hotRegions.url },
    notes: `The hot regions of ${spec.name} in ${spec.hotRegions.credit}'s fit to ${spec.hotRegions.observed}: ${regions.length} regions built from circles, ${millionKelvin(coolest)} to ${millionKelvin(hottest)}, covering ${(100 * share).toFixed(1)}% of the surface. The map draws ${drawnWords}. They are the shapes the fit allows, not an image. ${bulk ? `The rest of the surface is drawn at ${Math.round(bulk.kelvin).toLocaleString('en-US')} K, the temperature ${bulk.source} for the surface outside the hot regions.` : 'The gray grid is surface the fit gives no temperature.'} The disc is ${limbSentence}. The false color runs from ${labels[0]} to ${labels[2]} million K.` }] };
  content.provenance.physical.credit = `${spec.radius.source} radius; ${spec.position.source} position, motion and distance; published spin tilt, axis direction a display convention`;
  files.set(`${s}/content/object.json`, json(content));

  const paper = publications.get(spec.paper.url)!, text = read(`${o}/text.json`);
  text.card.text = spec.text.card; text.introduction.text = spec.text.introduction;
  for (const key of ['card', 'introduction'] as const) text[key].sources = [{ catalogueId: paper.id, url: spec.paper.url, label: spec.paper.credit, checked: CHECKED, locator: spec.text.locator }];
  text.datasets = { [dataset]: { title: `${spec.hotRegions.label} hot regions`, detail: 'Published fit', summary: bulk ? 'Hot patches from a fit to the X-ray pulse, on a cooler surface measured in ultraviolet light. Fitted shapes, not an image.' : 'Hot patches a fit to the X-ray pulse places on the surface. They are fitted shapes, not an image.' } };
  files.set(`${o}/text.json`, json(text));

  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...manifest.inputs, { id: input, path: spec.hotRegions.path, origin: spec.hotRegions.url, credit: `${spec.hotRegions.credit}; ${spec.hotRegions.observed}`, license: 'Factual numerical measurements; source attribution retained',
    acquisition: 'Transcribed from the paper, table cell by table cell, with each cell\'s location', redistribution: 'Factual parameter transcription only; no paper figures', consumers: [consumer] },
    { id: `${id}-nsx-limb-darkening`, path: NSX.path, origin: NSX.url, credit: NSX.credit, license: 'Project-computed model values; the table is distributed under CC BY 4.0 with X-PSI\'s tutorial files',
      acquisition: `Computed by packages/telescope-cli/src/new-object/pulsar.mts from nsx_H_v200804.out (${NSX.url}): nsxLimbProfile and fitQuadraticLimb in @cssearth/bake/objects/stellar.`,
      redistribution: 'Model coefficients and the profile they are fitted to, with the model cited.', consumers: [consumer],
      sourceBinding: { kind: 'local', reason: 'Computed from the cited table; generating the package again recomputes it.' } },
    ...thinned ? [{ id: `${id}-hot-region-posterior`, path: parsed.posterior!.path, origin: spec.posterior!.url, credit: spec.posterior!.credit, license: 'Creative Commons Attribution 4.0 International',
      acquisition: `Every ${ordinal(thinned.step)} of the ${thinned.rows.toLocaleString('en-US')} equal-weight posterior samples of the deposit (${spec.posterior!.samples.split('/').at(-1)}), the columns the hot regions read, to seven significant figures; written by packages/telescope-cli/src/new-object/pulsar.mts.`,
      redistribution: 'A thinned copy of deposited posterior samples, with the deposit cited.', consumers: [consumer],
      sourceBinding: { kind: 'local', reason: 'Thinned from the cited deposit; generating the package again from the deposit rewrites it.' } }] : []];
  manifest.documents = [...manifest.documents, storedSpecDocument];
  files.set(`${s}/manifest.json`, json(manifest));
  // The table's place on the machine that generated the package is not part of the spec: only its file name is kept.
  files.set(`${o}/${STORED_SPEC}`, json({ ...spec, limb: { nsxTable: spec.limb.nsxTable.split('/').at(-1) }, ...(spec.posterior ? { posterior: { ...spec.posterior, samples: spec.posterior.samples.split('/').at(-1) } } : {}), order }));
  bindInputs(files, id);
  datasetMarkerEntry(files, id);

  files.set(`${o}/NOTICE.md`, [`# ${spec.name} credits`, `Limb darkening: ${NSX.credit}, ${NSX.url}.`, `Hot regions and radius: ${spec.hotRegions.credit}, ${spec.hotRegions.url}; ${spec.hotRegions.observed}.`,
    ...bulk ? [`Temperature of the surface outside the hot regions: ${bulk.source}, ${bulk.url}.`] : [],
    `Position, proper motion, distance, mass, spin and inclination: ${spec.position.source}, ${spec.position.url}.`, ''].join('\n\n'));
  const where = (region: typeof regions[number]) => { const c = region.superseding; return `${Math.abs(c.latitudeDegrees).toFixed(1)}° ${c.latitudeDegrees >= 0 ? 'north' : 'south'}, ${Math.abs(c.eastLongitudeDegrees).toFixed(1)}° ${c.eastLongitudeDegrees >= 0 ? 'east' : 'west'}`; };
  files.set(`${o}/README.md`, [`# ${spec.name}`, '', '## Sources', '', `${spec.text.introduction} No telescope resolves it: at ${Math.round(spec.distance.value)} parsecs its disc is ${angularDiameterMas.toExponential(1)} milliarcseconds across. Every value here is cited, and the map is a published fit.`, '',
    `**Star.** Position, proper motion and distance (${spec.distance.value}${spec.distance.uncertainty ? ` ± ${spec.distance.uncertainty}` : ''} pc): ${spec.position.source}. Mass ${spec.mass.value}${spec.mass.uncertainty ? ` ± ${spec.mass.uncertainty}` : ''} solar masses: ${spec.mass.source}. Radius ${spec.radius.value}${spec.radius.uncertainty ? ` ± ${spec.radius.uncertainty}` : ''} km: ${spec.radius.source}. Radial velocity ${spec.radialVelocity.value} km/s: ${spec.radialVelocity.source}.`, '',
    `**Hot regions.** [${spec.hotRegions.path}](source/${spec.hotRegions.path}) transcribes ${spec.hotRegions.credit}'s fit to ${spec.hotRegions.observed}, one table cell per number. The \`published-hot-region-map\` format ([hot-region-map.ts](../../../packages/bake/src/objects/raster/hot-region-map.ts)) draws the circles as the paper's own software defines them and refits nothing.`,
    ...bulk ? [`- The rest of the surface: ${Math.round(bulk.kelvin).toLocaleString('en-US')} K, ${bulk.source} (${bulk.url}). It is another paper's measurement, placed here under the first paper's regions.`] : [],
    ...regions.map(region => `- \`${region.id}\`: centred ${where(region)}, radius ${region.superseding.radiusDegrees.toFixed(1)}°, ${millionKelvin(region.superseding.kelvin)}${region.omitRadiusDegrees === undefined ? '' : `, with a middle of radius ${region.omitRadiusDegrees.toFixed(1)}° that does not emit (a ring)`}${region.ceding ? `, inside a circle of radius ${region.ceding.radiusDegrees.toFixed(1)}° at ${millionKelvin(region.ceding.kelvin)}` : ''}.`), '',
    `**Limb.** The disc is ${limbSentence} ([${NSX.path}](source/${NSX.path}) keeps the profile; ${fitted}). The hot regions' own laws differ little: ${others.map(other => `u1 ${other.u1.toFixed(3)}, u2 ${other.u2.toFixed(3)} at ${millionKelvin(other.kelvin)}`).join('; ')}.`, '',
    ...thinned ? [`**Posterior.** The map draws ${drawnWords}. [${parsed.posterior!.path}](source/${parsed.posterior!.path}) keeps those samples: ${spec.posterior!.credit} (${spec.posterior!.url}). The regions listed above are the single best sample, which the paper's figure draws; the average differs from it wherever the posterior is wide.`, ''] : [],
    `**Spin.** ${spec.spin.frequencyHz} turns a second; the north pole is ${spec.spin.inclinationDegrees}° from the line of sight (${spec.spin.source}). Longitude 0 is the meridian facing Earth at the fit's phase zero. The star is drawn at that instant and does not turn.`, '',
    '## Evidence', '', `Generated ${CHECKED} by [pulsar.mts](../../../packages/telescope-cli/src/new-object/pulsar.mts) from the spec kept in [new-object.json](${STORED_SPEC}).`, '',
    '- [hot-region-map.test.mts](../../../packages/bake/src/objects/raster/hot-region-map.test.mts) reads the record and checks it against what the paper says of its own fit.', '',
    '## Known problems', '', `- **A fit, not an image.** The regions are the shapes the model allows: circles, rings and overlapping circles, each at one temperature.${thinned ? ' The soft edges are the spread of the posterior, not a temperature gradient the fit resolves.' : " Their sharp edges are the model's."}`,
    bulk ? '- **Two papers in one map.** The hot regions and the temperature of the rest of the surface come from different fits to different telescopes; no single fit made this map. The rest of the surface is drawn uniform.' : '- **No temperature elsewhere.** The fit gives the rest of the surface no temperature; it is drawn as the gray no-data grid, not as cold.',
    '- **Assumptions of the frame.** The axis\'s position angle on the sky is a convention. The bending of light by the star\'s gravity and its rotational flattening are not drawn.',
    `- **Model limb.** The limb darkening is a model atmosphere's, at one temperature for the whole disc, not a measurement of this star.${bulk ? ' The table is the fully ionized atmosphere of the hot-region fit, applied here to the cooler surface too.' : ''}`,
    ...spec.notes.map(note => `- **Not shown.** ${note.replace(/\.$/u, '')}.`), '',
    '[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)', ''].join('\n'));

  const { publicationRecord } = await import('./generate.mts');
  for (const publication of publications.values()) files.set(`src/sources/${publication.id}.json`, json(publicationRecord(publication)));
  writeLedger(files, id, [
    { id: 'placement', subject: 'Placement', evidence: [spec.position.url, spec.distance.url, spec.radialVelocity.url], finding: `${String(body.star.sources.position)} Distance: ${String(body.star.sources.distance)} Radial velocity: ${String(body.star.sources.radialVelocity)}` },
    { id: 'radius-and-mass', subject: 'Radius and mass', evidence: [spec.radius.url, spec.mass.url], finding: `Radius ${spec.radius.value} km from ${spec.radius.source}. Mass ${spec.mass.value} solar masses from ${spec.mass.source}.` },
    { id: 'hot-regions', subject: 'Hot regions', evidence: [spec.hotRegions.url, ...bulk ? [bulk.url] : [], ...thinned ? [spec.posterior!.url] : []], finding: `${spec.hotRegions.credit}'s fit to ${spec.hotRegions.observed}, transcribed as ${spec.hotRegions.path} and drawn without refitting as ${drawnWords}: ${regions.length} regions, ${millionKelvin(coolest)} to ${millionKelvin(hottest)}.${bulk ? ` The surface outside them is at ${Math.round(bulk.kelvin).toLocaleString('en-US')} K: ${bulk.source} (${bulk.url}).` : ''}` },
    { id: 'limb-darkening', subject: 'Limb darkening', evidence: [NSX.url], finding: `The disc is ${limbSentence}; ${fitted}.` },
    { id: 'spin', subject: 'Spin', evidence: [spec.spin.url], finding: `${spec.spin.frequencyHz} turns a second, north pole ${spec.spin.inclinationDegrees} degrees from the line of sight, from ${spec.spin.source}; the axis's direction on the sky is a convention.` }]);
  return { id, files, regions: regions.length, minimum, maximum };
}
