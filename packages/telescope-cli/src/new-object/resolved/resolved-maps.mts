/** A star's surface resolved by an interferometer over several nights, as datasets of the star's page: the map kind of
 * maps/surface-maps.mts for the reconstructions `archives/interferometry/surface-star.mts` makes with ROTIR.
 *
 * A map is drawn only when its reduction passed the three checks there. Every sentence says it is this project's
 * reduction of the authors' calibrated nights with their code and settings, not their published map, and gives the fit's
 * own numbers. The star's tilt, the direction of its pole on the sky and its period are the paper's, cited in the season;
 * a page that draws its axis by convention takes them. Nothing here names a star: the season says whose nights they are. */
import { inclinedPoleOrientation } from '@cssearth/bake/objects/stellar';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { DISPLAY_ORIENTATION_SCHEMA, INVESTIGATION_LEDGER_SCHEMA } from '@cssearth/objects';
import { RECONSTRUCTION_CHI2_LIMIT, REPRODUCIBILITY_CORRELATION, SPOT_CONTRAST_RATIO } from '../../archives/interferometry/spotless-disc.mts';
import { BRIGHTNESS_VARIABLE, FACING_VARIABLE, SURFACE_MAP_SCHEMA, type SeasonData, type SeasonPaper } from '../../archives/interferometry/surface-star.mts';
import { LIMB_STRENGTH, tinted } from '../brightness/brightness-maps.mts';
import { scaleEnd, type MapKind, type SurfaceMap, type SurfaceMapChoice } from '../maps/surface-maps.mts';

type Json = Record<string, unknown>;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
export const RESOLVED_GENERATOR = 'packages/telescope-cli/src/archives/interferometry/surface-star.mts', RESOLVED_CONSUMER = 'rotir-surface', RESOLVED_DIRECTORY = 'science/interferometry';
const ROTIR_RECORD = 'rotir-jl', ROTIR_URL = 'https://github.com/fabienbaron/ROTIR.jl';
const COLORS = ['#1a1a1a', '#5c5c5c', '#9c9c9c', '#d6d6d6', '#ffffff'] as const, PALETTE = [[26, 26, 26], [92, 92, 92], [156, 156, 156], [214, 214, 214], [255, 255, 255]] as const;

export interface ResolvedNight { readonly night: string; readonly vis2: number; readonly closurePhases: number; readonly subObserverLongitude: number }
export interface ResolvedSurfaceMap extends SurfaceMap {
  readonly season: string; readonly instrument: string; readonly band: string; readonly papers: readonly SeasonPaper[]; readonly data: SeasonData;
  readonly diameterMas: number; readonly diameterSource: string; readonly limbPowerLaw: number; readonly positionAngleDegrees: number; readonly positionAngleSource: string;
  readonly nights: readonly ResolvedNight[]; readonly referenceNight: string; readonly beamMas: number; readonly vis2: number; readonly closurePhases: number;
  readonly fit: { readonly vis2: number; readonly closurePhase: number; readonly spotlessVis2: number; readonly spotlessClosurePhase: number };
  /** The deciding twin's ratio and size, the twins that did not fit on the sphere, and the halves' correlation. */
  readonly spotRatio: number; readonly spotScale: number; readonly unfitTwins: readonly { readonly scale: number; readonly closurePhase: number }[]; readonly halves: number;
  readonly darkestPercent: number; readonly brightestPercent: number; readonly recipe: string; readonly codes: readonly string[];
}

/** What a season's receipt says of its map, read once and checked. A reduction that did not pass its checks is no map. */
export function reducedSurface(choice: SurfaceMapChoice, receipt: unknown, table: string): ResolvedSurfaceMap {
  const record = requireRecord(receipt, `${choice.program} receipt`);
  if (record.schema !== SURFACE_MAP_SCHEMA || record.season !== choice.program) throw new TypeError(`${choice.program}: its receipt is not this season's surface map.`);
  const verdict = requireRecord(record.verdict, 'verdict');
  if (verdict.cast !== true) throw new Error(`${choice.program} is not cast: ${requireArray(verdict.reasons, 'reasons').join('; ')}.`);
  const star = requireRecord(record.star, 'star'), cited = (name: string) => { const one = requireRecord(star[name], name); return { value: requireFiniteNumber(one.value, name), source: requireString(one.source, `${name} source`) }; };
  const fit = requireRecord(record.fit, 'fit'), spots = requireRecord(record.spots, 'spots'), about = requireRecord(record.table, 'table'), recipe = requireRecord(record.recipe, 'recipe'), codes = requireRecord(record.codes, 'codes');
  const nights = requireArray(record.nights, 'nights').map((entry): ResolvedNight => { const night = requireRecord(entry, 'night'); return { night: requireString(night.night, 'night'), vis2: requireFiniteNumber(night.vis2, 'vis2'), closurePhases: requireFiniteNumber(night.closurePhases, 'closurePhases'), subObserverLongitude: requireFiniteNumber(night.subObserverLongitude, 'subObserverLongitude') }; });
  const points = requireRecord(record.points, 'points');
  if (!table.includes(`"${BRIGHTNESS_VARIABLE}"`) || !table.includes(`"${FACING_VARIABLE}"`) || !table.includes('ZONE I=')) throw new TypeError(`${choice.program}: the table is not a surface map of ${RESOLVED_GENERATOR}.`);
  return { choice, table, targetName: requireString(record.target, 'target'), season: choice.program, instrument: requireString(record.instrument, 'instrument'), band: requireString(record.band, 'band'),
    papers: requireArray(record.papers, 'papers') as SeasonPaper[], data: requireRecord(record.data, 'data') as unknown as SeasonData,
    inclinationDegrees: cited('inclinationDegrees').value, inclinationSource: cited('inclinationDegrees').source, periodDays: cited('rotationPeriodDays').value, periodSource: cited('rotationPeriodDays').source,
    diameterMas: cited('diameterMas').value, diameterSource: cited('diameterMas').source, limbPowerLaw: cited('limbPowerLaw').value, positionAngleDegrees: cited('positionAngleDegrees').value, positionAngleSource: cited('positionAngleDegrees').source,
    nights, referenceNight: requireString(record.referenceNight, 'referenceNight'), beamMas: requireFiniteNumber(record.beamMas, 'beamMas'), vis2: requireFiniteNumber(points.vis2, 'vis2'), closurePhases: requireFiniteNumber(points.closurePhases, 'closurePhases'),
    fit: { vis2: requireFiniteNumber(fit.vis2, 'fit vis2'), closurePhase: requireFiniteNumber(fit.closurePhase, 'fit closure phase'), spotlessVis2: requireFiniteNumber(fit.spotlessVis2, 'spotless vis2'), spotlessClosurePhase: requireFiniteNumber(fit.spotlessClosurePhase, 'spotless closure phase') },
    spotRatio: requireFiniteNumber(spots.ratio, 'spot ratio'), spotScale: requireFiniteNumber(spots.scale, 'spot scale'),
    unfitTwins: requireArray(spots.twins, 'twins').map(entry => requireRecord(entry, 'twin')).filter(twin => twin.fits === false).map(twin => ({ scale: requireFiniteNumber(twin.scale, 'twin scale'), closurePhase: requireFiniteNumber(requireRecord(twin.chi2, 'twin chi2').closurePhase, 'twin closure phase') })),
    halves: requireFiniteNumber(requireRecord(record.halves, 'halves').correlation, 'halves'), darkestPercent: requireFiniteNumber(about.minimumPercent, 'minimumPercent'), brightestPercent: requireFiniteNumber(about.maximumPercent, 'maximumPercent'),
    recipe: `HEALPix level ${requireFiniteNumber(recipe.level, 'level')}, ${requireString(recipe.regularizer, 'regularizer')} at weight ${requireFiniteNumber(recipe.weight, 'weight')}, ${requireFiniteNumber(recipe.iterations, 'iterations')} iterations`,
    codes: [`ROTIR.jl ${requireString(codes.rotir, 'rotir').slice(0, 8)}`, `OITOOLS.jl ${requireString(codes.oitools, 'oitools').slice(0, 8)}`] };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const day = (night: string) => `${Number(night.slice(8, 10))} ${MONTHS[Number(night.slice(5, 7)) - 1]!} ${night.slice(0, 4)}`;
/** "2 to 24 September 2011" for nights of one month, else both days in full. */
export const span = (nights: readonly { readonly night: string }[]) => { const first = nights[0]!.night, last = nights.at(-1)!.night;
  return first.slice(0, 7) === last.slice(0, 7) ? `${Number(first.slice(8, 10))} to ${day(last)}` : `${day(first)} to ${day(last)}`; };
const fixed = (value: number) => value.toFixed(2);
/** A cited value's paper, without the cell after it: "Author (2021), Table 4 (url): value" gives the part before the last colon. */
const paperOf = (source: string) => source.replace(/: [^:]*$/u, '');
const cite = (map: ResolvedSurfaceMap) => map.papers.map(paper => paper.citation).join('; ');
/** The degrees of longitude that faced the Earth on no night: the nights' sub-Earth meridians span a range, and a hemisphere is seen from each. */
export const unseenDegrees = (map: Pick<ResolvedSurfaceMap, 'nights'>) => { const at = map.nights.map(night => night.subObserverLongitude); return Math.max(0, 180 - (Math.max(...at) - Math.min(...at))); };
/** The smallest detail the nights resolve, in degrees of the star's surface at the middle of its disc. */
const resolved = (map: ResolvedSurfaceMap) => Math.round(2 * Math.asin(Math.min(1, map.beamMas / map.diameterMas)) * 180 / Math.PI);
const scaleOf = (maps: readonly ResolvedSurfaceMap[]) => { const reach = scaleEnd(Math.max(...maps.flatMap(map => [100 - map.darkestPercent, map.brightestPercent - 100]))); return { minimum: 100 - reach, maximum: 100 + reach, labels: [`${100 - reach}%`, '100%', `${100 + reach}%`] }; };
const checks = (map: ResolvedSurfaceMap) => `The fit leaves a reduced chi-squared of ${fixed(map.fit.vis2)} on the squared visibilities and ${fixed(map.fit.closurePhase)} on the closure phases (limit ${RECONSTRUCTION_CHI2_LIMIT}), where a spotless star leaves ${fixed(map.fit.spotlessVis2)} and ${fixed(map.fit.spotlessClosurePhase)}; its spots are ${fixed(map.spotRatio)} times those the same fit draws on a spotless star of ${map.spotScale === 1 ? 'the same size' : `${fixed(map.spotScale * map.diameterMas)} mas`} (limit ${SPOT_CONTRAST_RATIO}); and two independent halves of the data give the same spots (correlation ${fixed(map.halves)}, limit ${REPRODUCIBILITY_CORRELATION})`;

/** What is a resolved surface map's own in the records surface-maps.mts writes. */
export const RESOLVED_MAPS: MapKind<ResolvedSurfaceMap> = {
  consumer: RESOLVED_CONSUMER, directory: RESOLVED_DIRECTORY, inputTag: 'interferometry-map', generator: RESOLVED_GENERATOR, stepGroup: 'surface', variable: BRIGHTNESS_VARIABLE, units: '%', controlLabel: 'Surface map', legendTitle: 'Surface brightness, infrared',
  archiveUrl: ROTIR_URL, archiveOf: map => map.data.url, references: [],
  referencesOf: map => [{ catalogueId: map.data.record, role: 'material', evidence: map.data.url }, ...map.papers.map(paper => ({ catalogueId: paper.record, role: 'method', evidence: `https://doi.org/${paper.doi}` })), { catalogueId: ROTIR_RECORD, role: 'method', evidence: ROTIR_URL }],
  colors: COLORS, palette: PALETTE, outlineZeroOf: FACING_VARIABLE, outlines: () => false,
  scale: scaleOf,
  words(map, { count }) { const { choice } = map, when = span(map.nights), unseen = Math.round(unseenDegrees(map)), detail = resolved(map);
    const edge = unseen > 0 ? ` The ${unseen}° of longitude that faced the Earth on none of the nights hold the mean, inside the black line.` : '';
    return { productId: `Surface map of ${map.targetName} from ${map.instrument}, ${when}`,
      inputTitle: `Surface map of ${map.targetName} from its ${map.instrument} visibilities of ${when}: infrared brightness on a longitude-latitude grid`,
      credit: `${map.data.credit}; the star's size, limb, axis and period from ${map.papers[0]!.citation}; map made in this project with ${map.codes.join(' and ')}`, displayCredit: `${map.instrument} · mapped here`,
      license: map.data.license, licenseEvidence: [map.data.url],
      acquisition: `Built by ${RESOLVED_GENERATOR} from the season ${map.season}: the ${map.nights.length} calibrated files at ${map.data.url}, fitted with the pinned ROTIR (${map.recipe}). Restored from the source cache; not tracked. The receipt with the fit and its checks is written again by that command under output/interferometry and is not kept in git.`,
      redistribution: 'A table of fitted values made in this project; the calibrated files themselves are not redistributed.',
      description: `Brightness of ${map.targetName}'s surface in the ${map.band}, fitted with ROTIR to the ${map.vis2.toLocaleString('en-US')} squared visibilities and ${map.closurePhases.toLocaleString('en-US')} closure phases ${map.instrument} measured on ${map.nights.length} nights, ${when}: one surface on a sphere ${map.diameterMas} mas across that turns once in ${map.periodDays} d, tilted ${map.inclinationDegrees}° from the line of sight with its pole ${map.positionAngleDegrees}° east of north (${paperOf(map.inclinationSource)}). ${checks(map)}. Percent of the mean of the surface seen. Longitude 0 is the meridian that faced the Earth on ${day(map.referenceNight)}. Nothing smaller than about ${detail}° of the surface is resolved.${edge} The same nights were imaged by their authors (${cite(map)}); this is a reduction made in this project with their code, not their published map.`,
      surfaceTitle: `${map.instrument} · surface map made here · ${choice.label}`, qualification: `Mapped in this project · ${map.instrument}, ${choice.label.toLowerCase()}`,
      notes: `Where ${map.targetName}'s surface was darker and brighter in infrared light on ${map.nights.length} nights, ${when}, worked out in this project from what the ${map.instrument} interferometer measured. The star turned by ${Math.round(180 - unseenDegrees(map))}° between the first night and the last, so one surface is fitted to all of them, with the size, tilt, pole direction and period ${map.papers[0]!.citation} measured. Both the longitudes and the latitudes of the dark regions are fixed by the data, down to about ${detail}° of the surface; nothing finer is.${edge} The colors are a scale of brightness in one infrared band, not the star's color or temperature.${count > 1 ? ` Step through the ${count} maps to see the spots change.` : ''} A reduction made in this project with the authors' code and calibrated nights, not their published map.`,
      legendNote: `Darker: dimmer than the mean of the surface seen; white: brighter.${unseen > 0 ? ' Black line: the edge of what never faced the Earth on these nights.' : ''}`,
      text: { title: `Surface map, ${choice.label}`, detail: `${choice.label}, mapped here`, summary: 'Darker and brighter regions of the star, worked out in this project from interferometry of several nights.' } }; },
  // The star in its own color over the map's scale: a darker tone of its hue where the infrared surface is dimmer.
  natural(map, star) { const when = span(map.nights), scale = scaleOf([map]), less = Number((100 * (1 - map.darkestPercent / map.brightestPercent)).toFixed(0)), unseen = Math.round(unseenDegrees(map));
    return { id: 'color-surface', label: 'Color + brightness', minimum: scale.minimum, maximum: scale.maximum, colors: tinted(star.colorHex), limbStrength: LIMB_STRENGTH,
      description: `The star's color (${star.colorHex}, its Color dataset) over the surface map this project made from ${map.instrument} interferometry of ${when}: the map's scale, ${scale.minimum}% to ${scale.maximum}% of the mean surface, runs from a darker, richer tone of the same hue to the color itself. The map is of infrared light (${map.band}), where the darkest region gives ${less}% less light than the brightest; how much darker the spots are in visible light is not measured, and no color change is drawn. Longitude 0 is the meridian that faced the Earth on ${day(map.referenceNight)}.${unseen > 0 ? ` The ${unseen}° of longitude that never faced the Earth on these nights hold the mean.` : ''} A reduction made in this project, not a published map.`,
      surfaceTitle: `${map.instrument} · the star in its color over its surface map · ${when}`, qualification: `The star's color, darker where ${map.instrument} saw its surface dimmer in the infrared · ${when}, mapped in this project`,
      notes: `${map.targetName} in its own color, darker where interferometry of ${when} shows its surface darker. The interferometer resolved the star's disc, so the places of the dark regions, in longitude and latitude, are measured, down to about ${resolved(map)}° of the surface. The map is of infrared light, where the darkest region gives ${less}% less light than the brightest; it is drawn as a much darker tone of the star's own hue, and the Surface map's scale has the measured values. How dark the spots are in visible light, and their color, are not measured. The star is drawn as it faced the Earth on ${day(map.referenceNight)}, at the tilt and pole direction ${map.papers[0]!.citation} measured.${unseen > 0 ? ` The ${unseen}° of longitude that faced the Earth on none of the nights are drawn at the mean.` : ''} Spots come and go within weeks or months: this is the star then. The darkening toward the edge is the Color dataset's limb law, drawn ${LIMB_STRENGTH} times as strong. A reduction made in this project with the authors' code and calibrated nights, not their published map.`,
      text: { title: `Color + brightness, ${MONTHS[Number(map.referenceNight.slice(5, 7)) - 1]!.slice(0, 3)} ${map.referenceNight.slice(0, 4)}`, detail: `${map.instrument}, ${map.choice.label}`, summary: 'The star in its own color, darker where interferometry resolved darker regions on its surface.' } }; },
  report(maps, scale) { const count = maps.length; return `${count} surface ${count === 1 ? 'map' : 'maps'} on one scale of ${scale.minimum}% to ${scale.maximum}% (${maps.map(map => `${map.choice.label}: ${map.nights.length} nights, chi-squared ${fixed(map.fit.vis2)} and ${fixed(map.fit.closurePhase)}, spots ${fixed(map.spotRatio)} times a spotless star's, halves ${fixed(map.halves)}`).join('; ')})`; },
};

/** The records of the source catalogue (`src/sources`) a star's surface maps are bound to: the calibrated nights, the papers
 * and the code. */
export function resolvedSourceRecords(checkedOn: string, maps: readonly Pick<ResolvedSurfaceMap, 'papers' | 'data'>[]): Map<string, string> {
  const records = new Map<string, string>();
  for (const map of maps) { const { data } = map;
    records.set(`src/sources/${data.record}.json`, json({ id: data.record, kind: 'data-product', identityLevel: 'work', title: data.title, identifiers: [], links: [{ role: 'archive', url: data.url, label: 'Files at the pinned commit' }],
      evidence: [{ url: data.url, checkedOn, locator: data.locator }], relations: [], statements: [{ kind: 'credit', text: data.credit, scope: 'citation', evidence: data.url }], publisher: data.publisher }));
    for (const paper of map.papers) { const url = `https://arxiv.org/abs/${paper.arxiv}`;
      records.set(`src/sources/${paper.record}.json`, json({ id: paper.record, kind: 'publication', identityLevel: 'work', title: paper.title, identifiers: [{ type: 'arXiv', value: paper.arxiv }, { type: 'DOI', value: paper.doi }],
        links: [{ role: 'archive', url, label: 'arXiv preprint' }, { role: 'landing', url: `https://doi.org/${paper.doi}`, label: 'Journal version' }], evidence: [{ url, checkedOn, locator: paper.locator }], relations: [],
        statements: [{ kind: 'credit', text: paper.title.split(':')[0]!, scope: 'citation', evidence: url }], creators: paper.creators, publicationDate: paper.year })); } }
  records.set(`src/sources/${ROTIR_RECORD}.json`, json({ id: ROTIR_RECORD, kind: 'software', identityLevel: 'work', title: 'ROTIR.jl: interferometric imaging and light curve inversion on rotating spheroids (F. Baron, A. O. Martinez)',
    identifiers: [], links: [{ role: 'archive', url: ROTIR_URL, label: 'Source repository' }], evidence: [{ url: ROTIR_URL, checkedOn, locator: 'Repository page: name, description and GPL-3.0 licence. The commit run is pinned in packages/telescope-cli/src/archives/interferometry/toolchains.json.' }], relations: [],
    statements: [{ kind: 'credit', text: 'ROTIR.jl (F. Baron and A. O. Martinez), GPL-3.0', scope: 'citation', evidence: ROTIR_URL }], creators: ['F. Baron', 'A. O. Martinez'] }));
  return records;
}

/** A star's rotation record with the axis its surface map is fitted with: the measured tilt and pole direction, and the
 * meridian that turns longitude 0 toward the Earth, where the map puts the face of its reference night. */
export function measuredAxisRotation(previous: Json, place: { readonly rightAscensionDegrees: number; readonly declinationDegrees: number }, map: Pick<ResolvedSurfaceMap, 'inclinationDegrees' | 'inclinationSource' | 'positionAngleDegrees' | 'positionAngleSource' | 'periodDays' | 'periodSource' | 'referenceNight'>): Json {
  const pole = inclinedPoleOrientation(place, map.inclinationDegrees, map.positionAngleDegrees), meridian = Number(((pole.displayMeridianDegrees % 360 + 360) % 360).toFixed(6));
  return { ...previous, schema: DISPLAY_ORIENTATION_SCHEMA, rightAscensionDegrees: pole.rightAscensionDegrees, declinationDegrees: pole.declinationDegrees, displayMeridianDegrees: meridian, phase: 'arbitrary-display-phase',
    source: `Measured axis: spin inclination ${map.inclinationDegrees} degrees from the line of sight (${map.inclinationSource}), pole position angle ${map.positionAngleDegrees} degrees east of north (${map.positionAngleSource}) and rotation period ${map.periodDays} d (${map.periodSource}): the values the star's surface map is fitted with, the pole tilted toward us; computed by inclinedPoleOrientation in packages/bake/src/objects/stellar/gravity-darkening.ts. Longitude 0 faces the Earth, where the map puts the meridian that faced it on ${map.referenceNight}.`,
    coordinateSystem: 'ICRF/J2000. +Z is the measured rotation pole, the one tilted toward the Earth. +X is the display meridian, set so that grid longitude 0 faces the Sun and Earth at the scene epoch; east longitude. No spin is propagated.',
    qualification: 'The tilt and the direction of the pole on the sky are measured by interferometry. The star is drawn as it faced the Earth on one night; the rotation is not animated.' }; }

const README_LEAD = '**Surface from interferometry.**', PROBLEM_LEAD = '- **Surface map.**', FRAME_LEAD = '- **Assumptions of the frame.**';
/** The star's README with the paragraph on its surface map before the evidence, and the map's known limits among the problems. */
export function withSurfaceReadme(readme: string, map: ResolvedSurfaceMap): string {
  const unseen = Math.round(unseenDegrees(map)), unfit = map.unfitTwins.length ? ` Spotless twins ${map.unfitTwins.map(twin => `${Math.round(Math.abs(twin.scale - 1) * 100)}% ${twin.scale < 1 ? 'smaller' : 'larger'}`).join(' and ')} do not fit on the sphere at all (closure phases ${map.unfitTwins.map(twin => fixed(twin.closurePhase)).join(' and ')}), so they do not decide the spots: a reading of this repository, stated in surface-star.mts.` : '';
  const paragraph = `${README_LEAD} The datasets Color + brightness and Surface map are one fit of the star's surface to the ${map.vis2.toLocaleString('en-US')} squared visibilities and ${map.closurePhases.toLocaleString('en-US')} closure phases ${map.instrument} measured on ${map.nights.length} nights, ${span(map.nights)} (${map.band}). The calibrated files are the authors', shipped with their code (${map.data.url}); the fit is ROTIR at the pinned commit (${map.recipe}, the settings of the authors' own script for these files), on a sphere of ${map.diameterMas} mas with a power-law limb of ${map.limbPowerLaw}, tilted ${map.inclinationDegrees}° with its pole ${map.positionAngleDegrees}° east of north and turning in ${map.periodDays} d (${paperOf(map.inclinationSource)}). ${checks(map)}.${unfit} The page's axis is that measured one, and longitude 0 is the meridian that faced the Earth on ${day(map.referenceNight)}. Run again with \`node ${RESOLVED_GENERATOR} packages/telescope-cli/src/archives/interferometry/seasons/${map.season} output/interferometry/${map.season}\`. ${cite(map)} imaged the same nights; their maps are not redistributed here.`;
  const problem = `${PROBLEM_LEAD} It is infrared brightness, drawn over the star's visible color as a darker tone: how dark the spots are in visible light is not measured. Nothing smaller than about ${resolved(map)}° of the surface is resolved${unseen > 0 ? `, and ${unseen}° of longitude never faced the Earth on these nights` : ''}. The map is of ${span(map.nights)}; spots change within months.`;
  const lines = readme.split('\n').filter(line => !line.startsWith(README_LEAD) && !line.startsWith(PROBLEM_LEAD) && !line.startsWith(FRAME_LEAD));
  const evidence = lines.indexOf('## Evidence'); if (evidence >= 0) lines.splice(evidence, 0, paragraph, ''); else lines.push('', paragraph);
  const problems = lines.indexOf('## Known problems');
  if (problems >= 0) lines.splice(problems + 2, 0, problem, `${FRAME_LEAD} The rotation phase is a convention: the star is drawn as it faced the Earth on one night and does not turn.`); else lines.push('', '## Known problems', '', problem);
  return lines.join('\n').replace(/\n{3,}/gu, '\n\n');
}

const NOTICE_LEAD = 'Surface map: ';
/** The star's credits with one line for its surface map: whose nights, whose values and whose code. */
export function withSurfaceNotice(notice: string, map: ResolvedSurfaceMap): string {
  const line = `${NOTICE_LEAD}${map.data.credit}; the star's size, limb, axis and period from ${map.papers[0]!.citation}; fitted in this project with ${map.codes.join(' and ')} (GPL-3.0 and LGPL-3.0, run as tools, not redistributed). ${map.data.url}`;
  return `${notice.split('\n').filter(one => !one.startsWith(NOTICE_LEAD)).join('\n').trimEnd()}\n\n${line}\n`.replace(/\n{3,}/gu, '\n\n');
}

/** The star's investigation ledger with the surface map's entry and the measured axis in place of the convention's. */
export function withSurfaceLedger(ledger: unknown, map: ResolvedSurfaceMap): Json {
  const record = requireRecord(ledger, 'investigation ledger'); if (record.schema !== INVESTIGATION_LEDGER_SCHEMA) throw new TypeError('Not an investigation ledger.');
  const id = `surface-${map.season}`, entries = requireArray(record.entries, 'entries').map(entry => requireRecord(entry, 'entry')).filter(entry => entry.id !== id && entry.id !== 'rotation-axis');
  return { ...record, entries: [...entries,
    { id, subject: `${map.instrument} visibilities of ${span(map.nights)} as a surface map`, status: 'included',
      finding: `The authors' calibrated files of ${map.nights.length} nights (${map.nights.map(night => `${day(night.night)}: ${night.vis2} squared visibilities`).join('; ')}) are public with their code. ROTIR at the pinned commit (${map.recipe}) fits one turning surface to all of them. ${checks(map)}.${map.unfitTwins.length ? ` Spotless twins of ${map.unfitTwins.map(twin => `${fixed(twin.scale * map.diameterMas)} mas`).join(' and ')} do not fit on the ${map.diameterMas} mas sphere (closure-phase chi-squared ${map.unfitTwins.map(twin => fixed(twin.closurePhase)).join(' and ')}) and so do not decide the spot check.` : ''} The published maps themselves are not redistributed.`,
      evidence: [map.data.url, ...map.papers.map(paper => `https://doi.org/${paper.doi}`)] },
    { id: 'rotation-axis', subject: 'Rotation axis, period and prime meridian', status: 'included',
      finding: `The page draws the axis the surface map is fitted with: inclination ${map.inclinationDegrees}° and pole position angle ${map.positionAngleDegrees}° east of north, with a period of ${map.periodDays} d (${paperOf(map.inclinationSource)}). No prime meridian is defined for the star: longitude 0 is the meridian that faced the Earth on ${day(map.referenceNight)}, and the star is not turned.`,
      evidence: map.papers.map(paper => `https://doi.org/${paper.doi}`) }] };
}
