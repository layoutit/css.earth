/** A star's brightness map, made by this repository from its light, as a dataset of the star's page.
 *
 * `archives/tess/reduce.mts` takes a star's light from one window of a mission (a K2 campaign's own light curve, or the
 * pixels of a TESS sector), has the period it turns in judged (for K2 by a published method, archives/tess/methods.mts),
 * and has starry fit the map that reproduces the light curve; it writes the map as a table and a receipt. This module
 * is that kind of map for surface-maps.mts: where its table goes, its scale and colors, the archive and papers it is
 * bound to, and its sentences. It is pure: brightness.mts reads and writes.
 *
 * Every sentence says what the map is: made here, from a light curve, which fixes how bright each longitude is and not
 * where on it the spots lie in latitude. A map made at an assumed tilt says so. */
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { scaleEnd, type MapKind, type SurfaceMap, type SurfaceMapChoice } from '../maps/surface-maps.mts';

export const BRIGHTNESS_GENERATOR = 'packages/telescope-cli/src/archives/tess/reduce.mts', BRIGHTNESS_CONSUMER = 'tess-starry';
const DATA_USE = 'https://archive.stsci.edu/publishing/data-use';
export type LightMission = 'TESS' | 'K2';
/** What differs from mission to mission: what its windows and the data read are called (TESS's full-frame images, K2's own
 * light curves), where they are kept, the zero of its clock (a barycentric Julian date), how far a neighbour is counted, and
 * the sentence the mission asks to be credited with. */
export const MISSIONS = {
  TESS: { name: 'TESS', consumer: 'tess-starry', inputTag: 'tess-map', window: 'sector', pixels: 'full-frame images', directory: 'science/tess', stem: 's', record: 'mast-tess-full-frame-images', timeZero: 2457000, radiusArcsec: 63,
    archive: 'https://mast.stsci.edu/tesscut/', landing: 'https://doi.org/10.17909/0cp4-2j79', doi: '10.17909/0cp4-2j79', mission: 'https://archive.stsci.edu/missions-and-data/tess', served: 'cut at the star\'s place by MAST\'s TESScut',
    title: 'TESS calibrated full-frame images, read as cutouts through MAST\'s TESScut service', locator: 'TESScut: the same pixels cut out of every full-frame image of a sector at one place on the sky, as a FITS cube.',
    acknowledgment: 'This work includes data collected by the TESS mission, funded by the NASA Explorer Program, obtained from the Mikulski Archive for Space Telescopes (MAST).' },
  K2: { name: 'K2', consumer: 'k2-starry', inputTag: 'k2-map', window: 'campaign', pixels: 'light curves', directory: 'science/k2', stem: 'c', record: 'mast-k2-light-curves', timeZero: 2454833, radiusArcsec: 16,
    archive: 'https://archive.stsci.edu/missions-and-data/k2', landing: 'https://doi.org/10.17909/T9WS3R', doi: '10.17909/T9WS3R', mission: 'https://archive.stsci.edu/missions-and-data/k2', served: 'published by the mission and kept at MAST',
    title: 'K2 light curves (all campaigns) at MAST', locator: 'DataCite record of the DOI: K2 Light Curves (all), STScI/MAST, 2016. A file holds one target\'s long-cadence light curve of a campaign, with the flux the mission\'s pipeline corrected (PDC-MAP).',
    acknowledgment: 'This work includes data collected by the K2 mission, funded by the NASA Science Mission Directorate, obtained from the Mikulski Archive for Space Telescopes (MAST).' },
} as const;
const METHOD_RECORD = 'arxiv-1810-06559', METHOD_URL = 'https://arxiv.org/abs/1810.06559';
/** The papers of the published methods that judge a light curve a rotation (archives/tess/methods.mts), by the method's id. */
const PERIOD_METHODS: Readonly<Record<string, { readonly record: string; readonly title: string; readonly arxiv: string; readonly doi: string; readonly creators: readonly string[]; readonly year: string; readonly locator: string }>> = {
  'reinhold-hekker-2020': { record: 'arxiv-2001-08214', title: 'Reinhold & Hekker (2020): Stellar rotation periods from K2 Campaigns 0-18', arxiv: '2001.08214', doi: '10.1051/0004-6361/201936887', creators: ['T. Reinhold', 'S. Hekker'], year: '2020',
    locator: 'arXiv listing: title, authors, DOI, A&A 635, A43. Sects. 2 and 3 print how a light curve is prepared and the criteria a rotation period must meet.' } };
/** Gaia DR3, which says whose light the star's pixels hold: a record the source catalogue already has. */
const GAIA_RECORD = 'gaia-2023-dr3', GAIA_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355';
/** Dark where the surface is dim, white where it is bright. */
const COLORS = ['#1a1a1a', '#5c5c5c', '#9c9c9c', '#d6d6d6', '#ffffff'] as const, PALETTE = [[26, 26, 26], [92, 92, 92], [156, 156, 156], [214, 214, 214], [255, 255, 255]] as const;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The records of the source catalogue (`src/sources`) a star's brightness maps are bound to: the pixels of each mission read,
 * and the paper of the code that makes the map. */
export function brightnessSourceRecords(checkedOn: string, maps: readonly Pick<BrightnessSurfaceMap, 'mission' | 'method'>[] = [{ mission: 'TESS' }]): Map<string, string> {
  const records = new Map<string, string>();
  for (const id of new Set(maps.flatMap(map => map.method ? [map.method.id] : []))) { const paper = PERIOD_METHODS[id]; if (!paper) throw new TypeError(`No source record is written for the period method ${id}.`); const url = `https://arxiv.org/abs/${paper.arxiv}`;
    records.set(`src/sources/${paper.record}.json`, json({ id: paper.record, kind: 'publication', identityLevel: 'work', title: paper.title, identifiers: [{ type: 'arXiv', value: paper.arxiv }, { type: 'DOI', value: paper.doi }],
      links: [{ role: 'archive', url, label: 'arXiv preprint' }, { role: 'landing', url: `https://doi.org/${paper.doi}`, label: 'Journal version' }], evidence: [{ url, checkedOn, locator: paper.locator }], relations: [],
      statements: [{ kind: 'credit', text: paper.title.split(':')[0]!, scope: 'citation', evidence: url }], creators: paper.creators, publicationDate: paper.year })); }
  for (const mission of new Set(maps.map(map => map.mission))) { const from = MISSIONS[mission];
    records.set(`src/sources/${from.record}.json`, json({ id: from.record, kind: 'data-product', identityLevel: 'work', title: from.title, identifiers: [{ type: 'DOI', value: from.doi }],
      links: [{ role: 'archive', url: from.archive, label: `${from.name} at MAST` }, { role: 'landing', url: from.landing, label: from.title }], evidence: [{ url: mission === 'TESS' ? from.archive : `https://api.datacite.org/dois/${from.doi}`, checkedOn, locator: from.locator }],
      relations: [], statements: [{ kind: 'credit', text: from.acknowledgment, scope: 'citation', evidence: from.mission }], publisher: 'Mikulski Archive for Space Telescopes (STScI)' })); }
  records.set(`src/sources/${METHOD_RECORD}.json`, json({ id: METHOD_RECORD, kind: 'publication', identityLevel: 'work', title: 'Luger et al. (2019): starry: Analytic Occultation Light Curves',
    identifiers: [{ type: 'arXiv', value: '1810.06559' }, { type: 'DOI', value: '10.3847/1538-3881/aae8e5' }], links: [{ role: 'archive', url: METHOD_URL, label: 'arXiv preprint' }, { role: 'landing', url: 'https://doi.org/10.3847/1538-3881/aae8e5', label: 'Journal version' }],
    evidence: [{ url: METHOD_URL, checkedOn, locator: 'arXiv listing: title, authors, DOI. The paper describes starry, the code that fits a map to a light curve.' }], relations: [], statements: [{ kind: 'credit', text: 'Luger et al. (2019)', scope: 'citation', evidence: METHOD_URL }],
    creators: ['R. Luger', 'E. Agol', 'D. Foreman-Mackey', 'D. P. Fleming', 'et al.'], publicationDate: '2019' }));
  return records;
}

/** What a map's receipt says of it, read once and checked. */
export interface BrightnessSurfaceMap extends SurfaceMap { /** The mission whose pixels were read, and which of its windows (a sector, a campaign, a quarter). */ readonly mission: LightMission; readonly window: number; /** The light's swing as the star turns, peak to peak, as a share of its mean. */ readonly amplitude: number;
  /** The map's own range, percent of its mean. */ readonly darkestPercent: number; readonly brightestPercent: number; /** Scatter of the light about the map's curve, and the light's noise. */ readonly residual: number; readonly noise: number;
  /** When the window's light was measured: its first and last days, UTC. */ readonly fromUtc: string; readonly toUtc: string;
  /** The light's own strongest period, when it is half the catalogued rotation and the star is taken to turn once in two of them. */ readonly lightPeriodDays?: number;
  /** The share of the light in the star's pixels that Gaia's other stars give, and how many they are. */ readonly neighbourShare?: number; readonly neighbours?: number;
  /** Where the map's tilt comes from: the measured axis the page draws, the tilt the star's record works out, or none. */ readonly tiltFrom: 'page' | 'record' | 'assumed'; readonly codes: readonly string[];
  /** The published method that judged the light a rotation, with what it measured: the height of the periodogram's peak and the periods of its three methods. */
  readonly method?: { readonly id: string; readonly citation: string; readonly url: string; /** The light curve the method's paper uses, which is the one read. */ readonly lightCurve: string; readonly reliability: string; readonly peakHeight: number; readonly periodsDays: readonly [number, number, number] } }

/** "TESS sector 95", "K2 campaign 13", "Kepler quarter 9". */
export const windowName = (mission: LightMission, window: number) => `${MISSIONS[mission].name} ${MISSIONS[mission].window} ${window}`;
export const brightnessChoice = (star: string, mission: LightMission, window: number): SurfaceMapChoice => ({ program: `${star}-${MISSIONS[mission].stem}${String(window).padStart(mission === 'TESS' ? 4 : 2, '0')}`, id: `brightness-${MISSIONS[mission].window}-${window}`,
  label: `${MISSIONS[mission].window[0]!.toUpperCase()}${MISSIONS[mission].window.slice(1)} ${window}` });

/** A mission's time (a barycentric Julian date less the mission's zero) as a UTC day. */
export const missionDay = (time: number, mission: LightMission = 'TESS') => new Date((time + MISSIONS[mission].timeZero - 2440587.5) * 86400000).toISOString().slice(0, 10);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
/** The months a window's light spans: one, two next to each other ("August and September 2025"), or the first to the last ("March to May 2017"). */
export function monthsOf(fromUtc: string, toUtc: string): string { const [a, b] = [fromUtc, toUtc].map(day => ({ year: day.slice(0, 4), index: Number(day.slice(5, 7)) - 1, month: MONTHS[Number(day.slice(5, 7)) - 1]! }));
  const joined = (12 * Number(b!.year) + b!.index) - (12 * Number(a!.year) + a!.index) > 1 ? 'to' : 'and';
  return a!.year === b!.year && a!.month === b!.month ? `${a!.month} ${a!.year}` : a!.year === b!.year ? `${a!.month} ${joined} ${b!.month} ${a!.year}` : `${a!.month} ${a!.year} ${joined} ${b!.month} ${b!.year}`; }
/** The same in the few characters a dataset's detail line has: "Aug 2025", "Aug to Sep 2025", "Dec 2025 to Jan 2026". */
export function shortMonthsOf(fromUtc: string, toUtc: string): string { const [a, b] = [fromUtc, toUtc].map(day => ({ year: day.slice(0, 4), month: MONTHS[Number(day.slice(5, 7)) - 1]!.slice(0, 3) }));
  return a!.year === b!.year && a!.month === b!.month ? `${a!.month} ${a!.year}` : a!.year === b!.year ? `${a!.month} to ${b!.month} ${a!.year}` : `${a!.month} ${a!.year} to ${b!.month} ${b!.year}`; }
/** The star's own color over the gray scale of its Brightness map: each gray, as a share of white, times the color. The map's
 * measured contrast cannot be seen on a page (AU Mic, among the most spotted stars here, gives 21% less light at its darkest
 * longitude, one tenth on a display), and two weaker stretches were still faint; the owner of the project chose the map's full
 * contrast by eye (2026-10-06). The dataset's text says the contrast is drawn stronger than it is, with the star's own numbers. */
export const tinted = (colorHex: string) => PALETTE.map(([gray]) => `#${[1, 3, 5].map(at => Math.round(Number.parseInt(colorHex.slice(at, at + 2), 16) * gray! / 255).toString(16).padStart(2, '0')).join('')}`);
/** The scale all of a star's brightness maps share: the same reach either side of the mean surface. */
const brightnessScale = (maps: readonly BrightnessSurfaceMap[]) => { const reach = scaleEnd(Math.max(...maps.flatMap(map => [100 - map.darkestPercent, map.brightestPercent - 100]))); return { minimum: 100 - reach, maximum: 100 + reach, labels: [`${100 - reach}%`, '100%', `${100 + reach}%`] }; };

/** `curve` is the window's light curve as the reduction kept it: its times date the map. */
export function reducedBrightness(choice: SurfaceMapChoice, receipt: unknown, table: string, curve: unknown): BrightnessSurfaceMap {
  const times = requireRecord(curve, `${choice.program} light curve`).time; if (!Array.isArray(times) || times.length < 2 || !times.every(time => typeof time === 'number')) throw new TypeError(`${choice.program}: its light curve holds no times; reduce the star again.`);
  const record = requireRecord(receipt, `${choice.program} receipt`), star = requireRecord(record.star, 'receipt star'), rotation = requireRecord(record.rotation, 'receipt rotation');
  // A receipt holds one map for each window accepted; one from before K2 was read holds a single map.
  const map = requireRecord((Array.isArray(record.maps) ? record.maps.filter(isRecord) : isRecord(record.map) ? [record.map] : []).find(one => one.table === `${choice.program}.dat`), `${choice.program}: the receipt holds no map of that window; its map`);
  if (rotation.detected !== true) throw new Error(`${choice.program}: the star's rotation is not seen (${String(rotation.reason ?? 'no reason given')}).`);
  const toolchain = isRecord(record.toolchain) && Array.isArray(record.toolchain.requirements) ? record.toolchain.requirements.map(String) : [], lightkurve = toolchain.find(pin => pin.startsWith('lightkurve')) ?? 'lightkurve';
  const source = requireString(map.inclinationSource, 'map inclinationSource'), period = requireFiniteNumber(map.periodDays, 'map periodDays');
  // A receipt from before K2 was read names a TESS sector alone.
  const mission: LightMission = map.mission === 'K2' ? 'K2' : 'TESS', window = requireFiniteNumber(map.window ?? map.sector, 'map window');
  // TESS pixels are read only for a star Gaia vouches for; a K2 star's neighbours are counted when Gaia has it.
  const light = mission === 'TESS' ? requireRecord(record.light, `${choice.program}: the receipt does not say whose light the pixels hold; reduce the star again`) : isRecord(record.light) ? record.light : undefined;
  // A K2 map's receipt names the published method that judged it and what the method measured of this campaign.
  const by = isRecord(record.method) ? record.method : undefined, measured = by && Array.isArray(record.tried) ? record.tried.filter(isRecord).find(one => one.window === window)?.analysis : undefined;
  if (mission !== 'TESS' && !(by && isRecord(measured))) throw new TypeError(`${choice.program}: its receipt names no published method; reduce the star again.`);
  const method = by && isRecord(measured) ? { id: requireString(by.id, 'method id'), citation: requireString(by.citation, 'method citation'), url: requireString(by.url, 'method url'), lightCurve: requireString(by.lightCurve, 'method light curve'), reliability: requireString(by.reliability, 'method reliability'), peakHeight: requireFiniteNumber(measured.peakHeight, 'peak height'),
    periodsDays: [requireFiniteNumber(measured.lombScargleDays, 'periodogram period'), requireFiniteNumber(measured.waveletDays, 'wavelet period'), requireFiniteNumber(measured.autocorrelationDays, 'autocorrelation period')] as const } : undefined;
  const privateer = toolchain.find(pin => pin.startsWith('star-privateer'));
  const tiltFrom = map.inclinationFrom; if (tiltFrom !== 'page' && tiltFrom !== 'record' && tiltFrom !== 'assumed') throw new TypeError(`${choice.program}: its receipt does not say where the map's tilt comes from; reduce the star again.`);
  if (map.table !== `${choice.program}.dat` || !table.includes('ZONE I=')) throw new TypeError(`${choice.program}: the receipt and the table do not describe one map.`);
  return { choice, table, targetName: requireString(star.name, 'receipt star name'), inclinationDegrees: requireFiniteNumber(map.inclinationDegrees, 'map inclination'), inclinationSource: source, periodDays: period,
    periodSource: `measured here from the star's light in ${windowName(mission, window)} (${BRIGHTNESS_GENERATOR})`, mission, window, fromUtc: missionDay(times[0] as number, mission), toUtc: missionDay(times.at(-1) as number, mission), amplitude: requireFiniteNumber(rotation.amplitude, 'rotation amplitude'), darkestPercent: requireFiniteNumber(map.darkestPercent, 'darkestPercent'),
    brightestPercent: requireFiniteNumber(map.brightestPercent, 'brightestPercent'), residual: requireFiniteNumber(map.residual, 'residual'), noise: requireFiniteNumber(map.noise, 'noise'), ...(typeof rotation.lightPeriodDays === 'number' ? { lightPeriodDays: rotation.lightPeriodDays } : {}), ...(light ? { neighbourShare: requireFiniteNumber(light.neighbourShare, 'neighbourShare'), neighbours: requireFiniteNumber(light.neighbours, 'neighbours') } : {}), tiltFrom,
    codes: [lightkurve.replace('==', ' '), ...(method && privateer ? [privateer.replace('==', ' ')] : []), `starry ${requireString(map.starry, 'starry version')}`], ...(method ? { method } : {}) };
}

export const percent = (share: number) => { const value = 100 * share; return value >= 10 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toFixed(2); };
const days = (period: number) => period >= 1 ? `${Number(period.toPrecision(3))} days` : `${Number((period * 24).toPrecision(3))} hours`;

/** What is a brightness map's own in the records surface-maps.mts writes. */
export const BRIGHTNESS_MAPS: MapKind<BrightnessSurfaceMap> = {
  consumer: BRIGHTNESS_CONSUMER, consumers: Object.values(MISSIONS).map(mission => mission.consumer), consumerOf: map => MISSIONS[map.mission].consumer, inputTag: MISSIONS.TESS.inputTag, inputTagOf: map => MISSIONS[map.mission].inputTag,
  directory: MISSIONS.TESS.directory, directoryOf: map => MISSIONS[map.mission].directory, archiveOf: map => MISSIONS[map.mission].archive, generator: BRIGHTNESS_GENERATOR, stepGroup: 'brightness', variable: 'Brightness [%]', units: '%', controlLabel: 'Brightness map', legendTitle: 'Surface brightness',
  archiveUrl: MISSIONS.TESS.archive, references: [], referencesOf: map => [{ catalogueId: MISSIONS[map.mission].record, role: 'material', evidence: MISSIONS[map.mission].archive }, ...(map.method ? [{ catalogueId: PERIOD_METHODS[map.method.id]!.record, role: 'method', evidence: map.method.url }] : []), { catalogueId: METHOD_RECORD, role: 'method', evidence: METHOD_URL }, { catalogueId: GAIA_RECORD, role: 'reference', evidence: GAIA_URL }], colors: COLORS, palette: PALETTE,
  scale: brightnessScale,
  words(map, { count, tilt, outlined }) { const { choice } = map, swing = `${percent(map.amplitude)}%`, turn = days(map.periodDays), from = MISSIONS[map.mission], where = windowName(map.mission, map.window);
    const tilted = map.tiltFrom === 'assumed' ? `No tilt of this star's axis is known: the map is made at ${tilt}°, the middle tilt of axes that point at random.`
      : map.tiltFrom === 'record' ? `The map is made at a tilt of ${tilt}°, worked out from the star's rotation speed, period and radius.` : `The map is made at the tilt the page draws the star with, ${tilt}°.`;
    const outline = outlined ? ` Black line: ${tilt}° S; the star never shows us what lies below it.` : '';
    const halved = map.lightPeriodDays === undefined ? '' : ` The light repeats every ${days(map.lightPeriodDays)}, half the rotation period the catalogues print for the star: two groups of spots on opposite sides do that.`;
    // A K2 star's neighbours are only counted: its light curve is the mission's, which corrects for them.
    const share = map.neighbourShare === undefined ? '' : map.neighbourShare < 0.001 ? 'under 0.1' : percent(map.neighbourShare);
    const others = map.neighbours === undefined || map.neighbourShare === undefined ? '' : map.neighbours === 0 ? ` Gaia DR3 lists no other star within ${from.radiusArcsec} arcseconds of it.`
      : ` Gaia DR3 lists ${map.neighbours} other ${map.neighbours === 1 ? 'star' : 'stars'} within ${from.radiusArcsec} arcseconds, ${map.method ? `with ${share}% of their light and the star's together` : `giving ${share}% of the light in the star's pixels`}.`;
    // A K2 star's light curve is the mission's own, the one the method's paper uses; a TESS star's is measured here from the pixels.
    const own = map.method !== undefined, curve = own ? `the ${from.name} mission's own light curve of ${from.window} ${map.window} (its PDC-MAP flux)` : `the light curve this project measured from the ${from.name} ${from.pixels} of ${from.window} ${map.window}`;
    // The published method that judged the light a rotation, with its three periods and the peak it asks to be over 0.3.
    const judged = map.method ? ` The period is the mean of three methods' periods (periodogram ${map.method.periodsDays[0].toFixed(2)} d, wavelet ${map.method.periodsDays[1].toFixed(2)} d, autocorrelation ${map.method.periodsDays[2].toFixed(2)} d; periodogram peak ${map.method.peakHeight.toFixed(2)}), accepted by the criteria of ${map.method.citation}.` : '';
    return { productId: `Brightness map of ${map.targetName} from its light in ${where}`,
      inputTitle: `Brightness map of ${map.targetName} from its light curve in ${where}${own ? ', the mission\'s own' : `, measured from the ${from.pixels}`}: brightness on a longitude-latitude grid`,
      credit: own ? `NASA ${from.name} mission light curve (PDC-MAP), ${from.window} ${map.window}, from MAST; its rotation judged by the criteria of ${map.method!.citation}; map made in this project with ${map.codes.join(', ').replace(/, ([^,]*)$/u, ' and $1')}. ${from.acknowledgment}`
        : `NASA ${from.name} ${from.pixels}, ${from.window} ${map.window}, from MAST; photometry and map made in this project with ${map.codes.join(' and ')}. ${from.acknowledgment}`, displayCredit: `NASA ${from.name} · mapped here`,
      license: 'Public NASA mission data (MAST); reduction by this project', licenseEvidence: [DATA_USE],
      acquisition: `Built by the generator for this star, from the ${own ? 'light curve' : 'pixels'} of the ${from.window} ${from.served}. Restored from the source cache; not tracked. The receipt (the ${from.window}'s request, what was measured and the codes) is written again by the generator under output/tess and is not kept in git.`,
      redistribution: `Public ${from.name} data, reduced here.`,
      description: `Brightness of the star's surface that reproduces its light as it turns once in ${turn}, fitted with starry to ${curve} (the light ${own ? 'varies' : 'swings'} by ${swing}; the map's curve leaves a scatter of ${percent(map.residual)}%, the light's own noise being ${percent(map.noise)}%). A light curve fixes how bright each longitude is, not the latitude of what darkens it.${judged}${halved} ${tilted}${others} A reduction made in this project, not a published map.`,
      surfaceTitle: `${from.name} · brightness map made here · ${choice.label}`, qualification: `Mapped in this project · ${from.name} ${own ? 'mission light curve' : from.pixels}, ${choice.label.toLowerCase()}`,
      notes: `Where the star's surface was darker and brighter in ${from.name} ${choice.label.toLowerCase()}, worked out in this project from how its light rose and fell by ${swing} as it turned once in ${turn}. ${own ? `The light curve is the mission's own; the criteria of ${map.method!.citation} decide that it shows the star turning, and starry finds the map that reproduces it.` : 'The light curve is measured from the mission\'s images with lightkurve, and starry finds the map that reproduces it.'} The longitudes of the dark and bright regions are fixed by the data; their latitudes are not.${halved} ${tilted}${count > 1 ? ` Step through the ${count} maps to see the spots change.` : ''}`,
      legendNote: `Darker: dimmer than the star's mean surface; white: brighter.${outline}`,
      text: { title: `Brightness map, ${choice.label}`, detail: `${choice.label}, mapped here`, summary: 'Darker and brighter longitudes of the star, worked out in this project from how its light changes as it turns.' } }; },
  // Only a page that measures the star's axis draws the star at the map's tilt.
  outlines: map => map.tiltFrom === 'page',
  // The star in its own color, as dark and as bright as its Brightness map draws it: the map's scale, tinted.
  natural(map, star) { const when = monthsOf(map.fromUtc, map.toUtc), darkest = Number((100 * (1 - map.darkestPercent / map.brightestPercent)).toFixed(1)), scale = brightnessScale([map]);
    const halved = map.lightPeriodDays === undefined ? '' : ` The light repeats every ${days(map.lightPeriodDays)}, half the catalogued rotation period, and the star is taken to turn once in two of them.`;
    return { id: 'color-brightness', label: 'Color + brightness', minimum: scale.minimum, maximum: scale.maximum, colors: tinted(star.colorHex),
      description: `The star's color (${star.colorHex}, its Color dataset) over the brightness map this project made from the star's light in ${windowName(map.mission, map.window)} (${when}): the map's scale, ${scale.minimum}% to ${scale.maximum}% of the mean surface, runs from a dark tone of the color to the color itself. The contrast is drawn far stronger than it is, so the parts can be told apart: the darkest part gives ${darkest}% less light than the brightest. Longitudes are fixed by the light curve; latitudes and shapes are not. No color change of the spots is drawn: none is measured. A reduction made in this project, not a published map.`,
      surfaceTitle: `${MISSIONS[map.mission].name} · the star in its color over its brightness map · ${when}`, qualification: `The star's color, darker where ${MISSIONS[map.mission].name} saw it dimmer (contrast drawn stronger) · ${when}, mapped in this project`,
      notes: `${map.targetName} in its own color, darker where its light in ${MISSIONS[map.mission].name}'s images of ${when} says it was darker. As the star turned once in ${days(map.periodDays)} its light rose and fell by ${percent(map.amplitude)}%.${halved} The contrast is drawn far stronger than it is, so the eye can see it: the darkest part gives ${darkest}% less light than the brightest, and is drawn as dark as on the Brightness map, whose scale has the measured values. The longitudes of the darker and brighter parts are measured. Their latitudes and shapes are not: they are the smoothest that reproduce the light. No change of color is drawn, because none is measured. Spots come and go within weeks or months: this is the star then. The darkening toward the edge is the Color dataset's.`,
      text: { title: `Color + brightness, ${shortMonthsOf(map.fromUtc, map.toUtc)}`, detail: windowName(map.mission, map.window), summary: 'The star in its own color, darker where its light shows it darker; the contrast is drawn stronger to be seen.' } }; },
  report(maps, scale) { const count = maps.length; return `${count} brightness ${count === 1 ? 'map' : 'maps'} on one scale of ${scale.minimum}% to ${scale.maximum}% (${maps.map(map => `${map.choice.label}: turns in ${days(map.periodDays)}, light swings ${percent(map.amplitude)}%`).join('; ')})`; },
};
