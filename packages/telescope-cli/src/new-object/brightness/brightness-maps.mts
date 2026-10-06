/** A star's brightness map, made by this repository from its TESS pixels, as a dataset of the star's page.
 *
 * `archives/tess/reduce.mts` measures a star's light from the mission's full-frame images, finds the period it turns in,
 * and has starry fit the map that reproduces the light curve; it writes the map as a table and a receipt. This module is
 * that kind of map for surface-maps.mts: where its table goes, its scale and colors, the archive and paper it is bound to,
 * and its sentences. It is pure: brightness.mts reads and writes.
 *
 * Every sentence says what the map is: made here, from a light curve, which fixes how bright each longitude is and not
 * where on it the spots lie in latitude. A map made at an assumed tilt says so. */
import { isRecord, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { scaleEnd, type MapKind, type SurfaceMap, type SurfaceMapChoice } from '../maps/surface-maps.mts';

export const BRIGHTNESS_GENERATOR = 'packages/telescope-cli/src/archives/tess/reduce.mts', BRIGHTNESS_CONSUMER = 'tess-starry', BRIGHTNESS_DIRECTORY = 'science/tess';
export const TESS_ARCHIVE = Object.freeze({ url: 'https://archive.stsci.edu/missions-and-data/tess', pixels: 'https://mast.stsci.edu/tesscut/', doi: 'https://doi.org/10.17909/0cp4-2j79',
  acknowledgment: 'This work includes data collected by the TESS mission, funded by the NASA Explorer Program, obtained from the Mikulski Archive for Space Telescopes (MAST).' });
const PIXELS_RECORD = 'mast-tess-full-frame-images', METHOD_RECORD = 'arxiv-1810-06559', METHOD_URL = 'https://arxiv.org/abs/1810.06559';
/** Gaia DR3, which says whose light the star's pixels hold: a record the source catalogue already has. */
const GAIA_RECORD = 'gaia-2023-dr3', GAIA_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/I/355';
/** Dark where the surface is dim, white where it is bright. */
const COLORS = ['#1a1a1a', '#5c5c5c', '#9c9c9c', '#d6d6d6', '#ffffff'] as const, PALETTE = [[26, 26, 26], [92, 92, 92], [156, 156, 156], [214, 214, 214], [255, 255, 255]] as const;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** The two records of the source catalogue (`src/sources`) a brightness map is bound to: the mission's full-frame images,
 * and the paper of the code that makes the map. */
export function brightnessSourceRecords(checkedOn: string): Map<string, string> {
  return new Map([[`src/sources/${PIXELS_RECORD}.json`, json({ id: PIXELS_RECORD, kind: 'data-product', identityLevel: 'work', title: 'TESS calibrated full-frame images, read as cutouts through MAST\'s TESScut service', identifiers: [{ type: 'DOI', value: '10.17909/0cp4-2j79' }],
    links: [{ role: 'archive', url: TESS_ARCHIVE.pixels, label: 'TESScut at MAST' }, { role: 'landing', url: TESS_ARCHIVE.doi, label: 'TESS calibrated full-frame images: all sectors' }],
    evidence: [{ url: TESS_ARCHIVE.pixels, checkedOn, locator: 'TESScut: the same pixels cut out of every full-frame image of a sector at one place on the sky, as a FITS cube.' }],
    relations: [], statements: [{ kind: 'credit', text: TESS_ARCHIVE.acknowledgment, scope: 'citation', evidence: TESS_ARCHIVE.url }], publisher: 'Mikulski Archive for Space Telescopes (STScI)' })],
  [`src/sources/${METHOD_RECORD}.json`, json({ id: METHOD_RECORD, kind: 'publication', identityLevel: 'work', title: 'Luger et al. (2019): starry: Analytic Occultation Light Curves',
    identifiers: [{ type: 'arXiv', value: '1810.06559' }, { type: 'DOI', value: '10.3847/1538-3881/aae8e5' }], links: [{ role: 'archive', url: METHOD_URL, label: 'arXiv preprint' }, { role: 'landing', url: 'https://doi.org/10.3847/1538-3881/aae8e5', label: 'Journal version' }],
    evidence: [{ url: METHOD_URL, checkedOn, locator: 'arXiv listing: title, authors, DOI. The paper describes starry, the code that fits a map to a light curve.' }], relations: [], statements: [{ kind: 'credit', text: 'Luger et al. (2019)', scope: 'citation', evidence: METHOD_URL }],
    creators: ['R. Luger', 'E. Agol', 'D. Foreman-Mackey', 'D. P. Fleming', 'et al.'], publicationDate: '2019' })]]);
}

/** What a map's receipt says of it, read once and checked. */
export interface BrightnessSurfaceMap extends SurfaceMap { readonly sector: number; /** The light's swing as the star turns, peak to peak, as a share of its mean. */ readonly amplitude: number;
  /** The map's own range, percent of its mean. */ readonly darkestPercent: number; readonly brightestPercent: number; /** Scatter of the light about the map's curve, and the light's noise. */ readonly residual: number; readonly noise: number;
  /** The share of the light in the star's pixels that Gaia's other stars give, and how many they are. */ readonly neighbourShare: number; readonly neighbours: number;
  /** Where the map's tilt comes from: the measured axis the page draws, the tilt the star's record works out, or none. */ readonly tiltFrom: 'page' | 'record' | 'assumed'; readonly codes: readonly string[] }

export const brightnessChoice = (star: string, sector: number): SurfaceMapChoice => ({ program: `${star}-s${String(sector).padStart(4, '0')}`, id: `brightness-sector-${sector}`, label: `Sector ${sector}` });

export function reducedBrightness(choice: SurfaceMapChoice, receipt: unknown, table: string): BrightnessSurfaceMap {
  const record = requireRecord(receipt, `${choice.program} receipt`), star = requireRecord(record.star, 'receipt star'), rotation = requireRecord(record.rotation, 'receipt rotation'), map = requireRecord(record.map, `${choice.program}: the receipt holds no map`);
  if (rotation.detected !== true) throw new Error(`${choice.program}: the star's rotation is not seen (${String(rotation.reason ?? 'no reason given')}).`);
  const toolchain = isRecord(record.toolchain) && Array.isArray(record.toolchain.requirements) ? record.toolchain.requirements.map(String) : [], lightkurve = toolchain.find(pin => pin.startsWith('lightkurve')) ?? 'lightkurve';
  const source = requireString(map.inclinationSource, 'map inclinationSource'), period = requireFiniteNumber(map.periodDays, 'map periodDays'), sector = requireFiniteNumber(map.sector, 'map sector');
  const light = requireRecord(record.light, `${choice.program}: the receipt does not say whose light the pixels hold; reduce the star again`);
  const tiltFrom = map.inclinationFrom; if (tiltFrom !== 'page' && tiltFrom !== 'record' && tiltFrom !== 'assumed') throw new TypeError(`${choice.program}: its receipt does not say where the map's tilt comes from; reduce the star again.`);
  if (map.table !== `${choice.program}.dat` || !table.includes('ZONE I=')) throw new TypeError(`${choice.program}: the receipt and the table do not describe one map.`);
  return { choice, table, targetName: requireString(star.name, 'receipt star name'), inclinationDegrees: requireFiniteNumber(map.inclinationDegrees, 'map inclination'), inclinationSource: source, periodDays: period,
    periodSource: `measured here from the star's light in TESS sector ${sector} (${BRIGHTNESS_GENERATOR})`, sector, amplitude: requireFiniteNumber(rotation.amplitude, 'rotation amplitude'), darkestPercent: requireFiniteNumber(map.darkestPercent, 'darkestPercent'),
    brightestPercent: requireFiniteNumber(map.brightestPercent, 'brightestPercent'), residual: requireFiniteNumber(map.residual, 'residual'), noise: requireFiniteNumber(map.noise, 'noise'), neighbourShare: requireFiniteNumber(light.neighbourShare, 'neighbourShare'), neighbours: requireFiniteNumber(light.neighbours, 'neighbours'), tiltFrom,
    codes: [lightkurve.replace('==', ' '), `starry ${requireString(map.starry, 'starry version')}`] };
}

export const percent = (share: number) => { const value = 100 * share; return value >= 10 ? value.toFixed(0) : value >= 1 ? value.toFixed(1) : value.toFixed(2); };
const days = (period: number) => period >= 1 ? `${Number(period.toPrecision(3))} days` : `${Number((period * 24).toPrecision(3))} hours`;

/** What is a brightness map's own in the records surface-maps.mts writes. */
export const BRIGHTNESS_MAPS: MapKind<BrightnessSurfaceMap> = {
  consumer: BRIGHTNESS_CONSUMER, directory: BRIGHTNESS_DIRECTORY, generator: BRIGHTNESS_GENERATOR, inputTag: 'tess-map', stepGroup: 'brightness', variable: 'Brightness [%]', units: '%', controlLabel: 'Brightness map', legendTitle: 'Surface brightness',
  archiveUrl: TESS_ARCHIVE.pixels, references: [{ catalogueId: PIXELS_RECORD, role: 'material', evidence: TESS_ARCHIVE.pixels }, { catalogueId: METHOD_RECORD, role: 'method', evidence: METHOD_URL }, { catalogueId: GAIA_RECORD, role: 'reference', evidence: GAIA_URL }], colors: COLORS, palette: PALETTE,
  scale(maps) { const reach = scaleEnd(Math.max(...maps.flatMap(map => [100 - map.darkestPercent, map.brightestPercent - 100]))); return { minimum: 100 - reach, maximum: 100 + reach, labels: [`${100 - reach}%`, '100%', `${100 + reach}%`] }; },
  words(map, { count, epochs, tilt, outlined }) { const { choice } = map, swing = `${percent(map.amplitude)}%`, turn = days(map.periodDays);
    const tilted = map.tiltFrom === 'assumed' ? `No tilt of this star's axis is known: the map is made at ${tilt}°, the middle tilt of axes that point at random.`
      : map.tiltFrom === 'record' ? `The map is made at a tilt of ${tilt}°, worked out from the star's rotation speed, period and radius.` : `The map is made at the tilt the page draws the star with, ${tilt}°.`;
    const outline = outlined ? ` Black line: ${tilt}° S; the star never shows us what lies below it.` : '';
    const others = map.neighbours === 0 ? 'Gaia DR3 lists no other star within 63 arcseconds of it.' : `Gaia DR3 lists ${map.neighbours} other ${map.neighbours === 1 ? 'star' : 'stars'} within 63 arcseconds, giving ${map.neighbourShare < 0.001 ? 'under 0.1' : percent(map.neighbourShare)}% of the light in the star's pixels.`;
    return { productId: `Brightness map of ${map.targetName} from its light in TESS sector ${map.sector}`,
      inputTitle: `Brightness map of ${map.targetName} from its light curve in TESS sector ${map.sector}, measured from the full-frame images: brightness on a longitude-latitude grid`,
      credit: `NASA TESS full-frame images, sector ${map.sector}, from MAST's TESScut; photometry and map made in this project with ${map.codes.join(' and ')}. ${TESS_ARCHIVE.acknowledgment}`, displayCredit: 'NASA TESS · mapped here',
      license: 'Public NASA mission data (MAST); reduction by this project', licenseEvidence: ['https://archive.stsci.edu/publishing/data-use'],
      acquisition: `Built by the generator for this star, from the pixels TESScut cuts out of the sector's full-frame images. Restored from the source cache; not tracked. The receipt (the sector's request, what was measured and the codes) is written again by the generator under output/tess and is not kept in git.`,
      redistribution: 'Public TESS data, reduced here.',
      description: `Brightness of the star's surface that reproduces its light as it turns once in ${turn}, fitted with starry to the light curve this project measured from the TESS full-frame images of sector ${map.sector} (the light swings by ${swing}; the map's curve leaves a scatter of ${percent(map.residual)}%, the light's own noise being ${percent(map.noise)}%). A light curve fixes how bright each longitude is, not the latitude of what darkens it. ${tilted} ${others} A reduction made in this project, not a published map.`,
      surfaceTitle: `TESS · brightness map made here · ${choice.label}`, qualification: `Mapped in this project · TESS full-frame images, ${choice.label.toLowerCase()}`,
      notes: `Where the star's surface was darker and brighter in TESS ${choice.label.toLowerCase()}, worked out in this project from how its light rose and fell by ${swing} as it turned once in ${turn}. The light curve is measured from the mission's images with lightkurve, and starry finds the map that reproduces it. The longitudes of the dark and bright regions are fixed by the data; their latitudes are not. ${tilted}${count > 1 ? ` Step through the ${count} maps to see the spots change.` : ''}`,
      legendNote: `Darker: dimmer than the star's mean surface; white: brighter.${outline}`,
      text: { title: `Brightness map, ${choice.label}`, detail: `${epochs}, mapped here`, summary: 'Darker and brighter longitudes of the star, worked out in this project from how its light changes as it turns.' } }; },
  // Only a page that measures the star's axis draws the star at the map's tilt.
  outlines: map => map.tiltFrom === 'page',
  report(maps, scale) { const count = maps.length; return `${count} brightness ${count === 1 ? 'map' : 'maps'} on one scale of ${scale.minimum}% to ${scale.maximum}% (${maps.map(map => `${map.choice.label}: turns in ${days(map.periodDays)}, light swings ${percent(map.amplitude)}%`).join('; ')})`; },
};
