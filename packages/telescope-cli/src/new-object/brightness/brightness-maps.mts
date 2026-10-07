/** A star's brightness map, made by this repository from its light, as a dataset of the star's page.
 *
 * `archives/tess/reduce.mts` takes a star's light from one window of a mission (a K2 campaign's or a TESS sector's own
 * light curve, or a quarter of a Kepler star's KEPSEISMIC light curve), has the period it turns in judged by a published
 * method (archives/tess/methods.mts) or reads it from a paper's own published verdict (archives/tess/published.mts,
 * archives/kepler/santos.mts), and has starry fit the map that reproduces the light curve; it writes the map as a table
 * and a receipt. This module
 * is that kind of map for surface-maps.mts: where its table goes, its scale and colors, the archive and papers it is
 * bound to, and its sentences. It is pure: brightness.mts reads and writes.
 *
 * Every sentence says what the map is: made here, from a light curve, which fixes how bright each longitude is and not
 * where on it the spots lie in latitude. A map made at an assumed tilt says so. */
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { scaleEnd, type MapKind, type SurfaceMap, type SurfaceMapChoice } from '../maps/surface-maps.mts';

export const BRIGHTNESS_GENERATOR = 'packages/telescope-cli/src/archives/tess/reduce.mts', BRIGHTNESS_CONSUMER = 'tess-starry';
const DATA_USE = 'https://archive.stsci.edu/publishing/data-use';
export type LightMission = 'TESS' | 'K2' | 'Kepler';
/** What differs from mission to mission: what its windows and its light curves are called, where they are kept, the zero of its clock (a barycentric Julian date), how far a neighbour is counted, and
 * the sentence the mission asks to be credited with. `product` is whose light curve is read: the mission's own pipeline's
 * (PDC-MAP), or KEPSEISMIC, which its authors make from the Kepler mission's pixels; `whose`, `credited`, `kind` and
 * `fitted` word it, and `reader` says whether lightkurve reads the file. */
export const MISSIONS = {
  TESS: { name: 'TESS', consumer: 'tess-starry', inputTag: 'tess-map', window: 'sector', pixels: 'light curves', cadence: '2-minute ', directory: 'science/tess/pdcsap', stem: 's', record: 'mast-tess-light-curves', timeZero: 2457000, radiusArcsec: 63,
    product: 'PDC-MAP', reader: true, whose: 'the mission\'s own', credited: 'NASA TESS mission light curve (PDC-MAP)', kind: 'TESS mission light curve', fitted: (window: number) => `the TESS mission's own 2-minute light curve of sector ${window} (its PDC-MAP flux)`,
    archive: 'https://archive.stsci.edu/missions-and-data/tess', landing: 'https://doi.org/10.17909/t9-nmc8-f686', doi: '10.17909/t9-nmc8-f686', mission: 'https://archive.stsci.edu/missions-and-data/tess', served: 'published by the mission and kept at MAST',
    title: 'TESS light curves (all sectors) at MAST', locator: 'DataCite record of the DOI: TESS Light Curves - All Sectors, STScI/MAST, 2021. A file holds one target\'s 2-minute light curve of a sector, with the flux the mission\'s pipeline corrected (PDC-MAP).',
    acknowledgment: 'This work includes data collected by the TESS mission, funded by the NASA Explorer Program, obtained from the Mikulski Archive for Space Telescopes (MAST).' },
  K2: { name: 'K2', consumer: 'k2-starry', inputTag: 'k2-map', window: 'campaign', pixels: 'light curves', cadence: '', directory: 'science/k2/pdcsap', stem: 'c', record: 'mast-k2-light-curves', timeZero: 2454833, radiusArcsec: 16,
    product: 'PDC-MAP', reader: true, whose: 'the mission\'s own', credited: 'NASA K2 mission light curve (PDC-MAP)', kind: 'K2 mission light curve', fitted: (window: number) => `the K2 mission's own light curve of campaign ${window} (its PDC-MAP flux)`,
    archive: 'https://archive.stsci.edu/missions-and-data/k2', landing: 'https://doi.org/10.17909/T9WS3R', doi: '10.17909/T9WS3R', mission: 'https://archive.stsci.edu/missions-and-data/k2', served: 'published by the mission and kept at MAST',
    title: 'K2 light curves (all campaigns) at MAST', locator: 'DataCite record of the DOI: K2 Light Curves (all), STScI/MAST, 2016. A file holds one target\'s long-cadence light curve of a campaign, with the flux the mission\'s pipeline corrected (PDC-MAP).',
    acknowledgment: 'This work includes data collected by the K2 mission, funded by the NASA Science Mission Directorate, obtained from the Mikulski Archive for Space Telescopes (MAST).' },
  Kepler: { name: 'Kepler', consumer: 'kepler-starry', inputTag: 'kepler-map', window: 'quarter', pixels: 'KEPSEISMIC light curve', cadence: '', directory: 'science/kepler/kepseismic', stem: 'q', record: 'mast-kepseismic-light-curves', timeZero: 2454833, radiusArcsec: 16,
    product: 'KEPSEISMIC', reader: false, whose: 'KEPSEISMIC\'s', credited: 'KEPSEISMIC light curve of the NASA Kepler mission\'s pixels (Mathur, Santos & García)', kind: 'KEPSEISMIC light curve of Kepler',
    fitted: (window: number) => `the measured points of quarter ${window} of the star's KEPSEISMIC light curve, which its authors make from the Kepler mission's pixels`,
    archive: 'https://archive.stsci.edu/hlsp/kepseismic', landing: 'https://doi.org/10.17909/t9-mrpw-gc07', doi: '10.17909/t9-mrpw-gc07', mission: 'https://archive.stsci.edu/missions-and-data/kepler', served: 'published by its authors as a high-level science product and kept at MAST',
    title: 'KEPSEISMIC: Kepler light curves optimized for asteroseismology, at MAST', locator: 'DataCite record of the DOI: Kepler Light Curves Optimized For Asteroseismology ("KEPSEISMIC"), S. Mathur, Â. Santos and R. A. García, STScI/MAST, 2019. A file holds one target\'s light curve of all its quarters, made from the mission\'s pixels, corrected with KADACS (García et al. 2011, MNRAS 414, L6), its gaps under 20 days filled in (García et al. 2014, A&A 568, A10; Pires et al. 2015, A&A 574, A18) and high-pass filtered at 20, 55 or 80 days.',
    acknowledgment: 'This work includes data collected by the Kepler mission, funded by the NASA Science Mission Directorate, obtained from the Mikulski Archive for Space Telescopes (MAST).' },
} as const;
/** The mission a receipt names; one from before K2 was read names none, and is of TESS. */
export const missionOf = (named: unknown): LightMission => named === 'K2' || named === 'Kepler' ? named : 'TESS';
const METHOD_RECORD = 'arxiv-1810-06559', METHOD_URL = 'https://arxiv.org/abs/1810.06559';
/** The papers of the published methods that judge a light curve a rotation (archives/tess/methods.mts), by the method's id. */
const PERIOD_METHODS: Readonly<Record<string, { readonly record: string; readonly title: string; readonly arxiv: string; readonly doi: string; readonly creators: readonly string[]; readonly year: string; readonly locator: string }>> = {
  'reinhold-hekker-2020': { record: 'arxiv-2001-08214', title: 'Reinhold & Hekker (2020): Stellar rotation periods from K2 Campaigns 0-18', arxiv: '2001.08214', doi: '10.1051/0004-6361/201936887', creators: ['T. Reinhold', 'S. Hekker'], year: '2020',
    locator: 'arXiv listing: title, authors, DOI, A&A 635, A43. Sects. 2 and 3 print how a light curve is prepared and the criteria a rotation period must meet.' },
  'holcomb-2022': { record: 'arxiv-2206-10629', title: 'Holcomb et al. (2022): SpinSpotter: An Automated Algorithm for Identifying Stellar Rotation Periods with Autocorrelation Analysis', arxiv: '2206.10629', doi: '10.3847/1538-4357/ac8990',
    creators: ['R. J. Holcomb', 'P. Robertson', 'P. Hartigan', 'R. J. Oelkers', 'C. Robinson'], year: '2022', locator: 'arXiv listing: title, authors, DOI (ApJ 936, 138). Sects. II and III print the algorithm, the stars it is applied to and the criteria a rotation period must meet.' },
  'colman-2024': { record: 'arxiv-2402-14954', title: 'Colman et al. (2024): Methods for the detection of stellar rotation periods in individual TESS sectors and results from the Prime mission', arxiv: '2402.14954', doi: '10.3847/1538-3881/ad2c86',
    creators: ['I. L. Colman', 'R. Angus', 'T. David', 'J. Curtis', 'S. Hattori', 'Y. L. Lu'], year: '2024', locator: 'arXiv listing: title, authors, DOI (AJ 167, 189). Sects. II.4 and III print the sample, the light curves and what a detection is; the consolidated catalogue of 10,909 targets is VizieR J/AJ/167/189, table fig12, whose ReadMe describes each column.' },
  'canto-martins-2020': { record: 'arxiv-2007-03079', title: 'Canto Martins et al. (2020): A Search for Rotation Periods in 1000 TESS Objects of Interest', arxiv: '2007.03079', doi: '10.3847/1538-4365/aba73f',
    creators: ['B. L. Canto Martins', 'R. L. Gomes', 'Y. S. Messias', 'S. R. de Lira', 'I. C. Leão', 'L. A. Almeida', 'M. A. Teixeira', 'M. L. das Chagas', 'J. P. Bravo', 'A. Bewketu Belete', 'J. R. De Medeiros'], year: '2020',
    locator: 'arXiv listing: title, authors, DOI (ApJS 250, 20). Sects. II and III print the sample, the light curves, the three periodicity analyses and the visual inspection; the catalogue is VizieR J/ApJS/250/20, whose ReadMe describes each column of Table 1 (131 stars with an unambiguous rotation period) and Tables 2 to 5.' },
  'santos-2019': { record: 'arxiv-1908-05222', title: 'Santos et al. (2019): Surface Rotation and Photometric Activity for Kepler Targets. I. M and K Main-sequence Stars', arxiv: '1908.05222', doi: '10.3847/1538-4365/ab3b56',
    creators: ['A. R. G. Santos', 'R. A. García', 'S. Mathur', 'L. Bugnet', 'J. L. van Saders', 'T. S. Metcalfe', 'G. V. A. Simonian', 'M. H. Pinsonneault'], year: '2019', locator: 'arXiv listing: title, authors, DOI (ApJS 244, 21). Sects. II and III print the light curves, the sample and how a rotation period is selected; the catalogue is VizieR J/ApJS/244/21, whose ReadMe describes each column of Tables 3 (15,640 stars with a period), 4 and 5.' },
  'santos-2021': { record: 'arxiv-2107-02217', title: 'Santos et al. (2021): Surface Rotation and Photometric Activity for Kepler Targets. II. G and F Main-sequence Stars and Cool Subgiant Stars', arxiv: '2107.02217', doi: '10.3847/1538-4365/ac033f',
    creators: ['A. R. G. Santos', 'S. N. Breton', 'S. Mathur', 'R. A. García'], year: '2021', locator: 'arXiv listing: title, authors, DOI (ApJS 255, 17). Sects. II and III print the light curves, the sample and how a rotation period is selected; the catalogue is VizieR J/ApJS/255/17, whose ReadMe describes each column of Tables 1 (39,591 stars with a period) and 2.' } };
/** Gaia DR3, which says whose light the star's pixels hold: a record the source catalogue already has. */
const GAIA_RECORD = 'gaia-2023-dr3', GAIA_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355';
/** Dark where the surface is dim, white where it is bright. */
const COLORS = ['#1a1a1a', '#5c5c5c', '#9c9c9c', '#d6d6d6', '#ffffff'] as const, PALETTE = [[26, 26, 26], [92, 92, 92], [156, 156, 156], [214, 214, 214], [255, 255, 255]] as const;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The records of the source catalogue (`src/sources`) a star's brightness maps are bound to: the pixels of each mission read,
 * and the paper of the code that makes the map. */
export function brightnessSourceRecords(checkedOn: string, maps: readonly { readonly mission: LightMission; readonly method: { readonly id: string } }[]): Map<string, string> {
  const records = new Map<string, string>();
  for (const id of new Set(maps.map(map => map.method.id))) { const paper = PERIOD_METHODS[id]; if (!paper) throw new TypeError(`No source record is written for the period method ${id}.`); const url = `https://arxiv.org/abs/${paper.arxiv}`;
    records.set(`src/sources/${paper.record}.json`, json({ id: paper.record, kind: 'publication', identityLevel: 'work', title: paper.title, identifiers: [{ type: 'arXiv', value: paper.arxiv }, { type: 'DOI', value: paper.doi }],
      links: [{ role: 'archive', url, label: 'arXiv preprint' }, { role: 'landing', url: `https://doi.org/${paper.doi}`, label: 'Journal version' }], evidence: [{ url, checkedOn, locator: paper.locator }], relations: [],
      statements: [{ kind: 'credit', text: paper.title.split(':')[0]!, scope: 'citation', evidence: url }], creators: paper.creators, publicationDate: paper.year })); }
  for (const mission of new Set(maps.map(map => map.mission))) { const from = MISSIONS[mission];
    records.set(`src/sources/${from.record}.json`, json({ id: from.record, kind: 'data-product', identityLevel: 'work', title: from.title, identifiers: [{ type: 'DOI', value: from.doi }],
      links: [{ role: 'archive', url: from.archive, label: `${from.name} at MAST` }, { role: 'landing', url: from.landing, label: from.title }], evidence: [{ url: `https://api.datacite.org/dois/${from.doi}`, checkedOn, locator: from.locator }],
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
  /** The published method that judged the light a rotation, with what it measured. */
  readonly method: { readonly id: string; readonly citation: string; readonly url: string; /** The light curve the method's paper uses, which is the one read. */ readonly lightCurve: string; readonly reliability: string; /** How many of the star's windows were accepted and how many were read. */ readonly campaigns: number; readonly read: number;
    /** What the paper asks, what the method measured of this window and, where its paper judges them together, of all the star's windows, in a sentence's words. */ readonly asks: string; readonly says: string; readonly wholeSays?: string; /** The periodogram's peak and the three methods' periods, where the method is Reinhold & Hekker's. */ readonly peakHeight?: number; readonly periodsDays?: readonly [number, number, number];
    /** The table the star is a row of, when its rotation is a paper's own published verdict and no criteria were applied here; where the light's swing then comes from; and what the paper's entry says of the light read and of the windows left without a map. */
    readonly published?: string; readonly swing?: string; readonly note?: string;
    /** The methods run on the star's light before, each with the mission whose light it read and its own sentence of refusal. */ readonly refused?: readonly { readonly citation: string; readonly mission: LightMission; readonly reason: string }[] };
  /** Where the star's temperature or surface gravity comes from, when its record holds none and its light curve's header gave it. */ readonly kindFrom?: string }

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
/** A color in OKLCH (Ottosson 2020): lightness, chroma and hue, where a step of lightness looks the same size at any hue. */
const toLinear = (value: number) => { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; };
const fromLinear = (unit: number) => 255 * (unit <= 0.0031308 ? 12.92 * unit : 1.055 * unit ** (1 / 2.4) - 0.055);
function toOklch([red, green, blue]: readonly [number, number, number]): [number, number, number] { const r = toLinear(red), g = toLinear(green), b = toLinear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)]; }
/** The sRGB color of an OKLCH one; a chroma the display cannot show is lowered until it can, the lightness and hue kept. */
function fromOklch(L: number, C: number, H: number): [number, number, number] { for (let chroma = C; ; chroma *= 0.96) { const A = chroma * Math.cos(H), B = chroma * Math.sin(H);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s] as const;
  if (chroma < 0.002 || rgb.every(unit => unit >= -0.0005 && unit <= 1.0005)) return rgb.map(unit => fromLinear(Math.max(0, Math.min(1, unit)))) as [number, number, number]; } }
/** How the darkest part of Color + brightness is drawn: the star's own hue, this much lower in lightness and this much
 * richer in chroma (OKLCH), "four steps darker, richer" of a sheet of options. Nothing is mixed with black. */
export const DARK_STEP = { lightness: 0.4, chroma: 0.12 } as const;
/** How much stronger than the Color dataset's the darkening toward the edge is drawn on Color + brightness: the limb law's
 * light raised to this power, still toward black. Chosen by eye by the owner of the project from a sheet of options
 * (2026-10-06); the Color dataset keeps the published law as it is. */
export const LIMB_STRENGTH = 1.5;
/** The colors of Color + brightness, from the map's darkest value to its brightest: a darker, richer step of the star's
 * own hue, up to the star's color. The map's measured contrast cannot be seen on a page (AU Mic, among the most spotted
 * stars here, gives 21% less light at its darkest longitude, one tenth on a display), and a scale that ran toward black
 * read as shadow, not as the star; the owner of the project chose this step by eye from sheets of options (2026-10-06).
 * The dataset's text says the contrast is drawn stronger than it is, with the star's own numbers. */
export function tinted(colorHex: string): string[] { const color = [1, 3, 5].map(at => Number.parseInt(colorHex.slice(at, at + 2), 16)) as [number, number, number], [L, C, H] = toOklch(color), 
  // A color with no hue of its own (a pure white or gray) is given none: its darker step stays neutral.
  dark = fromOklch(Math.max(0, L - DARK_STEP.lightness), C < 0.002 ? 0 : C + DARK_STEP.chroma, H);
  return PALETTE.map((_stop, index) => `#${color.map((channel, at) => Math.round(dark[at]! + (channel - dark[at]!) * index / (PALETTE.length - 1)).toString(16).padStart(2, '0')).join('')}`); }
/** The scale all of a star's brightness maps share: the same reach either side of the mean surface. */
const brightnessScale = (maps: readonly BrightnessSurfaceMap[]) => { const reach = scaleEnd(Math.max(...maps.flatMap(map => [100 - map.darkestPercent, map.brightestPercent - 100]))); return { minimum: 100 - reach, maximum: 100 + reach, labels: [`${100 - reach}%`, '100%', `${100 + reach}%`] }; };

/** The least and greatest brightness in a map's table (its third column), percent of the mean surface. */
function tableRange(table: string): readonly [number, number] | undefined { let low = Infinity, high = -Infinity;
  for (const line of table.split('\n')) { const cells = line.trim().split(/\s+/u).map(Number); if (cells.length !== 3 || !cells.every(Number.isFinite)) continue; low = Math.min(low, cells[2]!); high = Math.max(high, cells[2]!); }
  return low <= high ? [low, high] : undefined; }
/** A map's range, percent of its mean. The receipt gives it to a tenth of a percent, which is the whole range of a map
 * of a star whose light swings by a hundredth: such a map reads 100 to 100 there, and its range is read from its table,
 * which holds so narrow a map to seven decimals of its mean. A scale is drawn from it, nothing else: no star is kept or
 * left out by its range. */
export function mapRange(darkest: number, brightest: number, table: string): readonly [number, number] { return darkest < 100 || brightest > 100 ? [darkest, brightest] : tableRange(table) ?? [darkest, brightest]; }

/** Where a map's table goes under the star's `source/`: its mission's directory, and `fine` under it for a table that
 * holds its map to seven decimals of the mean (archives/tess/map.mts `written`), which shows in a value whose last two
 * decimals of a percent are not zero. The source mirror keeps a path's first bytes: the narrow maps written again with
 * seven decimals took a new path there, and the tables written with five keep theirs. */
export const FINE_DIRECTORY = 'fine';
export function tableDirectory(mission: LightMission, table: string): string {
  const fine = table.split('\n').some(line => { const cells = line.trim().split(/\s+/u); return cells.length === 3 && /^\d+\.\d{5}$/u.test(cells[2]!) && !cells[2]!.endsWith('00'); });
  return fine ? `${MISSIONS[mission].directory}/${FINE_DIRECTORY}` : MISSIONS[mission].directory; }

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
  const mission = missionOf(map.mission), window = requireFiniteNumber(map.window ?? map.sector, 'map window');
  // A star's neighbours are counted when Gaia has it at its place.
  const light = isRecord(record.light) ? record.light : undefined;
  // A map's receipt names the published method that judged it, what the method measured of this window and what its paper asks.
  // A receipt may hold the windows of an earlier mission, and of a method that refused before a paper's verdict was read: a map's are its own method's.
  const by = requireRecord(record.method, `${choice.program}: its receipt names no published method; reduce the star again`), windows = (Array.isArray(record.tried) ? record.tried.filter(isRecord) : []).filter(one => (one.method === undefined || one.method === by.id) && (one.mission === undefined || one.mission === mission));
  const seen = requireRecord(windows.find(one => one.window === window), `${choice.program}: its receipt holds nothing measured of that window; its entry`);
  const refused = (Array.isArray(record.refused) ? record.refused.filter(isRecord) : []).flatMap(one => isRecord(one.method) && isRecord(one.rotation) && typeof one.method.citation === 'string' && typeof one.rotation.reason === 'string' ? [{ citation: one.method.citation, mission: missionOf(one.mission), reason: one.rotation.reason }] : []);
  const catalogue = isRecord(record.inputCatalogue) && Array.isArray(record.inputCatalogue.fills) && record.inputCatalogue.fills.length ? record.inputCatalogue : undefined, lacking = (catalogue?.fills as unknown[] | undefined)?.map(key => key === 'effectiveTemperatureK' ? 'temperature' : 'surface gravity').join(' or ');
  const measured = requireRecord(seen.analysis, `${choice.program}: what was measured`), three = [measured.lombScargleDays, measured.waveletDays, measured.autocorrelationDays];
  const method = { id: requireString(by.id, 'method id'), citation: requireString(by.citation, 'method citation'), url: requireString(by.url, 'method url'), lightCurve: requireString(by.lightCurve, 'method light curve'), asks: requireString(by.asks, 'what the method asks'), reliability: requireString(by.reliability, 'method reliability'),
    campaigns: Array.isArray(record.maps) ? record.maps.length : 1, read: windows.filter(one => typeof one.says === 'string').length, says: requireString(seen.says, 'what the method measured'), ...(isRecord(record.whole) && typeof record.whole.says === 'string' ? { wholeSays: record.whole.says } : {}),
    ...(three.every(days => typeof days === 'number') && typeof measured.peakHeight === 'number' ? { peakHeight: measured.peakHeight, periodsDays: three as [number, number, number] } : {}), ...(typeof by.published === 'string' ? { published: by.published } : {}), ...(typeof by.swing === 'string' ? { swing: by.swing } : {}),
    ...(typeof by.published === 'string' && isRecord(record.published) && typeof record.published.note === 'string' ? { note: record.published.note } : {}), ...(refused.length ? { refused } : {}) };
  const privateer = toolchain.find(pin => pin.startsWith('star-privateer')), spinspotter = toolchain.find(pin => pin.startsWith('spinspotter'));
  const tiltFrom = map.inclinationFrom; if (tiltFrom !== 'page' && tiltFrom !== 'record' && tiltFrom !== 'assumed') throw new TypeError(`${choice.program}: its receipt does not say where the map's tilt comes from; reduce the star again.`);
  if (map.table !== `${choice.program}.dat` || !table.includes('ZONE I=')) throw new TypeError(`${choice.program}: the receipt and the table do not describe one map.`);
  const [darkestPercent, brightestPercent] = mapRange(requireFiniteNumber(map.darkestPercent, 'darkestPercent'), requireFiniteNumber(map.brightestPercent, 'brightestPercent'), table);
  return { choice, table, targetName: requireString(star.name, 'receipt star name'), inclinationDegrees: requireFiniteNumber(map.inclinationDegrees, 'map inclination'), inclinationSource: source, periodDays: period,
    periodSource: method.published ? `published by ${method.citation} (${method.published})` : `measured here from the star's light in ${windowName(mission, window)} (${BRIGHTNESS_GENERATOR})`, mission, window, fromUtc: missionDay(times[0] as number, mission), toUtc: missionDay(times.at(-1) as number, mission), amplitude: requireFiniteNumber(rotation.amplitude, 'rotation amplitude'), darkestPercent,
    brightestPercent, residual: requireFiniteNumber(map.residual, 'residual'), noise: requireFiniteNumber(map.noise, 'noise'), ...(typeof rotation.lightPeriodDays === 'number' ? { lightPeriodDays: rotation.lightPeriodDays } : {}), ...(light ? { neighbourShare: requireFiniteNumber(light.neighbourShare, 'neighbourShare'), neighbours: requireFiniteNumber(light.neighbours, 'neighbours') } : {}), tiltFrom,
    // The codes that read and prepared the light: none for a light curve its authors prepared and this repository's own reader reads.
    codes: [...(MISSIONS[mission].reader ? [lightkurve.replace('==', ' '), ...(method.periodsDays && privateer ? [privateer.replace('==', ' ')] : []), ...(method.periodsDays || !spinspotter ? [] : [spinspotter.replace('==', ' ').replace('spinspotter', 'SpinSpotter')])] : []), `starry ${requireString(map.starry, 'starry version')}`], method,
    ...(catalogue ? { kindFrom: `The star's record holds no ${lacking}: ${requireString(catalogue.says, 'what the input catalogue gives').replace(/^The /u, 'the ').replace(/\.$/u, '')}, and that is what decides whether the method is for this kind of star.` } : {}) };
}

/** A share as a percentage in a sentence: two decimals under 1%, and a third where two would print a measured value as 0.00. */
export const percent = (share: number) => { const value = 100 * share; return value >= 10 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value >= 0.005 ? value.toFixed(2) : value >= 0.0005 ? value.toFixed(3) : 'under 0.001'; };
const days = (period: number) => period >= 1 ? `${Number(period.toPrecision(3))} days` : `${Number((period * 24).toPrecision(3))} hours`;

/** What is a brightness map's own in the records surface-maps.mts writes. */
export const BRIGHTNESS_MAPS: MapKind<BrightnessSurfaceMap> = {
  consumer: BRIGHTNESS_CONSUMER, consumers: Object.values(MISSIONS).map(mission => mission.consumer), consumerOf: map => MISSIONS[map.mission].consumer, inputTag: MISSIONS.TESS.inputTag, inputTagOf: map => MISSIONS[map.mission].inputTag,
  directory: MISSIONS.TESS.directory, directoryOf: map => tableDirectory(map.mission, map.table), archiveOf: map => MISSIONS[map.mission].archive, generator: BRIGHTNESS_GENERATOR, stepGroup: 'brightness', variable: 'Brightness [%]', units: '%', controlLabel: 'Brightness map', legendTitle: 'Surface brightness',
  archiveUrl: MISSIONS.TESS.archive, references: [], referencesOf: map => [{ catalogueId: MISSIONS[map.mission].record, role: 'material', evidence: MISSIONS[map.mission].archive }, { catalogueId: PERIOD_METHODS[map.method.id]!.record, role: 'method', evidence: map.method.url }, { catalogueId: METHOD_RECORD, role: 'method', evidence: METHOD_URL }, { catalogueId: GAIA_RECORD, role: 'reference', evidence: GAIA_URL }], colors: COLORS, palette: PALETTE,
  scale: brightnessScale,
  words(map, { count, tilt, outlined }) { const { choice } = map, swing = `${percent(map.amplitude)}%`, turn = days(map.periodDays), from = MISSIONS[map.mission], where = windowName(map.mission, map.window);
    const tilted = map.tiltFrom === 'assumed' ? `No tilt of this star's axis is known: the map is made at ${tilt}°, the middle tilt of axes that point at random.`
      : map.tiltFrom === 'record' ? `The map is made at a tilt of ${tilt}°, worked out from the star's rotation speed, period and radius.` : `The map is made at the tilt the page draws the star with, ${tilt}°.`;
    const outline = outlined ? ` Black line: ${tilt}° S; the star never shows us what lies below it.` : '';
    const halved = map.lightPeriodDays === undefined ? '' : ` The light repeats every ${days(map.lightPeriodDays)}, half the rotation period the catalogues print for the star: two groups of spots on opposite sides do that.`;
    // A star's neighbours are only counted: its light curve is the mission's, which corrects for them.
    const share = map.neighbourShare === undefined ? '' : map.neighbourShare < 0.001 ? 'under 0.1' : percent(map.neighbourShare);
    const others = map.neighbours === undefined || map.neighbourShare === undefined ? '' : map.neighbours === 0 ? ` Gaia DR3 lists no other star within ${from.radiusArcsec} arcseconds of it.`
      : ` Gaia DR3 lists ${map.neighbours} other ${map.neighbours === 1 ? 'star' : 'stars'} within ${from.radiusArcsec} arcseconds, with ${share}% of their light and the star's together.`;
    // The light curve is the mission's own, the one the method's paper uses.
    const curve = from.fitted(map.window), { method } = map;
    // What the published method measured, in its own terms: Reinhold & Hekker's three periods, or the method's own sentence.
    const three = method.periodsDays && method.peakHeight !== undefined ? `periodogram ${method.periodsDays[0].toFixed(2)} d, wavelet ${method.periodsDays[1].toFixed(2)} d, autocorrelation ${method.periodsDays[2].toFixed(2)} d; periodogram peak ${method.peakHeight.toFixed(2)}` : undefined;
    const judged = method.published ? ` ${method.citation} list the star as a rotator in their table (${method.published}): ${method.says}. The rotation and its period are theirs, taken as published; no criteria were applied to them here.`
      : three === undefined ? ` In this ${from.window} the method of ${method.citation} finds ${method.says}${method.wholeSays ? `, and in all ${method.read} of the star's ${from.window}s together ${method.wholeSays}` : ''}; its criteria accept that as the star's rotation.`
      : method.campaigns > 1 ? ` This ${from.window}'s three methods give its period (${three}), accepted by the criteria of ${method.citation}; the star's period is the mean of its ${method.campaigns} accepted ${from.window}s.`
      : ` The period is the mean of three methods' periods (${three}), accepted by the criteria of ${method.citation}.`;
    return { productId: `Brightness map of ${map.targetName} from its light in ${where}`,
      inputTitle: `Brightness map of ${map.targetName} from its light curve in ${where}, ${from.whose}: brightness on a longitude-latitude grid`,
      credit: `${from.credited}, ${from.window} ${map.window}, from MAST; its rotation ${method.published ? 'and period as published by' : 'judged by the criteria of'} ${method.citation}; map made in this project with ${map.codes.join(', ').replace(/, ([^,]*)$/u, ' and $1')}. ${from.acknowledgment}`, displayCredit: `NASA ${from.name} · mapped here`,
      license: 'Public NASA mission data (MAST); reduction by this project', licenseEvidence: [DATA_USE],
      acquisition: `Built by the generator for this star, from the light curve of the ${from.window} ${from.served}. Restored from the source cache; not tracked. The receipt (the ${from.window}'s request, what was measured and the codes) is written again by the generator under output/tess and is not kept in git.`,
      redistribution: `Public ${from.name} data, reduced here.`,
      description: `Brightness of the star's surface that reproduces its light as it turns once in ${turn}, fitted with starry to ${curve} (the light varies by ${swing}; the map's curve leaves a scatter of ${percent(map.residual)}%, the light's own noise being ${percent(map.noise)}%). A light curve fixes how bright each longitude is, not the latitude of what darkens it.${judged}${halved} ${tilted}${others} A reduction made in this project, not a published map.`,
      surfaceTitle: `${from.name} · brightness map made here · ${choice.label}`, qualification: `Mapped in this project · ${from.kind}, ${choice.label.toLowerCase()}`,
      notes: `Where the star's surface was darker and brighter in ${from.name} ${choice.label.toLowerCase()}, worked out in this project from how its light rose and fell by ${swing} as it turned once in ${turn}. The light curve is ${from.whose}; ${method.published ? `${method.citation} found the star's rotation in it, and starry finds the map that reproduces it at their period` : `the criteria of ${method.citation} decide that it shows the star turning, and starry finds the map that reproduces it`}. The longitudes of the dark and bright regions are fixed by the data; their latitudes are not.${halved} ${tilted}${count > 1 ? ` Step through the ${count} maps to see the spots change.` : ''}`,
      legendNote: `Darker: dimmer than the star's mean surface; white: brighter.${outline}`,
      text: { title: `Brightness map, ${choice.label}`, detail: `${choice.label}, mapped here`, summary: 'Darker and brighter longitudes of the star, worked out in this project from how its light changes as it turns.' } }; },
  // Only a page that measures the star's axis draws the star at the map's tilt.
  outlines: map => map.tiltFrom === 'page',
  // The star in its own color over its Brightness map's scale: a darker tone of its hue where it is dimmer.
  natural(map, star) { const when = monthsOf(map.fromUtc, map.toUtc), less = 100 * (1 - map.darkestPercent / map.brightestPercent), darkest = Number(less.toFixed(1)) || Number(less.toPrecision(2)), scale = brightnessScale([map]);
    const halved = map.lightPeriodDays === undefined ? '' : ` The light repeats every ${days(map.lightPeriodDays)}, half the catalogued rotation period, and the star is taken to turn once in two of them.`;
    return { id: 'color-brightness', label: 'Color + brightness', minimum: scale.minimum, maximum: scale.maximum, colors: tinted(star.colorHex), limbStrength: LIMB_STRENGTH,
      description: `The star's color (${star.colorHex}, its Color dataset) over the brightness map this project made from the star's light in ${windowName(map.mission, map.window)} (${when}): the map's scale, ${scale.minimum}% to ${scale.maximum}% of the mean surface, runs from a darker, richer tone of the same hue to the color itself. The contrast is drawn far stronger than it is, so the parts can be told apart: the darkest part gives ${darkest}% less light than the brightest. Longitudes are fixed by the light curve; latitudes and shapes are not. No color change of the spots is drawn: none is measured. A reduction made in this project, not a published map.`,
      surfaceTitle: `${MISSIONS[map.mission].name} · the star in its color over its brightness map · ${when}`, qualification: `The star's color, darker where ${MISSIONS[map.mission].name} saw it dimmer (contrast drawn stronger) · ${when}, mapped in this project`,
      notes: `${map.targetName} in its own color, darker where its light in ${MISSIONS[map.mission].name}'s images of ${when} says it was darker. As the star turned once in ${days(map.periodDays)} its light rose and fell by ${percent(map.amplitude)}%.${halved} The contrast is drawn far stronger than it is, so the eye can see it: the darkest part gives ${darkest}% less light than the brightest, and is drawn as a much darker tone of the star's own hue; the Brightness map's scale has the measured values. The longitudes of the darker and brighter parts are measured. Their latitudes and shapes are not: they are the smoothest that reproduce the light. No change of color is drawn, because none is measured. Spots come and go within weeks or months: this is the star then. The darkening toward the edge is the Color dataset's limb law, drawn ${LIMB_STRENGTH} times as strong.`,
      text: { title: `Color + brightness, ${shortMonthsOf(map.fromUtc, map.toUtc)}`, detail: windowName(map.mission, map.window), summary: 'The star in its own color, darker where its light shows it darker; the contrast is drawn stronger to be seen.' } }; },
  report(maps, scale) { const count = maps.length; return `${count} brightness ${count === 1 ? 'map' : 'maps'} on one scale of ${scale.minimum}% to ${scale.maximum}% (${maps.map(map => `${map.choice.label}: turns in ${days(map.periodDays)}, light swings ${percent(map.amplitude)}%`).join('; ')})`; },
};
