#!/usr/bin/env node
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { VOLUME_PROVENANCE_SCHEMA } from '@cssearth/bake/volume';
import { VOLUME_SOURCE_MANIFEST_SCHEMA, VOLUME_PRESENTATION_SOURCE_SCHEMA, VOLUME_RECIPE_SCHEMA, NEBULA_DELIVERY_SCHEMA, CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA, type EdgeOnReconstruction, type CircumstellarOpacity } from '@cssearth/objects';
/** Author a circumstellar volume: the material around a star, drawn from coronagraph mosaics as a density grid attached to
 * that star, the way Betelgeuse's shell is (packages/bake/authoring/betelgeuse-shell/author.mts), but from one
 * checked-in recipe rather than a script per star.
 *
 *   node packages/telescope-cli/authoring/circumstellar/author.mts <object id> [--check] [--raw <dir>]...
 *
 * The recipe is src/objects/<id>/source/circumstellar.json. A dataset names coronagraph bands of a pinned JWST imaging program
 * (packages/telescope-cli/src/archives/jwst/programs), the star's flux in each and the red, green and blue channels they average into: the
 * reflectance color a publisher shows. Each band's MAST level-3 mosaic is downloaded into .local/<id>/observations, read about
 * the star through its own WCS (disc-envelope.mts readSkyPlane), background-subtracted and divided by the star's flux
 * (fit-figure-stretch.mts reflectanceChannels). The ring's geometry is measured on the mean of the channels, checked against
 * the published geometry the recipe cites, and the envelope that best projects to that image is fitted (disc-envelope.mts).
 * Each channel is shown through the stretch fitted to the publisher's own panel (fit-figure-stretch.mts), and the three are
 * spread along the ring with one depth profile (packages/bake/src/density/column-depth.ts spreadColumns), so a line of sight keeps
 * its color through its depth. One volume unit is one astronomical unit at the
 * star's distance; the frame is anchored on the star's prepared scene origin, so the star's sphere sits at the centre.
 *
 * --check recomputes every output and fails if any differs from the file on disk. After authoring, bake the bank
 * (node packages/bake/cli/prepare-nebulae.mts --object=<id>); the presentation names the baked bank by its path. */
import { jwstAcquisition } from './jwst-acquisition.mts';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { encodeDensityKtx2, gainForTopAlpha, spreadColumns } from '@cssearth/bake/density';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { readFitsImage } from '@cssearth/fits';
import { gunzipSync } from 'node:zlib';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { CHANNELS, reflectanceChannels, stretchOf } from './fit-figure-stretch.mts';
import { mastDownloadUrl, mastFile } from '@cssearth/telescope/node';
import { readImagingProgram } from '@cssearth/telescope-cli/archives/jwst/imaging/image3';
import { JWST_BANDS } from '@cssearth/telescope-cli/archives/jwst/imaging/bands';
import { DEFAULT_SEARCH, discDensity, fitDiscEnvelope, profileDiscDensity, readArrayPlane, scoreEnvelope, readSkyPlane, ringGeometry, type RingGeometry, type SkyPlane } from './disc-envelope.mts';
import { midplaneGeometry, registerStarByPlanet, type MidplaneGeometry, type PlanetRegistration } from './edge-on-disc.mts';
import { hostedPlanetStateRelativeKm, PARSEC_KM, skyBasis, starAstrometry } from '@cssearth/astronomy';

const METERS_PER_PARSEC = 3.085677581491367e16;
const repositoryRoot = checkoutProjectRoot(import.meta.url);

export interface CircumstellarDataset {
  readonly id: string; readonly label: string; readonly title: string; readonly summary: string; readonly description: string;
  /** The pinned JWST imaging program the bands come from, or '' when the dataset reads an author's deposited image instead. */
  readonly program: string;
  /** An author's reduced image deposited with its paper, read in place of a MAST mosaic: no sky coordinates, so the recipe states
   * the star's pixel, the plate scale and the orientation (disc-envelope.mts readArrayPlane). Its one band feeds every channel. */
  readonly deposit?: {
    readonly band: string; readonly path: string; readonly url: string; readonly landing: string; readonly bytes: number;
    readonly pixelArcsec: number; readonly orientation: 'north-up-east-left'; readonly starPixel: 'array-centre'; readonly orientationSource: string;
    readonly unit: string; readonly filter: string; readonly instrument: string; readonly observed: string;
    readonly title: string; readonly credit: string; readonly displayCredit: string; readonly license: string; readonly acquisition: string;
  };
  /** An archive image with its own sky coordinates, named by its path and origin: an ALMA pipeline continuum image, read through its WCS (SIN or
   * TAN) from its primary HDU. The star is the host's catalogue position moved by its proper motion to the image's DATE-OBS. Its one
   * band feeds every channel; it is not divided by the star, whose light is not in it. */
  readonly archive?: {
    readonly band: string; readonly path: string; readonly url: string; readonly landing: string; readonly bytes: number;
    readonly unit: string; readonly filter: string; readonly instrument: string; readonly observed: string;
    readonly title: string; readonly credit: string; readonly displayCredit: string; readonly license: string; readonly acquisition: string;
    /** The same product's primary beam, gzipped FITS on the image's own pixels: the image is multiplied by it, undoing the
     * primary-beam correction, when the publisher shows the image uncorrected. */
    readonly primaryBeam?: { readonly path: string; readonly url: string; readonly bytes: number; readonly title: string; readonly source: string };
  };
  /** Archive image only: the publisher's restoring beam, which the image is smoothed to (disc-envelope.mts smoothToBeam) so it is
   * shown at the resolution of the published figure and in its Jy per beam. */
  readonly smoothTo?: { readonly beamArcsec: readonly [number, number]; readonly positionAngleDeg: number; readonly source: string };
  /** Archive image only: unresolved sources the paper models as points, removed as the image's own beam at their published
   * positions and peaks (disc-envelope.mts subtractPointSources), so a background source is not drawn as the disc's material. */
  readonly pointSources?: { readonly sources: readonly { readonly id: string; readonly raDeg: number; readonly decDeg: number; readonly peak: number }[]; readonly source: string };
  /** The publisher's own color map, shown in place of a stretch: the figure's color bar, sampled evenly from `range[0]` to
   * `range[1]` in the image's unit times `unitScale`, as the recipe's `path` (under source/) holds it with how it was read. */
  readonly colorMap?: { readonly path: string; readonly range: readonly [number, number]; readonly unitScale: number; readonly unit: string; readonly source: string };
  /** Hubble coronagraph images made here: the drizzled products of a PSF subtraction (packages/telescope-cli/src/archives/hst/psf-subtract.mts), two
   * telescope rolls per band averaged on the sky, each band divided by the star's own count rate in it, which is computed from
   * a published Vega magnitude and the instrument's published zero point. The products are named by roll and size; the run
   * that made them is reproducible from the raw exposures its program names. */
  readonly hst?: {
    readonly subtraction: string; readonly work: string;
    readonly products: Readonly<Record<string, readonly { readonly roll: string; readonly bytes: number }[]>>;
    readonly vegaMagnitudes: Readonly<Record<string, number>>; readonly vegaZeropoints: Readonly<Record<string, number>>; readonly zeropointSource: string;
    readonly instrument: string; readonly observed: string; readonly landing: string; readonly credit: string; readonly displayCredit: string; readonly license: string;
  };
  /** What the images show: a ring seen near face-on, whose ridge ellipse gives its geometry, or a disc seen edge-on, whose
   * midplane gives its position angle and whose inclination and depth are fitted (edge-on-disc.mts). */
  readonly geometry: 'ring' | 'edge-on';
  /** Edge-on only: the half height of the strip about the midplane the geometry is measured in, in units. */
  readonly midplaneHalfHeightUnits?: number;
  /** Where the star is in each mosaic: its target position (the default), or found from a planet of the host whose orbit is
   * known, searched for within `searchArcsec` of its prediction with the band's PSF width (edge-on-disc.mts registerStarByPlanet). */
  readonly registration?: { readonly planet: string; readonly searchArcsec: number; readonly fwhmArcsec: Readonly<Record<string, number>>; readonly source: string };
  /** A display fade, stated: every channel of a column is scaled from 0 to 1 as the mean of the channels rises from the first to
   * the second multiple of its per-pixel noise, so empty sky is not drawn and no color ratio changes. */
  readonly noiseFade?: { readonly fromNoise: number; readonly toNoise: number; readonly source: string };
  /** The coronagraph bands each display channel averages, longest wavelengths red. */
  readonly channels: Readonly<Record<(typeof CHANNELS)[number], readonly string[]>>;
  /** The star's flux in each band, which each band is divided by to give reflectance; and where it is published. For an HST
   * dataset it is the star's count rate in electrons per second, computed from `hst`, and the bands are in millions of electrons
   * per second per steradian, so the quotient is in the same units as a JWST dataset's MJy/sr per Jy. */
  readonly stellarFluxJy: Readonly<Record<string, number>>; readonly stellarFluxSource: string;
  /** The display stretch, log(1 + a u) / log(1 + a) with u = reflectance / top, fitted to the publisher's panel. */
  readonly stretch?: { readonly a: number; readonly top: number; readonly source: string; readonly fit?: Record<string, unknown> };
  /** Inside this radius the coronagraph mask holds the star and the image is not data; the source of the number. */
  readonly innerMaskArcsec: number; readonly innerMaskSource: string;
  /** The ring's annulus, in units, scored out to `outerUnits`. The image is drawn to the grid edge, tapering from where its
   * deprojected median brightness falls to the per-pixel noise, which the author measures. */
  readonly outerUnits: number;
  readonly backgroundAnnulusArcsec: readonly [number, number];
  /** Conventions, stated: which end of the minor axis is nearer the observer, and the ring's vertical height as a fraction of its
   * radius (a ring only: an edge-on disc's height is fitted, and this is 0), and the published model it comes from, when one gives it. */
  readonly nearSidePositionAngleDeg: number; readonly nearSideSource: string; readonly heightOfRadius: number; readonly heightSource?: string;
  /** A ring only: why its geometry is the published fit rather than measured on the image, when the image's ridge is too faint to
   * trace. The paper's fit must be to the same observations. */
  readonly adoptPublishedRing?: string;
  /** Why this dataset's image is drawn only to the grid's edge, when its light reaches past it. Stated, and kept as a limitation. */
  readonly beyondGrid?: string;
  /** The alpha the brightest column reaches. */
  readonly topAlpha: number;
  /** The published geometry the measured ring is checked against. */
  readonly published: { readonly citation: string; readonly url: string; readonly radiusUnits?: number; readonly widthFwhmUnits?: number; readonly inclinationDeg: number; readonly positionAngleDeg: number; readonly toleranceDeg: number; readonly radiusTolerance?: number };
}
export interface CircumstellarRecipe {
  readonly schema: 'cssearth-circumstellar-volume@2';
  readonly id: string; readonly host: string; readonly name: string; readonly description: string; readonly sourceUrl: string;
  readonly credit: string; readonly license: { readonly spdx: string; readonly note: string; readonly url: string };
  readonly grid: { readonly size: number; readonly halfUnits: number; readonly slabs: number };
  readonly defaultDataset: string;
  readonly datasets: readonly CircumstellarDataset[];
}
export function parseCircumstellarRecipe(value: unknown): CircumstellarRecipe {
  const row = requireRecord(value, 'circumstellar recipe');
  if (row.schema !== 'cssearth-circumstellar-volume@2') throw new TypeError('Unsupported circumstellar recipe.');
  const grid = requireRecord(row.grid, 'grid'), license = requireRecord(row.license, 'license');
  const datasets = requireArray(row.datasets).map(raw => {
    const dataset = requireRecord(raw, 'dataset'), published = requireRecord(dataset.published, 'published geometry'), annulus = requireArray(dataset.backgroundAnnulusArcsec);
    const number = (key: string, from: Record<string, unknown> = dataset) => requireFiniteNumber(from[key], key);
    const channelRecord = requireRecord(dataset.channels, 'channels'), fluxRecord = requireRecord(dataset.stellarFluxJy, 'stellar fluxes');
    const deposit = dataset.deposit === undefined ? undefined : (() => {
      const d = requireRecord(dataset.deposit, 'deposit'), text = (key: string) => requireString(d[key], `deposit ${key}`);
      if (d.orientation !== 'north-up-east-left' || d.starPixel !== 'array-centre') throw new TypeError('A deposit states north-up-east-left and an array-centre star.');
      if (d.sha256 !== undefined) throw new TypeError(`${String(dataset.id)}: a deposit is named by its path and origin, not pinned by a hash (CLAUDE.md, sources and prepared delivery).`);
      return { band: text('band'), path: text('path'), url: text('url'), landing: text('landing'), bytes: requireFiniteNumber(d.bytes, 'deposit bytes'),
        pixelArcsec: requireFiniteNumber(d.pixelArcsec, 'deposit pixelArcsec'), orientation: 'north-up-east-left' as const, starPixel: 'array-centre' as const,
        orientationSource: text('orientationSource'), unit: text('unit'), filter: text('filter'), instrument: text('instrument'), observed: text('observed'),
        title: text('title'), credit: text('credit'), displayCredit: text('displayCredit'), license: text('license'), acquisition: text('acquisition') };
    })();
    const hst = dataset.hst === undefined ? undefined : (() => {
      const h = requireRecord(dataset.hst, 'hst'), text = (key: string) => requireString(h[key], `hst ${key}`);
      const numbers = (key: string) => Object.fromEntries(Object.entries(requireRecord(h[key], `hst ${key}`)).map(([band, v]) => [band, requireFiniteNumber(v, `${key} ${band}`)]));
      const products = Object.fromEntries(Object.entries(requireRecord(h.products, 'hst products')).map(([band, list]) => [band, requireArray(list).map(v => {
        const r = requireRecord(v, 'hst product');
        if (r.sha256 !== undefined) throw new TypeError(`${String(dataset.id)} ${band}: a product is named by its roll and size, not pinned by a hash.`);
        return { roll: requireString(r.roll), bytes: requireFiniteNumber(r.bytes) };
      })]));
      return { subtraction: text('subtraction'), work: text('work'), products, vegaMagnitudes: numbers('vegaMagnitudes'), vegaZeropoints: numbers('vegaZeropoints'), zeropointSource: text('zeropointSource'),
        instrument: text('instrument'), observed: text('observed'), landing: text('landing'), credit: text('credit'), displayCredit: text('displayCredit'), license: text('license') };
    })();
    const archive = dataset.archive === undefined ? undefined : (() => {
      const a = requireRecord(dataset.archive, 'archive'), text = (key: string) => requireString(a[key], `archive ${key}`);
      if (a.sha256 !== undefined) throw new TypeError(`${String(dataset.id)}: an archive image is named by its path and origin, not pinned by a hash (CLAUDE.md, sources and prepared delivery).`);
      const beam = a.primaryBeam === undefined ? undefined : (() => { const b = requireRecord(a.primaryBeam, 'archive primaryBeam'), field = (key: string) => requireString(b[key], `archive primaryBeam ${key}`);
        return { path: field('path'), url: field('url'), bytes: requireFiniteNumber(b.bytes, 'archive primaryBeam bytes'), title: field('title'), source: field('source') }; })();
      return { band: text('band'), path: text('path'), url: text('url'), landing: text('landing'), bytes: requireFiniteNumber(a.bytes, 'archive bytes'),
        unit: text('unit'), filter: text('filter'), instrument: text('instrument'), observed: text('observed'), title: text('title'), credit: text('credit'),
        displayCredit: text('displayCredit'), license: text('license'), acquisition: text('acquisition'), ...(beam ? { primaryBeam: beam } : {}) };
    })();
    const pointSources = dataset.pointSources === undefined ? undefined : (() => {
      const p = requireRecord(dataset.pointSources, 'pointSources');
      if (!archive) throw new TypeError(`${String(dataset.id)}: point sources are subtracted from an archive image only.`);
      const sources = requireArray(p.sources).map(raw => { const q = requireRecord(raw, 'point source');
        return { id: requireString(q.id, 'point source id'), raDeg: requireFiniteNumber(q.raDeg, 'point source raDeg'), decDeg: requireFiniteNumber(q.decDeg, 'point source decDeg'), peak: requireFiniteNumber(q.peak, 'point source peak') }; });
      if (!sources.length) throw new TypeError(`${String(dataset.id)}: pointSources lists no source.`);
      return { sources, source: requireString(p.source, 'pointSources source') };
    })();
    const smoothTo = dataset.smoothTo === undefined ? undefined : (() => {
      const m = requireRecord(dataset.smoothTo, 'smoothTo'), beam = requireArray(m.beamArcsec).map(v => requireFiniteNumber(v, 'smoothTo beamArcsec'));
      if (!archive) throw new TypeError(`${String(dataset.id)}: only an archive image is smoothed to a publisher's beam.`);
      if (beam.length !== 2 || !(beam[0]! >= beam[1]! && beam[1]! > 0)) throw new TypeError(`${String(dataset.id)}: smoothTo beamArcsec is [major, minor], not ${beam.join(', ')}.`);
      return { beamArcsec: [beam[0]!, beam[1]!] as const, positionAngleDeg: requireFiniteNumber(m.positionAngleDeg, 'smoothTo positionAngleDeg'), source: requireString(m.source, 'smoothTo source') };
    })();
    const colorMap = dataset.colorMap === undefined ? undefined : (() => {
      const c = requireRecord(dataset.colorMap, 'colorMap'), range = requireArray(c.range).map(v => requireFiniteNumber(v, 'colorMap range'));
      if (range.length !== 2 || !(range[1]! > range[0]!)) throw new TypeError(`${String(dataset.id)}: a color map runs from a lower to a higher value, not ${range.join(', ')}.`);
      const unitScale = requireFiniteNumber(c.unitScale, 'colorMap unitScale'); if (!(unitScale > 0)) throw new TypeError(`${String(dataset.id)}: colorMap unitScale ${unitScale} is not positive.`);
      return { path: requireString(c.path, 'colorMap path'), range: [range[0]!, range[1]!] as const, unitScale, unit: requireString(c.unit, 'colorMap unit'), source: requireString(c.source, 'colorMap source') };
    })();
    if ([deposit, hst, archive].filter(Boolean).length > 1) throw new TypeError(`${String(dataset.id)}: a dataset reads one of a deposit, HST products or an archive image.`);
    const single = deposit ?? archive;
    const channels = Object.fromEntries(CHANNELS.map(channel => {
      const bands = requireArray(channelRecord[channel]).map(band => requireString(band));
      if (!bands.length) throw new TypeError(`The ${channel} channel names no band.`);
      if (hst) {
        for (const band of bands) if (!hst.products[band]?.length || !(hst.vegaMagnitudes[band] !== undefined && hst.vegaZeropoints[band] !== undefined)) throw new TypeError(`${band}: an HST band names its products, its magnitude and its zero point.`);
        return [channel, bands];
      }
      if (single) { if (bands.some(band => band !== single.band)) throw new TypeError(`${channel}: a ${deposit ? 'deposit' : 'archive'} dataset reads only its band ${single.band}.`); return [channel, bands]; }
      for (const band of bands) {
        if (!Object.hasOwn(JWST_BANDS, band) || !JWST_BANDS[band]!.coronagraph) throw new TypeError(`${band} is not a coronagraph band.`);
        if (!(requireFiniteNumber(fluxRecord[band], `${band} stellar flux`) > 0)) throw new TypeError(`${band}: the stellar flux is positive.`);
      }
      return [channel, bands];
    })) as unknown as CircumstellarDataset['channels'];
    if (colorMap && dataset.stretch !== undefined) throw new TypeError(`${String(dataset.id)}: a dataset shows a color map or a stretch, not both.`);
    const stretchRecord = colorMap ? undefined : requireRecord(dataset.stretch, 'stretch');
    const geometry: 'ring' | 'edge-on' = dataset.geometry === undefined || dataset.geometry === 'ring' ? 'ring' : dataset.geometry === 'edge-on' ? 'edge-on' : (() => { throw new TypeError(`${String(dataset.id)}: geometry is 'ring' or 'edge-on'.`); })();
    // A ring's stretch is fitted to the publisher's panel; a stretch with no panel to fit states where its top comes from instead.
    const stretch = stretchRecord && { a: number('a', stretchRecord), top: number('top', stretchRecord), source: requireString(stretchRecord.source), ...(stretchRecord.fit === undefined ? {} : { fit: requireRecord(stretchRecord.fit, 'stretch fit') }) };
    if (stretch && !(stretch.a > 0 && stretch.top > 0)) throw new TypeError('Invalid display stretch.');
    // A ring is shown as its publisher shows it: through a stretch fitted to the published panel, or through the panel's own color map.
    if (geometry === 'ring' && stretch && stretch.fit === undefined) throw new TypeError(`${String(dataset.id)}: a ring's stretch is fitted to the published panel.`);
    return { id: requireString(dataset.id, 'dataset id'), label: requireString(dataset.label), title: requireString(dataset.title), summary: requireString(dataset.summary), description: requireString(dataset.description),
      program: deposit || hst || archive ? '' : requireString(dataset.program), ...(deposit ? { deposit } : {}), ...(hst ? { hst } : {}), ...(archive ? { archive } : {}), ...(pointSources ? { pointSources } : {}), ...(smoothTo ? { smoothTo } : {}), ...(colorMap ? { colorMap } : {}), geometry, ...(dataset.midplaneHalfHeightUnits === undefined ? {} : { midplaneHalfHeightUnits: number('midplaneHalfHeightUnits') }),
      ...(dataset.registration === undefined ? {} : { registration: (() => { const r = requireRecord(dataset.registration, 'registration'), f = requireRecord(r.fwhmArcsec, 'registration fwhm');
        return { planet: requireString(r.planet), searchArcsec: requireFiniteNumber(r.searchArcsec), fwhmArcsec: Object.fromEntries(Object.entries(f).map(([band, v]) => [band, requireFiniteNumber(v)])), source: requireString(r.source) }; })() }),
      ...(dataset.noiseFade === undefined ? {} : { noiseFade: (() => { const r = requireRecord(dataset.noiseFade, 'noise fade'), from = requireFiniteNumber(r.fromNoise), to = requireFiniteNumber(r.toNoise);
        if (!(from >= 0 && to > from)) throw new TypeError('The noise fade rises from a lower to a higher multiple of the noise.');
        return { fromNoise: from, toNoise: to, source: requireString(r.source) }; })() }),
      // An HST band's star is its count rate, 10^(0.4 (zero point - magnitude)) electrons per second.
      channels, stellarFluxJy: (single ? { [single.band]: 1 } : hst ? Object.fromEntries(Object.keys(hst.products).map(band => [band, 10 ** (0.4 * (hst.vegaZeropoints[band]! - hst.vegaMagnitudes[band]!))])) : fluxRecord) as Record<string, number>, stellarFluxSource: requireString(dataset.stellarFluxSource), ...(stretch ? { stretch } : {}),
      innerMaskArcsec: number('innerMaskArcsec'), innerMaskSource: requireString(dataset.innerMaskSource),
      outerUnits: number('outerUnits'), backgroundAnnulusArcsec: [requireFiniteNumber(annulus[0]), requireFiniteNumber(annulus[1])] as const,
      nearSidePositionAngleDeg: number('nearSidePositionAngleDeg'), nearSideSource: requireString(dataset.nearSideSource),
      // A ring's thickness is stated, from a published model or as a convention; an edge-on disc's is fitted, so its recipe states none.
      heightOfRadius: geometry === 'ring' ? number('heightOfRadius') : 0,
      ...(dataset.heightSource === undefined ? {} : { heightSource: requireString(dataset.heightSource) }),
      ...(dataset.adoptPublishedRing === undefined ? {} : { adoptPublishedRing: requireString(dataset.adoptPublishedRing) }),
      topAlpha: number('topAlpha'),
      ...(dataset.beyondGrid === undefined ? {} : { beyondGrid: requireString(dataset.beyondGrid) }),
      published: { citation: requireString(published.citation), url: requireString(published.url), inclinationDeg: number('inclinationDeg', published),
        positionAngleDeg: number('positionAngleDeg', published), toleranceDeg: number('toleranceDeg', published),
        // A ring's published radius is checked against the ridge; an edge-on disc's image gives no radius to check.
        ...(geometry === 'ring' ? { radiusUnits: number('radiusUnits', published), radiusTolerance: number('radiusTolerance', published) } : {}),
        // The ring's radial width, full width at half maximum, taken with its geometry when the recipe adopts the published ring.
        ...(published.widthFwhmUnits === undefined ? {} : { widthFwhmUnits: number('widthFwhmUnits', published) }) } };
  });
  if (!datasets.length || new Set(datasets.map(dataset => dataset.id)).size !== datasets.length) throw new TypeError('Datasets need distinct ids.');
  for (const dataset of datasets) if (dataset.deposit) DEPOSIT_FILTERS.set(dataset.deposit.band, dataset.deposit.band.toLowerCase().replace(/^[a-z]+-/u, ''));
  for (const dataset of datasets) if (dataset.archive) DEPOSIT_FILTERS.set(dataset.archive.band, dataset.archive.band.toLowerCase().replace(/^[a-z]+-/u, ''));
  for (const dataset of datasets) for (const band of Object.keys(dataset.hst?.products ?? {})) DEPOSIT_FILTERS.set(band, hstFilter(band));
  const defaultDataset = requireString(row.defaultDataset);
  if (!datasets.some(dataset => dataset.id === defaultDataset)) throw new TypeError('The default dataset is not one of the datasets.');
  for (const dataset of datasets) if (!(dataset.outerUnits <= requireFiniteNumber(grid.halfUnits) && dataset.topAlpha > 0 && dataset.topAlpha < 1 && (dataset.geometry === 'edge-on' || dataset.heightOfRadius > 0)))
    throw new TypeError(`${dataset.id}: scoring ends inside the grid, and the top alpha lies in (0, 1).`);
  return { schema: row.schema, id: requireString(row.id), host: requireString(row.host), name: requireString(row.name), description: requireString(row.description), sourceUrl: requireString(row.sourceUrl),
    credit: requireString(row.credit), license: { spdx: requireString(license.spdx), note: requireString(license.note), url: requireString(license.url) },
    grid: { size: requireFiniteNumber(grid.size), halfUnits: requireFiniteNumber(grid.halfUnits), slabs: requireFiniteNumber(grid.slabs) }, defaultDataset, datasets };
}

const compass = (positionAngleDeg: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((positionAngleDeg % 360) + 360) % 360 / 45) % 8]!;
const smoothstep = (a: number, b: number, t: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** Filters of deposit bands, registered as recipes are parsed: a deposit's band is not a JWST band. */
const DEPOSIT_FILTERS = new Map<string, string>();
const filterOf = (band: string): string => {
  const filter = JWST_BANDS[band]?.filter ?? DEPOSIT_FILTERS.get(band);
  if (!filter) throw new TypeError(`${band} has no imaging filter.`);
  return filter;
};
/** One manifest input per band a dataset reads, or per telescope roll of an HST band. */
const inputIdOf = (dataset: CircumstellarDataset, band: string) => `${dataset.id}-${filterOf(band).toLowerCase()}`;
const inputOf = (dataset: CircumstellarDataset, band: BandRead) => band.inputId ?? inputIdOf(dataset, band.band);
/** An HST band's filter, the last part of its name (HST-ACS-HRC-F435W is F435W), as the PSF subtraction names its bands. */
function hstFilter(band: string) { const filter = band.split('-').at(-1)!; if (!/^F\d{3,4}[A-Z]+$/u.test(filter)) throw new TypeError(`${band} names no HST filter.`); return filter; }

/** One dataset: its bands read as reflectance, the ring measured on their mean and checked, the envelope fitted, the colors spread
 * along it. */
/** Where a band's image comes from, as the manifest, provenance and presentation cite it. */
interface BandOrigin { readonly file: string; readonly url: string; readonly bytes: number; readonly title: string; readonly credit: string; readonly displayCredit: string;
  readonly license: string; readonly acquisition: string; readonly role: string; readonly landing: string; readonly observed: string; readonly instrument: string }
type BandRead = { band: string; mosaic: string; primary: Record<string, unknown>; sky: SkyPlane; origin: BandOrigin; inputId?: string };

/** An HST dataset's bands: each roll's drizzled PSF-subtracted product, checked by size, read about the star where the subtraction
 * found it, put in millions of electrons per second per steradian and averaged over the rolls on the sky. A pixel one roll
 * leaves blank (the occulting finger turns with the telescope) takes the other roll's value. */
export async function hstChannels(dataset: CircumstellarDataset, distancePc: number, halfUnits: number, size: number, bands: BandRead[]) {
  const hst = dataset.hst!, output = resolve(repositoryRoot, hst.work, 'psf-subtracted'), resultPath = resolve(output, `${hst.subtraction}.json`);
  const result = requireRecord(JSON.parse(await readFile(resultPath, 'utf8').catch(() => { throw new Error(`${dataset.id}: no PSF subtraction in ${hst.work}; run node packages/telescope-cli/src/archives/hst/psf-subtract.mts ${hst.subtraction} ${hst.work}`); })) as unknown);
  const rows = requireArray(result.results).map(v => requireRecord(v, 'subtraction result'));
  const perSteradian = (sky: SkyPlane) => (206264.80624709636 / sky.mosaicArcsecPerPixel) ** 2 / 1e6, planes = new Map<string, SkyPlane>();
  for (const [band, products] of Object.entries(hst.products)) {
    const filter = hstFilter(band), rolls: SkyPlane[] = [];
    for (const product of products) {
      const name = `${hst.subtraction}-${filter.toLowerCase()}-roll${product.roll}_drz.fits`, file = resolve(output, name);
      const bytes = (await stat(file).catch(() => { throw new Error(`${dataset.id}: ${name} is missing from ${hst.work}; run node packages/telescope-cli/src/archives/hst/psf-subtract.mts ${hst.subtraction} ${hst.work}`); })).size;
      if (bytes !== product.bytes) throw new Error(`${dataset.id}: ${name} is ${bytes} bytes, not the ${product.bytes} the recipe names.`);
      const row = rows.find(other => other.band === filter && other.roll === product.roll);
      if (!row) throw new Error(`${dataset.id}: the subtraction record has no ${filter} roll ${product.roll}.`);
      const [starRaDeg, starDecDeg] = requireArray(row.starRaDecDeg).map(v => requireFiniteNumber(v)) as [number, number];
      const sky = await readSkyPlane(file, { starRaDeg, starDecDeg, arcsecPerUnit: 1 / distancePc, halfUnits, size, backgroundAnnulusArcsec: dataset.backgroundAnnulusArcsec });
      const primary = (await readFitsFileHdus(file))[0]!.header;
      rolls.push(sky);
      bands.push({ band, inputId: `${dataset.id}-${filter.toLowerCase()}-roll${product.roll}`, mosaic: file, primary, sky,
        origin: { file: name, url: hst.landing, bytes: product.bytes, title: `HST programme ${hst.subtraction.replace(/^.*-/u, '')} · ACS/HRC ${filter}, roll ${product.roll}, PSF-subtracted and drizzled here`,
          credit: hst.credit, displayCredit: hst.displayCredit, license: hst.license,
          acquisition: `Made here: node packages/telescope-cli/src/archives/hst/psf-subtract.mts ${hst.subtraction} ${hst.work} recalibrates the raw exposures pinned in packages/telescope-cli/src/archives/hst/programs/${hst.subtraction.replace(/-\d+$/u, '')}-${hst.subtraction.replace(/^.*-/u, '')}.json with calacs, subtracts the reference star as packages/telescope-cli/src/archives/hst/programs/${hst.subtraction}.psf-subtraction.json states, and drizzles the result north up; its product record is beside it.`,
          role: `${hst.instrument} ${filter} image of roll ${product.roll}, PSF-subtracted and drizzled here, the ${dataset.id} leaves`, landing: hst.landing, observed: hst.observed, instrument: hst.instrument } });
    }
    const plane = Float32Array.from(rolls[0]!.plane, (_, p) => {
      const values = rolls.map(roll => roll.plane[p]! * perSteradian(roll)).filter(Number.isFinite);
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
    });
    planes.set(band, { ...rolls[0]!, plane, noise: Math.hypot(...rolls.map(roll => roll.noise * perSteradian(roll))) / rolls.length, unit: 'millions of electrons per second per steradian' });
  }
  const channels = CHANNELS.map(channel => Float32Array.from({ length: size * size }, (_, p) =>
    dataset.channels[channel].reduce((total, band) => total + planes.get(band)!.plane[p]! / dataset.stellarFluxJy[band]!, 0) / dataset.channels[channel].length));
  return { channels, planes };
}

/** The ring a paper fitted to the same observations, as a ridge ellipse centred on the star: used when the image's ridge is too
 * faint to trace, so there are no ridge samples and no binning spread. */
function publishedRing(published: CircumstellarDataset['published']): RingGeometry {
  const radius = published.radiusUnits!, inclination = published.inclinationDeg;
  return { ridge: [], centreUnits: [0, 0], semiMajorUnits: radius, semiMinorUnits: radius * Math.cos(inclination * Math.PI / 180),
    positionAngleDeg: ((published.positionAngleDeg % 180) + 180) % 180, inclinationDeg: inclination, ridgeResidualUnits: 0,
    binningSpread: { semiMajorUnits: 0, inclinationDeg: 0, positionAngleDeg: 0 } };
}

async function buildDataset(recipe: CircumstellarRecipe, dataset: CircumstellarDataset, distancePc: number, downloads: string, sources: readonly string[], inputsOnly = false) {
  const { size, halfUnits } = recipe.grid, count = size * size, step = 2 * halfUnits / size, innerMaskUnits = dataset.innerMaskArcsec * distancePc;
  const registrations = new Map<string, PlanetRegistration>();
  if (dataset.colorMap) COLOR_MAPS.set(dataset, parseFigureColorMap(JSON.parse(await readFile(resolve(repositoryRoot, 'src/objects', recipe.id, 'source', dataset.colorMap.path), 'utf8')) as unknown, dataset.colorMap.path).rgb);
  const starPosition = dataset.registration ? async (band: string, mosaic: string, primary: Record<string, unknown>) => {
    const registration = dataset.registration!, fwhm = registration.fwhmArcsec[band];
    if (!(fwhm! > 0)) throw new Error(`${dataset.id}: no PSF width for ${band}.`);
    // The planet's offset from its star at mid-exposure, from its hosted orbit, projected on the sky at the star.
    const middle = (requireFiniteNumber(primary.EXPSTART, 'EXPSTART') + requireFiniteNumber(primary.EXPEND, 'EXPEND')) / 2;
    const { positionKm, hostId } = hostedPlanetStateRelativeKm(registration.planet as Parameters<typeof hostedPlanetStateRelativeKm>[0], middle + 2400000.5);
    if (hostId !== recipe.host) throw new Error(`${registration.planet} orbits ${hostId}, not ${recipe.host}.`);
    const host = starAstrometry(hostId as Parameters<typeof starAstrometry>[0]), { east, north } = skyBasis(host.rightAscensionDegrees, host.declinationDegrees);
    const toArcsec = (axis: readonly number[]) => (positionKm[0] * axis[0]! + positionKm[1] * axis[1]! + positionKm[2] * axis[2]!) / (host.distanceParsecs * PARSEC_KM) * 206264.80624709636;
    const found = await registerStarByPlanet(mosaic, primary, [toArcsec(east), toArcsec(north)], { searchArcsec: registration.searchArcsec, fwhmArcsec: fwhm! });
    registrations.set(band, found);
    return found.starRaDecDeg;
  } : undefined;
  const bands: BandRead[] = [];
  let read: { channels: Float32Array[]; planes: Map<string, SkyPlane> };
  if (dataset.deposit) {
    // An author's deposited image, read about the stated star pixel with the stated scale and orientation.
    const deposit = dataset.deposit, file = resolve(repositoryRoot, deposit.path);
    const bytes = (await stat(file).catch(() => { throw new Error(`${dataset.id}: ${deposit.path} is missing; download it from ${deposit.url}.`); })).size;
    if (bytes !== deposit.bytes) throw new Error(`${dataset.id}: ${deposit.path} is ${bytes} bytes, not the ${deposit.bytes} the recipe names; download it again from ${deposit.url}.`);
    const plane = await readArrayPlane(file, { pixelArcsec: deposit.pixelArcsec, orientation: deposit.orientation, starPixel: deposit.starPixel, arcsecPerUnit: 1 / distancePc, halfUnits, size, backgroundAnnulusArcsec: dataset.backgroundAnnulusArcsec });
    read = { channels: CHANNELS.map(() => Float32Array.from(plane.plane)), planes: new Map([[deposit.band, plane]]) };
    bands.push({ band: deposit.band, mosaic: file, primary: { 'DATE-OBS': deposit.observed }, sky: plane,
      origin: { file: deposit.path.replace(/^.*\//u, ''), url: deposit.url, bytes: deposit.bytes, title: deposit.title, credit: deposit.credit, displayCredit: deposit.displayCredit, license: deposit.license,
        acquisition: deposit.acquisition, role: `${deposit.instrument} ${deposit.filter} image deposited with its paper, the ${dataset.id} leaves`, landing: deposit.landing, observed: deposit.observed, instrument: deposit.instrument } });
  } else if (dataset.archive) {
    // An archive image with its own sky coordinates, read through its WCS about the star where its catalogue position and
    // proper motion put it on the day of the observation.
    const archive = dataset.archive, file = resolve(repositoryRoot, archive.path), { size: bytes } = await stat(file).catch(() => { throw new Error(`${dataset.id}: ${archive.path} is missing; download it from ${archive.url}.`); });
    if (bytes !== archive.bytes) throw new Error(`${dataset.id}: ${archive.path} is ${bytes} bytes, not the ${archive.bytes} the recipe names; download it again from ${archive.url}.`);
    const primary = (await readFitsFileHdus(file))[0]!.header, observed = requireString(primary['DATE-OBS'], `${archive.path} DATE-OBS`);
    const host = starAstrometry(recipe.host as Parameters<typeof starAstrometry>[0]);
    const years = (Date.parse(`${observed}Z`) - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000) + 2000 - host.positionEpochJulianYear;
    if (!Number.isFinite(years)) throw new Error(`${dataset.id}: ${archive.path} DATE-OBS ${observed} is not a date.`);
    const starDecDeg = host.declinationDegrees + host.properMotionDecMasPerYear * years / 3.6e6;
    const starRaDeg = host.rightAscensionDegrees + host.properMotionRaMasPerYear * years / 3.6e6 / Math.cos(host.declinationDegrees * Math.PI / 180);
    const primaryBeam = archive.primaryBeam ? await (async () => {
      const beam = archive.primaryBeam!, packed = await readFile(resolve(repositoryRoot, beam.path)).catch(() => { throw new Error(`${dataset.id}: ${beam.path} is missing; download it from ${beam.url}.`); });
      if (packed.byteLength !== beam.bytes) throw new Error(`${dataset.id}: ${beam.path} is ${packed.byteLength} bytes, not the ${beam.bytes} the recipe names; download it again from ${beam.url}.`);
      return readFitsImage(beam.path.endsWith('.gz') ? gunzipSync(packed) : packed).values;
    })() : undefined;
    const plane = await readSkyPlane(file, { starRaDeg, starDecDeg, arcsecPerUnit: 1 / distancePc, halfUnits, size, backgroundAnnulusArcsec: dataset.backgroundAnnulusArcsec, imageHdu: 'primary',
      ...(dataset.pointSources ? { pointSources: dataset.pointSources.sources } : {}), ...(primaryBeam ? { primaryBeam } : {}),
      ...(dataset.smoothTo ? { smoothTo: { majorArcsec: dataset.smoothTo.beamArcsec[0], minorArcsec: dataset.smoothTo.beamArcsec[1], positionAngleDeg: dataset.smoothTo.positionAngleDeg } } : {}) });
    read = { channels: CHANNELS.map(() => Float32Array.from(plane.plane)), planes: new Map([[archive.band, plane]]) };
    bands.push({ band: archive.band, mosaic: file, primary: { 'DATE-OBS': observed, starRaDecDeg: [starRaDeg, starDecDeg] }, sky: plane,
      origin: { file: archive.path.replace(/^.*\//u, ''), url: archive.url, bytes: archive.bytes, title: archive.title, credit: archive.credit, displayCredit: archive.displayCredit, license: archive.license,
        acquisition: archive.acquisition, role: `${archive.instrument} ${archive.filter} image from its archive, the ${dataset.id} leaves`, landing: archive.landing, observed: archive.observed, instrument: archive.instrument } });
  } else if (dataset.hst) {
    read = await hstChannels(dataset, distancePc, halfUnits, size, bands);
  } else {
    const channels = await reflectanceChannels({ program: dataset.program, channels: dataset.channels, stellarFluxJy: dataset.stellarFluxJy, distancePc, halfUnits, size,
      backgroundAnnulusArcsec: dataset.backgroundAnnulusArcsec, downloads, sources, ...(starPosition ? { starPosition } : {}) });
    read = channels;
    const { program } = await readImagingProgram(dataset.program);
    const manifest: unknown = await readFile(resolve(repositoryRoot, `src/objects/${recipe.id}/source/manifest.json`), 'utf8')
      .then(text => JSON.parse(text) as unknown, (error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
        throw error;
      });
    for (const { band, entry, mosaic, primary } of channels.entries) bands.push({ band, mosaic, primary, sky: channels.planes.get(band)!,
      origin: { file: entry.level3.name, url: mastDownloadUrl(entry.level3.uri), bytes: entry.level3.bytes, title: `MAST JWST programme ${program.programme} · ${entry.observation} level-3 coronagraph mosaic`,
        credit: recipe.credit, displayCredit: 'NASA/ESA/CSA JWST, MAST', license: recipe.license.note,
        acquisition: jwstAcquisition(dataset.program, entry.level3.uri, manifest),
        role: `MAST level-3 coronagraph mosaic ${entry.level3.name} (calwebb_coron3), the ${filterOf(band)} band of the ${dataset.id} leaves`, landing: recipe.sourceUrl,
        observed: String(primary['DATE-OBS']), instrument: `JWST/NIRCam behind the ${JWST_BANDS[band]!.coronagraph} coronagraph` } });
  }
  // The ring is measured on the mean reflectance of the three channels; its noise is the bands' combined, in reflectance.
  const mean = Float32Array.from({ length: count }, (_, p) => (read.channels[0]![p]! + read.channels[1]![p]! + read.channels[2]![p]!) / 3);
  const noise = Math.sqrt(CHANNELS.reduce((total, channel) => total + dataset.channels[channel].reduce((sum, band) => sum + (read.planes.get(band)!.noise / dataset.stellarFluxJy[band]!) ** 2, 0) / dataset.channels[channel].length ** 2, 0)) / 3;
  const sky: SkyPlane = { ...bands[0]!.sky, plane: mean, background: 0, noise, unit: dataset.deposit ? dataset.deposit.unit : dataset.archive ? dataset.archive.unit : 'reflectance (MJy/sr per Jy of starlight)' };
  if (dataset.geometry === 'edge-on') return buildEdgeOnDataset(recipe, dataset, sky, read.channels, bands, innerMaskUnits, registrations, inputsOnly);
  const { published } = dataset;
  const geometry = dataset.adoptPublishedRing ? publishedRing(published) : ringGeometry(sky, { innerMaskUnits, outerUnits: dataset.outerUnits });
  const angle = (a: number, b: number) => Math.abs(((a - b) % 180 + 270) % 180 - 90);
  const differences = { radius: Math.abs(geometry.semiMajorUnits / published.radiusUnits! - 1), inclinationDeg: Math.abs(geometry.inclinationDeg - published.inclinationDeg), positionAngleDeg: angle(geometry.positionAngleDeg, published.positionAngleDeg) };
  if (differences.radius > published.radiusTolerance! || differences.inclinationDeg > published.toleranceDeg || differences.positionAngleDeg > published.toleranceDeg)
    throw new Error(`${dataset.id}: the measured ring (radius ${geometry.semiMajorUnits.toFixed(1)}, inclination ${geometry.inclinationDeg.toFixed(1)}, position angle ${geometry.positionAngleDeg.toFixed(1)}) does not match ${published.citation} (${published.radiusUnits}, ${published.inclinationDeg}, ${published.positionAngleDeg}).`);
  if (dataset.adoptPublishedRing && !(published.widthFwhmUnits! > 0)) throw new TypeError(`${dataset.id}: an adopted published ring states its width (published.widthFwhmUnits).`);
  const fit = fitDiscEnvelope(sky, geometry, { innerMaskUnits, outerUnits: dataset.outerUnits, nearSidePositionAngleDeg: dataset.nearSidePositionAngleDeg, heightOfRadius: dataset.heightOfRadius,
    ...(dataset.adoptPublishedRing ? { publishedWidthUnits: published.widthFwhmUnits! / (2 * Math.sqrt(2 * Math.LN2)) } : {}) });
  // Where the light ends: the median brightness in rings of the disc plane, deprojected with the geometry just measured,
  // falls to the per-pixel noise. The taper starts there, and a grid that would cut light above the noise is refused.
  const cosI = Math.cos(geometry.inclinationDeg * Math.PI / 180), phi = geometry.positionAngleDeg * Math.PI / 180, ringWidth = 2 * step;
  const rings = new Map<number, number[]>();
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = sky.plane[j * size + i]!; if (!Number.isFinite(v)) continue;
    const e = -(-halfUnits + (i + 0.5) * step - geometry.centreUnits[0]), n = -halfUnits + (j + 0.5) * step - geometry.centreUnits[1];
    const inPlane = Math.hypot(e * Math.sin(phi) + n * Math.cos(phi), (e * Math.cos(phi) - n * Math.sin(phi)) / cosI);
    const k = Math.floor(inPlane / ringWidth); (rings.get(k) ?? rings.set(k, []).get(k)!).push(v);
  }
  const radialProfile = [...rings].sort((p, q) => p[0] - q[0]).map(([k, values]) => { values.sort((p, q) => p - q); return { radiusUnits: (k + 0.5) * ringWidth, median: values[values.length >> 1]!, samples: values.length }; });
  const lightEndsUnits = radialProfile.find(ring => ring.radiusUnits > geometry.semiMajorUnits && ring.median <= sky.noise)?.radiusUnits;
  if (lightEndsUnits === undefined || lightEndsUnits * 1.25 > halfUnits)
    throw new Error(`${dataset.id}: the light reaches the noise at ${lightEndsUnits?.toFixed(0) ?? 'no radius inside the grid'}; the grid (${halfUnits} au) must reach 1.25 times that.`);
  const taperFromUnits = lightEndsUnits;
  // The drawn envelope: a disc of the measured geometry whose surface density follows the image's own deprojected radial
  // profile, so the halo lies in the disc plane like the ring. It has to project to the image better than the fitted gaussian
  // ring, the spherical shell and constant depth, or the author refuses.
  const planeProfile = radialProfile.filter(ring => ring.radiusUnits >= innerMaskUnits).map(ring => ({ radiusUnits: ring.radiusUnits, value: Math.max(0, ring.median) }));
  const drawnModel = { ...fit.ring };
  const density = profileDiscDensity(drawnModel, planeProfile);
  const profileScore = scoreEnvelope(sky, density, { innerMaskUnits, outerUnits: dataset.outerUnits });
  if (!(profileScore.residualRms < fit.ring.residualRms && profileScore.residualRms < fit.shell.residualRms && profileScore.residualRms < fit.constantDepthResidualRms))
    throw new Error(`${dataset.id}: the measured-profile disc (${profileScore.residualRms.toExponential(3)}) does not beat the ring (${fit.ring.residualRms.toExponential(3)}), the shell (${fit.shell.residualRms.toExponential(3)}) and constant depth (${fit.constantDepthResidualRms.toExponential(3)}).`);
  // How much light each envelope would put on the cube's front and back faces: the share of every drawn column's depth
  // weight within two cells of them.
  const faceShare = (d: (x: number, y: number, z: number) => number) => faceShareOf(sky, innerMaskUnits, taperFromUnits, d);
  const cubeFaceShare = { gaussianRing: faceShare(discDensity(fit.ring)), measuredProfileDisc: faceShare(density) };
  const shown = shownChannels(dataset, sky, read.channels, innerMaskUnits, taperFromUnits), encoded = spreadAlong(sky, shown, density);
  return { kind: 'ring' as const, dataset, bands, geometry, fit, profileScore, cubeFaceShare, innerMaskUnits, taperFromUnits, radialProfile, differences, ...(await finishDataset(dataset, sky, shown, encoded)) };
}

/** How much light an envelope would put on the cube's front and back faces: the share of every drawn column's depth weight
 * within two cells of them. */
function faceShareOf(sky: SkyPlane, innerMaskUnits: number, taperFromUnits: number, d: (x: number, y: number, z: number) => number) {
  const { size, halfUnits, step } = sky;
  let face = 0, total = 0;
  for (let j = 0; j < size; j += 2) for (let i = 0; i < size; i += 2) {
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
    if (r < innerMaskUnits || r > taperFromUnits) continue;
    let column = 0, edge = 0;
    for (let k = 0; k < size; k++) { const z = -halfUnits + (k + 0.5) * step, w = d(x, y, z); column += w; if (k < 2 || k >= size - 2) edge += w; }
    if (column > 0) { face += edge / column; total++; }
  }
  return face / total;
}

/** The display and the volume, shared by both geometries: each channel through the dataset's stretch, spread along the envelope's
 * depth profile (packages/bake/src/density/column-depth.ts), encoded, and previewed north up, east left. */
/** The displayed channels: each read channel through the dataset's stretch, blank under the drawn inner edge, tapered beyond the
 * light's end and faded by the stated noise fade. What the volume must reproduce from Earth. */
export function shownChannels(dataset: CircumstellarDataset, sky: SkyPlane, read: readonly Float32Array[], innerMaskUnits: number, taperFromUnits: number) {
  const { size, halfUnits, step } = sky, count = size * size;
  const fade = dataset.noiseFade ? (p: number) => smoothstep(dataset.noiseFade!.fromNoise * sky.noise, dataset.noiseFade!.toNoise * sky.noise, (read[0]![p]! + read[1]![p]! + read[2]![p]!) / 3) : () => 1;
  const shown = [0, 1, 2].map(() => new Float32Array(count).fill(NaN));
  // A color map shows one band: each channel is the map's color at the value, as the publisher's figure shows it.
  const lut = dataset.colorMap ? COLOR_MAPS.get(dataset) : undefined;
  if (dataset.colorMap && !lut) throw new Error(`${dataset.id}: the color map ${dataset.colorMap.path} was not read.`);
  const mapped = (value: number, channel: number) => {
    // As matplotlib picks a color: the fraction of the range, times the number of colors, rounded down; the ends clip.
    const { range, unitScale } = dataset.colorMap!, t = (value * unitScale - range[0]) / (range[1] - range[0]);
    return lut![Math.max(0, Math.min(lut!.length - 1, Math.floor(t * lut!.length)))]![channel]! / 255;
  };
  const stretch = dataset.stretch ? stretchOf(dataset.stretch.a, dataset.stretch.top) : undefined;
  if (!lut && !stretch) throw new Error(`${dataset.id}: no stretch and no color map to show it through.`);
  const display = (value: number, channel: number) => lut ? mapped(value, channel) : stretch!(value);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = j * size + i, r = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step);
    if (r < innerMaskUnits || !read.every(channel => Number.isFinite(channel[p]!))) continue;
    const taper = (1 - smoothstep(taperFromUnits, halfUnits, r)) * fade(p);
    for (let c = 0; c < 3; c++) shown[c]![p] = display(read[c]![p]!, c) * taper;
  }
  return shown;
}
/** Color maps a dataset shows through, read by buildDataset from the recipe's source/ file: 8-bit RGB, first entry at the range's low end. */
const COLOR_MAPS = new WeakMap<CircumstellarDataset, readonly (readonly [number, number, number])[]>();
export function parseFigureColorMap(value: unknown, path: string) {
  const record = requireRecord(value, path);
  if (record.schema !== 'cssearth-figure-colormap@1') throw new TypeError(`${path}: schema is ${String(record.schema)}, not cssearth-figure-colormap@1.`);
  const rgb = requireArray(record.rgb, `${path} rgb`).map((entry, index) => {
    const triple = requireArray(entry, `${path} rgb[${index}]`).map(v => requireFiniteNumber(v, `${path} rgb[${index}]`));
    if (triple.length !== 3 || triple.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new TypeError(`${path}: rgb[${index}] is not an 8-bit color: ${triple.join(', ')}.`);
    return [triple[0]!, triple[1]!, triple[2]!] as const;
  });
  if (rgb.length < 2) throw new TypeError(`${path}: a color map needs at least two colors, not ${rgb.length}.`);
  return { rgb, source: requireString(record.source, `${path} source`) };
}

/** Exposure, opacity and preview, shared by both depth routes. `integral` is each channel's decoded column over the grid peak's scale. */
/** The baker integrates each channel's decoded density (its column over the grid peak) in its own color, and the renderer turns
 * the brightest channel's column into 1 - exp(-gain * column). A white column at the top of the stretch carries 1 in every
 * channel, so the gain puts exactly that column at the stated alpha. Returns the gain and how opaque the lines of sight are
 * face-on. Shared with the lab's reconstruction command, which computes it for the volume it writes. */
export function exposureAndOpacity(topAlpha: number, peak: number, integral: readonly Float64Array[]): { exposureGain: number; opacity: CircumstellarOpacity } {
  const count = integral[0]!.length, exposureGain = -Math.log(1 - topAlpha) * peak;
  const columnEmission = (p: number) => Math.max(...integral.map(channel => channel[p]! / peak));
  const alphas = Array.from({ length: count }, (_, p) => 1 - Math.exp(-exposureGain * columnEmission(p))).filter(alpha => alpha > 0.001).sort((a, b) => a - b);
  const quantile = (q: number) => alphas[Math.min(alphas.length - 1, Math.floor(q * (alphas.length - 1)))]!;
  return { exposureGain, opacity: { drawnColumns: alphas.length, median: quantile(0.5), p90: quantile(0.9), max: alphas.at(-1)! } };
}

async function finishDataset(dataset: CircumstellarDataset, sky: SkyPlane, shown: readonly Float32Array[], encoded: { ktx2: Uint8Array; peak: number; filledVoxels: number; droppedShare: readonly number[] } & ({ integral: readonly Float64Array[] } | { exposureGain: number; opacity: CircumstellarOpacity })) {
  const { size } = sky, count = size * size;
  const { exposureGain, opacity } = 'integral' in encoded ? exposureAndOpacity(dataset.topAlpha, encoded.peak, encoded.integral) : encoded;
  // A preview of the image as read, in its displayed colors: north up, east left.
  const preview = Buffer.alloc(count * 3);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // The sky plane's x grows west and y north, so north up and east left is row flipped, column kept.
    const p = (size - 1 - j) * size + i;
    preview.set([0, 1, 2].map(c => Number.isFinite(shown[c]![p]!) ? Math.round(255 * Math.min(1, shown[c]![p]!)) : 0), (j * size + i) * 3);
  }
  const previewPng = await sharp(preview, { raw: { width: size, height: size, channels: 3 } }).resize(512, 512, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toBuffer();
  return { spread: { peak: encoded.peak, filledVoxels: encoded.filledVoxels, droppedShare: encoded.droppedShare }, ktx2: encoded.ktx2, exposureGain, opacity, previewPng };
}

/** The ring route's depth: each displayed column spread along the fitted ring's depth profile (column-depth.ts). */
function spreadAlong(sky: SkyPlane, shown: readonly Float32Array[], density: (x: number, y: number, z: number) => number) {
  const { size, halfUnits, step } = sky, zs = Array.from({ length: size }, (_, k) => -halfUnits + (k + 0.5) * step);
  const spread = spreadColumns({ width: size, height: size, depth: size, channels: [...shown], depthStep: step,
    profile: (i, j, out) => { const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step; let total = 0; for (const [k, z] of zs.entries()) { out[k] = density(x, y, z); total += out[k]!; } return total; } });
  return { ktx2: encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: spread.rgba }, 9), peak: spread.peak, integral: spread.integral, filledVoxels: spread.filledVoxels, droppedShare: spread.droppedShare };
}

/** What the lab's reconstruction of an edge-on dataset reads: the displayed channels, the measured midplane and the grid. */
export interface EdgeOnSolveInputs {
  readonly dataset: CircumstellarDataset; readonly sky: SkyPlane; readonly shown: readonly Float32Array[];
  readonly geometry: MidplaneGeometry; readonly innerMaskUnits: number; readonly taperFromUnits: number;
  /** The disc's normal in the grid's own axes: x toward increasing column (west), y toward increasing row (north), z toward the observer. */
  readonly axis: readonly [number, number, number];
}
/** The lab-written reconstruction of one edge-on dataset, as the recipe's source/ holds it (labs/nebula reconstruct-circumstellar). */
export const reconstructionPath = (dataset: CircumstellarDataset) => `reconstruction-${dataset.id}.json`;

/** An edge-on disc: its midplane measured and checked against the published position angle, its displayed channels written,
 * and its depth read from the lab's axially symmetric emission reconstruction of those channels (Wenger, Lorenz & Magnor 2013,
 * labs/nebula/packages/reconstruction methods/symmetry). The author computes no depth itself; a reconstruction on another grid
 * is refused, and a changed recipe is reconstructed again before authoring. */
async function buildEdgeOnDataset(recipe: CircumstellarRecipe, dataset: CircumstellarDataset, sky: SkyPlane, read: readonly Float32Array[], bands: readonly BandRead[], innerMaskUnits: number, registrations: ReadonlyMap<string, PlanetRegistration>, inputsOnly: boolean) {
  const { size, halfUnits, step } = sky, { published } = dataset, angle = (a: number, b: number) => Math.abs(((a - b) % 180 + 270) % 180 - 90);
  const halfHeightUnits = dataset.midplaneHalfHeightUnits ?? 0.15 * dataset.outerUnits;
  const geometry: MidplaneGeometry = midplaneGeometry(sky, { innerMaskUnits, outerUnits: dataset.outerUnits, halfHeightUnits });
  const differences = { positionAngleDeg: angle(geometry.positionAngleDeg, published.positionAngleDeg) };
  if (differences.positionAngleDeg > published.toleranceDeg)
    throw new Error(`${dataset.id}: the measured midplane (position angle ${geometry.positionAngleDeg.toFixed(2)}°) does not match ${published.citation} (${published.positionAngleDeg}° within ${published.toleranceDeg}°).`);
  // The light along the midplane: the median brightness in bins of distance along it, within the strip, on each side. The
  // drawn light ends where the strip's brightness falls to the noise on both sides, or where the image's coverage ends.
  const pa = geometry.positionAngleDeg * Math.PI / 180, along = [-Math.sin(pa), Math.cos(pa)], across = [-Math.cos(pa), -Math.sin(pa)], binWidth = 2 * step;
  const bins = new Map<number, number[]>();
  let coverageEndsUnits = 0;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const v = sky.plane[j * size + i]!; if (!Number.isFinite(v)) continue;
    const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, a = x * along[0]! + y * along[1]!, c = x * across[0]! + y * across[1]! - geometry.starOffsetUnits;
    if (Math.abs(c) > halfHeightUnits) continue;
    coverageEndsUnits = Math.max(coverageEndsUnits, Math.abs(a));
    const k = Math.floor(a / binWidth); (bins.get(k) ?? bins.set(k, []).get(k)!).push(v);
  }
  const radialProfile = [...bins].sort((p, q) => p[0] - q[0]).map(([k, values]) => { values.sort((p, q) => p - q); return { alongUnits: (k + 0.5) * binWidth, median: values[values.length >> 1]!, samples: values.length }; });
  const endOn = (sign: 1 | -1) => radialProfile.filter(bin => Math.sign(bin.alongUnits) === sign && Math.abs(bin.alongUnits) > innerMaskUnits).find(bin => bin.median <= sky.noise);
  const lightEnds = { positive: endOn(1)?.alongUnits, negative: endOn(-1)?.alongUnits };
  // Light past the grid's edge is drawn only to that edge, and only for a dataset that states why (beyondGrid); otherwise refused.
  const ends = Math.min(...[lightEnds.positive, lightEnds.negative].map(v => v === undefined ? coverageEndsUnits : Math.abs(v)));
  const taperFromUnits = ends > halfUnits && dataset.beyondGrid ? halfUnits : ends;
  if (!(taperFromUnits > innerMaskUnits) || taperFromUnits > halfUnits) throw new Error(`${dataset.id}: the light along the midplane ends at ${taperFromUnits.toFixed(0)} au, outside the drawable range.`);
  const shown = shownChannels(dataset, sky, read, innerMaskUnits, taperFromUnits);
  // The disc's normal: in the sky basis (east, north, toward the observer) it is the minor axis tilted by the inclination toward
  // the stated near side, as the ring's density builds it; the grid's x runs west, so east flips sign.
  const phi = pa, inclination = published.inclinationDeg * Math.PI / 180, minor = [Math.cos(phi), -Math.sin(phi)];
  const near = Math.cos((dataset.nearSidePositionAngleDeg - (geometry.positionAngleDeg + 90)) * Math.PI / 180) >= 0 ? 1 : -1;
  const normalSky = [-near * minor[0]! * Math.sin(inclination), -near * minor[1]! * Math.sin(inclination), Math.cos(inclination)];
  const axis: [number, number, number] = [-normalSky[0]!, normalSky[1]!, normalSky[2]!];
  if (inputsOnly) return { kind: 'inputs' as const, inputs: { dataset, sky, shown, geometry, innerMaskUnits, taperFromUnits, axis } satisfies EdgeOnSolveInputs };
  const recordPath = resolve(repositoryRoot, `src/objects/${recipe.id}/source`, reconstructionPath(dataset));
  const reconstruction = JSON.parse(await readFile(recordPath, 'utf8').catch(() => { throw new Error(`${dataset.id}: no reconstruction at ${reconstructionPath(dataset)}; run node --experimental-strip-types labs/nebula/run.mts reconstruct-circumstellar ${recipe.id}.`); })) as EdgeOnReconstruction;
  if (reconstruction.schema !== CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA || reconstruction.objectId !== recipe.id || reconstruction.datasetId !== dataset.id) throw new TypeError(`${reconstructionPath(dataset)} is not this dataset's reconstruction.`);
  for (const retired of ['shownSha256', 'decodedSha256'] as const) if (retired in reconstruction) throw new TypeError(`${reconstructionPath(dataset)} carries the retired ${retired}; reconstruct again.`);
  if (reconstruction.grid.size !== size || reconstruction.grid.halfUnits !== halfUnits) throw new Error(`${dataset.id}: the reconstruction's grid differs from the recipe's.`);
  const ktx2 = await readFile(resolve(repositoryRoot, `src/objects/${recipe.id}/source`, reconstruction.ktx2.path));
  if (ktx2.length !== reconstruction.ktx2.bytes) throw new Error(`${dataset.id}: ${reconstruction.ktx2.path} is ${ktx2.length} bytes, not the ${reconstruction.ktx2.bytes} the reconstruction wrote.`);
  // Each band's own midplane about the registered star: the offsets say whether the filters agree on where the disc is.
  const bandMidplanes = Object.fromEntries(bands.map(band => { const g = midplaneGeometry(band.sky, { innerMaskUnits, outerUnits: dataset.outerUnits, halfHeightUnits, initialPositionAngleDeg: geometry.positionAngleDeg });
    return [band.band, { positionAngleDeg: g.positionAngleDeg, starOffsetUnits: g.starOffsetUnits, ridgeResidualUnits: g.ridgeResidualUnits }]; }));
  return { kind: 'edge-on' as const, dataset, bands, geometry, reconstruction, innerMaskUnits, taperFromUnits, coverageEndsUnits, lightEnds, radialProfile, differences, halfHeightUnits, axis,
    registrations: Object.fromEntries(registrations), bandMidplanes,
    ...(await finishDataset(dataset, sky, shown, { ktx2, peak: reconstruction.peak, filledVoxels: reconstruction.filledVoxels, droppedShare: [0, 0, 0], exposureGain: reconstruction.exposureGain, opacity: reconstruction.opacity })) };
}

/** The measured record of an edge-on dataset, the counterpart of the ring's. */
function edgeOnMeasured(b: Extract<Awaited<ReturnType<typeof buildDataset>>, { kind: 'edge-on' }>, halfUnits: number) {
  return {
    geometry: 'edge-on' as const,
    bands: b.bands.map(band => ({ band: band.band, mosaic: band.origin.file, observed: band.primary['DATE-OBS'], starRaDecDeg: band.primary.starRaDecDeg ?? (band.primary.TARG_RA === undefined ? null : [band.primary.TARG_RA, band.primary.TARG_DEC]),
      starPixel: band.sky.starPixel, mosaicArcsecPerPixel: band.sky.mosaicArcsecPerPixel, background: band.sky.background, noise: band.sky.noise, backgroundPixels: band.sky.backgroundPixels, unit: band.sky.unit })),
    channels: b.dataset.channels, stellarFluxJy: b.dataset.stellarFluxJy, stellarFluxSource: b.dataset.stellarFluxSource, stretch: b.dataset.stretch,
    registration: b.dataset.registration ? { planet: b.dataset.registration.planet, source: b.dataset.registration.source, bands: b.registrations } : null, bandMidplanes: b.bandMidplanes,
    noiseFade: b.dataset.noiseFade ?? null,
    innerMaskUnits: b.innerMaskUnits, midplaneHalfHeightUnits: b.halfHeightUnits, lightEndsUnits: b.taperFromUnits, lightEnds: b.lightEnds, coverageEndsUnits: b.coverageEndsUnits,
    midplaneProfile: b.radialProfile.filter(bin => Math.abs(bin.alongUnits) <= halfUnits),
    positionAngleDeg: b.geometry.positionAngleDeg, positionAngleSpreadDeg: b.geometry.positionAngleSpreadDeg, starOffsetUnits: b.geometry.starOffsetUnits, ridgeResidualUnits: b.geometry.ridgeResidualUnits,
    midplaneBins: b.geometry.bins, sideBrightness: b.geometry.sideBrightness, iterations: b.geometry.iterations,
    published: b.dataset.published, differences: b.differences,
    reconstruction: { path: reconstructionPath(b.dataset), method: b.reconstruction.method, checks: b.reconstruction.checks, axis: b.axis, inclinationDeg: b.dataset.published.inclinationDeg, nearSidePositionAngleDeg: b.dataset.nearSidePositionAngleDeg },
    exposureGain: b.exposureGain, topAlpha: b.dataset.topAlpha, faceOnOpacity: b.opacity, droppedShare: b.spread.droppedShare, filledVoxels: b.spread.filledVoxels,
  };
}

/** What an edge-on volume cannot say, and what each of its datasets adds to that. */
function edgeOnLimitations(datasets: readonly CircumstellarDataset[]) {
  return [
    'No third axis was observed. The depth is reconstructed by assuming the disc is symmetric about its normal: each ring of radius and height carries one emission, fitted so the volume reprojects to the image. Real asymmetries the image shows are kept where the fit allows, but anything the symmetry cannot place is not measured.',
    'Which side of the midplane tilts toward the observer is a stated convention; an image this close to edge-on barely changes with it.',
    'Where no pixel sees a ring of radius and height, nothing constrains it and it stays empty: inside each dataset\u2019s inner edge the disc is not drawn.',
    'Inside each dataset\u2019s inner edge the image is not data and is not drawn; the star and planets are their own spheres.',
    'Opacity is the renderer\u2019s convention, not the dust\u2019s: brightness and blocking are one number in its emission model, and the real disc blocks a small fraction of a percent of what is behind it.',
    'Nothing finer than an image\u2019s pixels or the grid\u2019s cells is in the drawn volume.',
    ...datasets.flatMap(dataset => dataset.beyondGrid ? [`${dataset.id}: ${dataset.beyondGrid}`] : []),
    ...datasets.flatMap(dataset => dataset.deposit ? [
      `${dataset.id}: the ${dataset.deposit.instrument} image is the authors\u2019 own reduction (${dataset.deposit.title}), combined from observations made ${dataset.deposit.observed}, and carries no sky coordinates; its orientation is stated and checked, not read from a header. Close to the star its PSF subtraction leaves light off the disc too, which is drawn with the disc. It is one visible filter shown in grey, brightness only.`,
    ] : dataset.hst ? [
      `${dataset.id}: the colors are the disc\u2019s contrast to the star in ${Object.keys(dataset.hst.products).map(filterOf).join(', ')}, blue, green and red, which the eye would see as its color against the star\u2019s: a white disc scatters like the star shines. The reference star\u2019s light was removed at the flux ratio the paper states, not at the scale that best cancels it here, and what that leaves near the star and along the occulting finger is drawn with the disc (${dataset.hst.subtraction}.psf-subtraction.json records the scale a free fit would choose).`,
    ] : [
      `${dataset.id}: the colors are the disc\u2019s contrast to the star in ${[...new Set(CHANNELS.flatMap(channel => dataset.channels[channel]))].map(filterOf).join(' and ')}, mapped to blue and red by wavelength: infrared colors, not what an eye would see. MAST\u2019s coronagraphy products are drawn as the pipeline made them, and the stellar flux the contrast is computed against is a model atmosphere.`,
    ]),
  ];
}

/** The inputs the lab reconstructs, for every edge-on dataset of a recipe: what the author would display, before any depth. */
export async function edgeOnSolveInputs(id: string, options: { sources?: readonly string[] } = {}): Promise<{ recipe: CircumstellarRecipe; datasets: EdgeOnSolveInputs[] }> {
  const root = resolve(repositoryRoot, `src/objects/${id}/source`), recipe = parseCircumstellarRecipe(JSON.parse(await readFile(resolve(root, 'circumstellar.json'), 'utf8')));
  const { distancePc } = await hostPlacement(recipe), datasets: EdgeOnSolveInputs[] = [];
  for (const dataset of recipe.datasets) if (dataset.geometry === 'edge-on') {
    const result = await buildDataset(recipe, dataset, distancePc, resolve(repositoryRoot, `.local/${id}`), options.sources ?? [], true);
    if (result.kind !== 'inputs') throw new Error(`${dataset.id}: no reconstruction inputs.`);
    datasets.push(result.inputs);
  }
  return { recipe, datasets };
}

/** The host's scene origin: its prepared scene when it has been prepared, else the world frame its object record carries. */
async function hostPlacement(recipe: CircumstellarRecipe) {
  const hostObject = resolve(repositoryRoot, 'src/objects', recipe.host);
  const scene = requireRecord(requireRecord(JSON.parse(await readFile(resolve(hostObject, 'prepared/scene.json'), 'utf8').catch(async () => {
    const object = requireRecord(JSON.parse(await readFile(resolve(hostObject, 'object.json'), 'utf8')) as unknown);
    return JSON.stringify({ worldFrame: requireRecord(object.properties, 'properties').worldFrame });
  })) as unknown).worldFrame);
  const origin = requireArray(scene.originM).map(v => requireFiniteNumber(v)) as [number, number, number], distanceM = Math.hypot(...origin);
  return { origin, distanceM, distancePc: distanceM / METERS_PER_PARSEC };
}

export async function author(id: string, options: { sources?: readonly string[] } = {}) {
  const repository = checkoutProjectRoot(import.meta.url), packageBase = `src/objects/${id}/source`, root = resolve(repository, packageBase);
  const recipe = parseCircumstellarRecipe(JSON.parse(await readFile(resolve(root, 'circumstellar.json'), 'utf8')));
  if (recipe.id !== id) throw new TypeError(`The recipe is for ${recipe.id}, not ${id}.`);
  const downloadsBase = `.local/${id}`, downloads = resolve(repository, downloadsBase);
  // The host's scene origin: its prepared scene when it has been prepared, else the world frame its object record carries.
  const hostObject = resolve(repository, 'src/objects', recipe.host);
  const scene = requireRecord(requireRecord(JSON.parse(await readFile(resolve(hostObject, 'prepared/scene.json'), 'utf8').catch(async () => {
    const object = requireRecord(JSON.parse(await readFile(resolve(hostObject, 'object.json'), 'utf8')) as unknown);
    return JSON.stringify({ worldFrame: requireRecord(object.properties, 'properties').worldFrame });
  })) as unknown).worldFrame);
  const origin = requireArray(scene.originM).map(v => requireFiniteNumber(v)) as [number, number, number], distanceM = Math.hypot(...origin), distancePc = distanceM / METERS_PER_PARSEC;
  const raDeg = (Math.atan2(origin[1], origin[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(origin[2] / distanceM) * 180 / Math.PI;
  const built: Exclude<Awaited<ReturnType<typeof buildDataset>>, { kind: 'inputs' }>[] = [];
  for (const dataset of recipe.datasets) {
    const result = await buildDataset(recipe, dataset, distancePc, downloads, options.sources ?? []);
    if (result.kind === 'inputs') throw new Error(`${dataset.id}: built only its reconstruction inputs.`);
    built.push(result);
  }
  const { size, halfUnits, slabs } = recipe.grid;
  const heightSpread = (b: Extract<typeof built[number], { kind: 'ring' }>) => ((Math.max(...b.fit.heightResiduals.map(h => h.residualRms)) / Math.min(...b.fit.heightResiduals.map(h => h.residualRms)) - 1) * 100).toFixed(1);
  const measured = Object.fromEntries(built.map(b => [b.dataset.id, b.kind === 'edge-on' ? edgeOnMeasured(b, halfUnits) : {
    bands: b.bands.map(band => ({ band: band.band, mosaic: band.origin.file, observed: band.primary['DATE-OBS'], starRaDecDeg: band.primary.starRaDecDeg ?? (band.primary.TARG_RA === undefined ? null : [band.primary.TARG_RA, band.primary.TARG_DEC]),
      starPixel: band.sky.starPixel, mosaicArcsecPerPixel: band.sky.mosaicArcsecPerPixel, background: band.sky.background, noise: band.sky.noise, backgroundPixels: band.sky.backgroundPixels, unit: band.sky.unit })),
    channels: b.dataset.channels, stellarFluxJy: b.dataset.stellarFluxJy, stellarFluxSource: b.dataset.stellarFluxSource, stretch: b.dataset.stretch,
    innerMaskUnits: b.innerMaskUnits, lightEndsUnits: b.taperFromUnits, radialProfile: b.radialProfile.filter(ring => ring.radiusUnits <= halfUnits), ridgeSamples: b.geometry.ridge.length, ringCentreUnits: b.geometry.centreUnits, semiMajorUnits: b.geometry.semiMajorUnits, semiMinorUnits: b.geometry.semiMinorUnits,
    inclinationDeg: b.geometry.inclinationDeg, positionAngleDeg: b.geometry.positionAngleDeg, ridgeResidualUnits: b.geometry.ridgeResidualUnits, binningSpread: b.geometry.binningSpread, ...(b.dataset.adoptPublishedRing ? { ringGeometry: 'published fit, not measured' } : {}),
    published: b.dataset.published, differences: b.differences,
    envelope: { shape: 'measured-profile-disc', residualRms: b.profileScore.residualRms, cubeFaceShare: b.cubeFaceShare, heightUnits: b.fit.ring.gaussianHeightUnits,
      fittedRing: { gaussianWidthUnits: b.fit.ring.gaussianWidthUnits, gaussianHeightUnits: b.fit.ring.gaussianHeightUnits, residualRms: b.fit.ring.residualRms }, signalRms: b.fit.signalRms, scoredPixels: b.fit.scoredPixels,
      alternatives: { sphericalShell: b.fit.shell, constantDepthResidualRms: b.fit.constantDepthResidualRms }, heightResiduals: b.fit.heightResiduals, search: DEFAULT_SEARCH },
    exposureGain: b.exposureGain, topAlpha: b.dataset.topAlpha, faceOnOpacity: b.opacity, droppedShare: b.spread.droppedShare, filledVoxels: b.spread.filledVoxels,
  }]));
  const provenance = {
    schema: VOLUME_PROVENANCE_SCHEMA, title: `${recipe.name}: ${built.some(b => b.dataset.archive) ? 'ALMA continuum imaging' : 'JWST coronagraph imaging'} given the depth of the fitted ${built.some(b => b.kind === 'edge-on') ? 'disc' : 'ring'}`, kind: 'observed-sky-image-on-fitted-envelope',
    authors: [], organizations: [...new Set(built.map(b => b.dataset.deposit ? b.dataset.deposit.displayCredit : b.dataset.archive ? b.dataset.archive.displayCredit : 'NASA/ESA/CSA JWST; MAST (STScI)'))],
    license: { spdx: recipe.license.spdx, dataLicenseDeclaration: recipe.license.url, note: recipe.license.note },
    sources: built.flatMap(b => b.bands.map(band => ({ id: inputOf(b.dataset, band), url: band.origin.url, landing: band.origin.landing, bytes: band.origin.bytes,
      role: b.dataset.deposit || b.dataset.hst || b.dataset.archive ? band.origin.role : `${band.origin.role}; reproduced by packages/telescope-cli/src/archives/jwst/imaging/coron3.mts in programs/${b.dataset.program}.${band.band}.reproduction.json` }))
      .concat(b.dataset.archive?.primaryBeam ? [{ id: `${b.dataset.id}-primary-beam`, url: b.dataset.archive.primaryBeam.url, landing: b.dataset.archive.landing, bytes: b.dataset.archive.primaryBeam.bytes,
        role: `the primary beam of ${b.dataset.archive.title}, which the ${b.dataset.id} image is multiplied by` }] : [])),
    paper: built.map(b => ({ dataset: b.dataset.id, citation: b.dataset.published.citation, url: b.dataset.published.url })),
    measured: { sceneOriginRaDecDeg: [raDeg, decDeg], distancePc, arcsecPerUnit: 1 / distancePc, grid: recipe.grid, datasets: measured },
    models: Object.fromEntries(built.map(b => [b.dataset.id, b.kind === 'edge-on' ? `Fitted edge-on disc. ${b.dataset.deposit
      ? `The deposited image (${b.dataset.deposit.title}) is read about its star at the array centre with ${(b.dataset.deposit.pixelArcsec * 1000).toFixed(2)} mas pixels, north up and east left (${b.dataset.deposit.orientationSource}), onto a sky plane in astronomical units; its background, the median in the ${b.dataset.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted, and it is shown in its own ${b.dataset.deposit.unit} in every channel.`
      : b.dataset.hst ? `Each band's two telescope rolls, PSF-subtracted and drizzled north up here (packages/telescope-cli/src/archives/hst/psf-subtract.mts ${b.dataset.hst.subtraction}, the reference star divided by the flux ratio the paper states), are read about the star where that subtraction found it, through each product's own WCS, onto a sky plane in astronomical units. Each roll's background, the median in the ${b.dataset.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted; the rolls are averaged, each one standing alone where the other is blank; and the band is divided by the star's own count rate in it, ${Object.keys(b.dataset.hst.products).map(band => `${filterOf(band)} ${b.dataset.stellarFluxJy[band]!.toExponential(3)} e-/s`).join(', ')} (${b.dataset.stellarFluxSource}; ${b.dataset.hst.zeropointSource}), its contrast. The channels: ${CHANNELS.map(channel => `${channel} ${b.dataset.channels[channel].map(filterOf).join(' + ')}`).join(', ')}.`
      : `Each of the ${b.bands.length} mosaics is read about the star through its own WCS onto a sky plane in astronomical units; the star is placed by ${b.dataset.registration ? `planet ${b.dataset.registration.planet}'s orbit` : "the observation's target position (TARG_RA, TARG_DEC)"}. Each band's background, the median in the ${b.dataset.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted, and the band is divided by the star's own flux in it (${b.dataset.stellarFluxSource}), its contrast. The channels: ${CHANNELS.map(channel => `${channel} ${b.dataset.channels[channel].map(filterOf).join(' + ')}`).join(', ')}.`} The midplane is measured on the mean of the channels: the ridge of each vertical profile along a trial direction, a line through the ridges, the direction turned until it settles, at position angle ${b.geometry.positionAngleDeg.toFixed(2)}° (published ${b.dataset.published.positionAngleDeg}°) with the star ${b.geometry.starOffsetUnits.toFixed(1)} au from the line. The depth is reconstructed, not fitted to a shape: each displayed channel is solved for emission in three dimensions by the axially symmetric method of Wenger, Lorenz & Magnor (2013) as the lab implements it (labs/nebula/packages/reconstruction, methods/symmetry), with the symmetry axis the disc's normal, tilted ${(90 - b.dataset.published.inclinationDeg).toFixed(1)}° from the sky toward the ${compass(b.dataset.nearSidePositionAngleDeg)} side, voxels grouped by their height above the midplane and their radius about that axis, and pixels with no data given no weight. The volume reprojects to the image to ${JSON.stringify(b.reconstruction.checks.relativeProjectionError)} (relative error by channel); ${b.reconstruction.ktx2.path} and ${reconstructionPath(b.dataset)} record it.` : `${b.dataset.archive ? `Fitted ring, in the color map the publisher shows. The archive image (${b.dataset.archive.title}) is read through its own WCS onto a sky plane in astronomical units, about the star where its catalogue position and proper motion put it on ${String(b.bands[0]!.primary['DATE-OBS'])}. ${b.dataset.pointSources ? `${b.dataset.pointSources.sources.length === 1 ? 'One point source' : `${b.dataset.pointSources.sources.length} point sources`} (${b.dataset.pointSources.sources.map(p => p.id).join(', ')}) ${b.dataset.pointSources.sources.length === 1 ? 'is' : 'are'} removed first, each the image's own beam at its published position and peak (${b.dataset.pointSources.source}). ` : ''}${b.dataset.archive.primaryBeam ? `It is multiplied by the same product's primary beam (${b.dataset.archive.primaryBeam.source}). ` : ''}${b.dataset.smoothTo ? `It is smoothed to a ${b.dataset.smoothTo.beamArcsec[0]}″ × ${b.dataset.smoothTo.beamArcsec[1]}″ beam at ${b.dataset.smoothTo.positionAngleDeg}° and rescaled to Jy per that beam (${b.dataset.smoothTo.source}). ` : ''}Its background, the median in the ${b.dataset.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted; it is the dust's own glow, not starlight, so it is not divided by the star, and the one band feeds every channel.` : `Fitted ring, in the reflectance color the publisher shows. Each of the ${b.bands.length} mosaics is read about the star through its own WCS onto a sky plane in astronomical units; the star's position is the observation's target position (TARG_RA, TARG_DEC). Each band's background, the median in the ${b.dataset.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted, and the band is divided by the star's own flux in it (${b.dataset.stellarFluxSource}), which leaves how the dust reflects starlight at that wavelength. The channels average them in pairs: ${CHANNELS.map(channel => `${channel} ${b.dataset.channels[channel].map(filterOf).join(' + ')}`).join(', ')}.`} ${b.dataset.adoptPublishedRing ? `The ring's geometry is not measured on this image: it is the fit of ${b.dataset.published.citation} to the same observations, ${b.dataset.published.radiusUnits} au, ${b.dataset.published.widthFwhmUnits} au wide at half maximum, inclination ${b.dataset.published.inclinationDeg}°, line of nodes at position angle ${b.dataset.published.positionAngleDeg}°, centred on the star (${b.dataset.adoptPublishedRing}).` : `The ring is measured on the mean of the channels: its ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse of semi-major axis ${b.geometry.semiMajorUnits.toFixed(1)} au, axis ratio ${(b.geometry.semiMinorUnits / b.geometry.semiMajorUnits).toFixed(3)} (inclination ${b.geometry.inclinationDeg.toFixed(1)}°), line of nodes at position angle ${b.geometry.positionAngleDeg.toFixed(1)}°, centre ${Math.hypot(...b.geometry.centreUnits).toFixed(1)} au from the star; the single binnings scatter by ${b.geometry.binningSpread.semiMajorUnits.toFixed(1)} au, ${b.geometry.binningSpread.inclinationDeg.toFixed(1)}° and ${b.geometry.binningSpread.positionAngleDeg.toFixed(1)}°. This stands against ${b.dataset.published.citation}'s ${b.dataset.published.radiusUnits} au, ${b.dataset.published.inclinationDeg}° and ${b.dataset.published.positionAngleDeg}°.`} Depth is not the image pushed backwards: a disc of that geometry whose surface density follows the image's own deprojected radial profile, halo included, projects to the mean image with a residual of ${b.profileScore.residualRms.toExponential(2)} against a signal of ${b.fit.signalRms.toExponential(2)}, where a single gaussian ring of radial width ${b.fit.ring.gaussianWidthUnits.toFixed(1)} au leaves ${b.fit.ring.residualRms.toExponential(2)}, a spherical shell ${b.fit.shell.residualRms.toExponential(2)} and constant depth, what an extrusion assumes, ${b.fit.constantDepthResidualRms.toExponential(2)}. A narrow ring would also put the light of sight lines through the halo on the cube's faces, where its density along them peaks; the profile disc puts every column where it crosses the disc plane. The ring's vertical height is ${b.dataset.heightSource ? `${b.dataset.heightOfRadius} of its radius, from ${b.dataset.heightSource}` : `a stated ${b.dataset.heightOfRadius} of its radius`} (the projection changes by ${heightSpread(b)}% across the heights tried), and which side is nearer is a convention: ${b.dataset.nearSideSource}. ${b.dataset.colorMap ? `Each column is shown in the color the publisher's map gives its value, linear from ${b.dataset.colorMap.range[0]} to ${b.dataset.colorMap.range[1]} ${b.dataset.colorMap.unit} (${b.dataset.colorMap.source}).` : `Each channel is shown as log(1 + a u) / log(1 + a) with u = reflectance / ${b.dataset.stretch!.top} and a = ${b.dataset.stretch!.a}; ${b.dataset.stretch!.source}.`} Every channel shares one depth profile, so each column is spread along the ring and keeps its color. The top of the ${b.dataset.colorMap ? 'map' : 'stretch'} reaches an alpha of ${b.dataset.topAlpha}, the renderer's convention for a volume; the median drawn line of sight reaches ${b.opacity.median.toFixed(2)}. The image is drawn from ${b.innerMaskUnits.toFixed(0)} au to the grid edge at ${halfUnits} au, tapering from ${b.taperFromUnits.toFixed(0)} au, where the mean ${b.dataset.archive ? 'brightness' : 'reflectance'} in the disc plane falls to its per-pixel noise.`])),
    limitations: built.some(b => b.kind === 'edge-on') ? edgeOnLimitations(built.map(b => b.dataset)) : built.some(b => b.dataset.archive) ? [
      'One image, one epoch, one wavelength: no third axis was observed. The depth is the ring that best projects to the image, an inference from that projection, not a measurement.',
      'Which side of the inclined ring is nearer the observer is stated in the recipe from the literature; the image alone cannot tell.',
      built.every(b => b.dataset.heightSource)
        ? 'The ring’s vertical thickness is not measured: it is a published model’s, which the recipe names; at this inclination the projection barely changes with it.'
        : 'The ring’s vertical thickness is a stated convention; at this inclination the projection barely changes with it.',
      'Azimuthal brightness differences in the image are kept as measured; the ring model supplies only the depth.',
      built.some(b => b.dataset.smoothTo)
        ? 'The image is the archive pipeline’s, not the paper’s own: made from the same observations with other weighting and cleaning, it is noisier and its ring fainter than the published figure even at the paper’s resolution. Emission fainter than the drawn noise is not claimed.'
        : 'The image is the archive pipeline’s, not the paper’s own: it is not self-calibrated and not combined with other data, so it is noisier than the published figure. Emission fainter than the drawn noise, such as the dust around a planet, is not claimed.',
      'The colors are the publisher’s color map for brightness at one wavelength, not colors an eye would see.',
      'Opacity is the renderer’s convention, not the dust’s: brightness and blocking are one number in its emission model.',
      'Nothing finer than the image’s beam, its pixels or the grid’s cells is in the drawn volume.',
    ] : [
      'One image, one epoch, one filter: no third axis was observed. The depth is the ring that best projects to the image, an inference from that projection, not a measurement.',
      'Which side of the inclined ring is nearer the observer is a stated convention; the image alone cannot tell.',
      'The ring’s vertical thickness is a stated convention; at this inclination the projection barely changes with it.',
      'Azimuthal brightness differences in the image, from forward scattering and from real structure, are kept as measured; the ring model supplies only the depth.',
      'Inside the coronagraph mask the star and its immediate surroundings are not data and are not drawn; the star is the host body’s own sphere.',
      'The colors are the dust\u2019s reflectance across 1.8 to 4.4 micrometres, the publisher\u2019s recipe, mapped to blue, green and red by wavelength: infrared colors, not what an eye would see. The stretch was fitted to the publisher\u2019s panel, which prints no scale; this is MAST\u2019s pipeline product drawn on it.',
      'Opacity is the renderer\u2019s convention, not the dust\u2019s: brightness and blocking are one number in its emission model, and the real ring blocks a small fraction of a percent of what is behind it.',
      'Nothing finer than the mosaic\u2019s pixels or the grid\u2019s cells is in the drawn volume.',
    ],
  };
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n');
  const outputs: [string, Buffer][] = [['provenance.json', provenanceBytes]];
  const deliveryGrids: { id: string; label: string; sourceUrl: string; recipe: { path: string } }[] = [];
  for (const b of built) {
    const file = `density-${b.dataset.id}.ktx2`, recipeBytes = Buffer.from(JSON.stringify({
      schema: VOLUME_RECIPE_SCHEMA,
      grid: { path: file, dimensions: [size, size, size], encoding: 'sqrt-density-unorm8', bounds: { min: [-halfUnits, -halfUnits, -halfUnits], max: [halfUnits, halfUnits, halfUnits] } },
      material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', emission: [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((color, channel) => ({ channel, color, strength: 1 })),
        absorption: [], emissionTransfer: 'shared-opacity', exposureGain: b.exposureGain },
      bake: { sliceCounts: { x: slabs, y: slabs, z: slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4, cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
      anchors: [{ id: recipe.host, referencePositionM: [0, 0, 0] }],
      provenance: { path: 'provenance.json' },
    }, null, 2) + '\n');
    outputs.push([file, Buffer.from(b.ktx2)], [`volume-${b.dataset.id}.json`, recipeBytes], [`previews/${b.dataset.id}.png`, b.previewPng]);
    deliveryGrids.push({ id: b.dataset.id, label: b.dataset.label, sourceUrl: recipe.sourceUrl, recipe: { path: `${packageBase}/volume-${b.dataset.id}.json` } });
  }
  const request = deliveryGrids.find(grid => grid.id === recipe.defaultDataset)!.recipe;
  outputs.push(['delivery.json', Buffer.from(JSON.stringify({
    schema: NEBULA_DELIVERY_SCHEMA, id, method: 'density-grid', request,
    inputPins: [{ path: `${packageBase}/provenance.json` }, ...built.map(b => ({ path: `${packageBase}/density-${b.dataset.id}.ktx2` }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc, imageRotationDegrees: 0, arcsecPerUnit: 1 / distancePc },
    sourceUrl: recipe.sourceUrl, description: recipe.description, defaultDataset: recipe.defaultDataset, framingRadiusUnits: halfUnits,
    attachedTo: recipe.host, acceptedLabResult: `${id}-density-grids`, compactInputs: request, compactMethod: 'density-grid', grids: deliveryGrids,
  }, null, 2) + '\n')]);
  const presentation = {
    schema: VOLUME_PRESENTATION_SOURCE_SCHEMA, objectId: id, name: recipe.name, defaultDataset: recipe.defaultDataset,
    bank: { path: `src/objects/${id}/prepared/datasets.json` },
    recipes: deliveryGrids.map(grid => ({ id: grid.id, path: grid.recipe.path })),
    sharedInputs: [], inputEvidence: [],
    datasets: built.map(b => ({ id: b.dataset.id, label: b.dataset.label, title: b.dataset.title, description: b.dataset.description, summary: b.dataset.summary,
      detail: `${String(b.bands[0]!.primary['DATE-OBS'])}, ${(b.bands[0]!.sky.mosaicArcsecPerPixel * 1000).toFixed(1)} mas pixels`,
      facts: [
        { id: 'instrument', label: 'Instrument', value: `${b.bands[0]!.origin.instrument}, ${b.bands[0]!.origin.observed}: ${[...new Set(b.bands.map(band => filterOf(band.band)))].join(', ')}` },
        { id: 'color', label: 'Color', value: b.dataset.colorMap ? `Brightness in ${b.dataset.colorMap.unit}, from ${b.dataset.colorMap.range[0]} to ${b.dataset.colorMap.range[1]}, in the publisher's color map` : b.dataset.deposit ? `Brightness only: one filter (${b.dataset.deposit.filter}) in every channel, in the deposit's ${b.dataset.deposit.unit}` : `Reflectance: each filter over the star's own flux, ${CHANNELS.map(channel => `${channel} ${b.dataset.channels[channel].map(filterOf).join(' + ')}`).join(', ')}` },
        ...(b.kind === 'edge-on'
          ? [{ id: 'midplane', label: 'Midplane measured here', value: `Position angle ${b.geometry.positionAngleDeg.toFixed(1)}° (published ${b.dataset.published.positionAngleDeg}°); the ${compass(b.geometry.positionAngleDeg)} side is ${b.geometry.sideBrightness.ratio.toFixed(2)} times as bright as the ${compass(b.geometry.positionAngleDeg + 180)}` }]
          : [b.dataset.adoptPublishedRing ? { id: 'ring', label: 'Ring', value: `${b.dataset.published.radiusUnits} au, tilted ${b.dataset.published.inclinationDeg}°, nodes at position angle ${b.dataset.published.positionAngleDeg}°: the published fit to these observations, not measured on this image` } : { id: 'ring', label: 'Ring measured here', value: `${b.geometry.semiMajorUnits.toFixed(0)} au, tilted ${b.geometry.inclinationDeg.toFixed(0)}°, nodes at position angle ${b.geometry.positionAngleDeg.toFixed(0)}°; published ${b.dataset.published.radiusUnits} au, ${b.dataset.published.inclinationDeg}°, ${b.dataset.published.positionAngleDeg}°` }]),
        { id: 'extent', label: 'Drawn extent', value: `${b.innerMaskUnits.toFixed(0)} to ${halfUnits} au; the light reaches the noise at ${b.taperFromUnits.toFixed(0)} au` },
        { id: 'depth', label: 'Depth', value: b.kind === 'edge-on' ? `Not measured; reconstructed from the image by axial symmetry about the disc's normal, tilted toward its ${compass(b.dataset.nearSidePositionAngleDeg)} side by convention` : `Not measured; the inclined ring that best projects to the images, with its ${compass(b.dataset.nearSidePositionAngleDeg)} side nearer by convention` },
      ],
      input: inputOf(b.dataset, b.bands[0]!),
      preview: { path: `${packageBase}/previews/${b.dataset.id}.png`, authoredFrom: inputOf(b.dataset, b.bands[0]!) } })),
  };
  outputs.push(['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')]);
  // The manifest: every retained byte under source/ and the downloads it reads, accounted for once.
  const recipeBytes = await readFile(resolve(root, 'circumstellar.json'));
  type Pinned = { inputs?: { id?: string; sourceBinding?: { references?: { catalogueId?: string; evidence?: string }[] } }[] };
  const pinned: Pinned = await readFile(resolve(root, 'manifest.json'), 'utf8').then(text => JSON.parse(text) as Pinned, (): Pinned => ({}));
  const pinnedEvidence = new Map((pinned.inputs ?? []).flatMap(input => (input.sourceBinding?.references ?? []).map(reference => [`${input.id}/${reference.catalogueId}`, reference.evidence])));
  const inputs = built.flatMap(b => b.bands.map(band => ({ dataset: b.dataset, band }))).map(({ dataset, band }, index) => {
    const inputId = inputOf(dataset, band), catalogueId = `source-${id}-${inputId}`;
    const evidence = pinnedEvidence.get(`${inputId}/${catalogueId}`) ?? `${packageBase}/manifest.json#/inputs/${index}`;
    return { id: inputId, dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] },
      path: dataset.deposit ? dataset.deposit.path : dataset.archive ? dataset.archive.path : dataset.hst ? `${dataset.hst.work}/psf-subtracted/${band.origin.file}` : `${downloadsBase}/observations/${band.origin.file}`, origin: band.origin.url, sourceUrl: band.origin.landing,
      title: band.origin.title, credit: band.origin.credit, displayCredit: band.origin.displayCredit, acquisition: band.origin.acquisition,
      license: band.origin.license, datasetId: dataset.id };
  });
  for (const b of built) {
    const beam = b.dataset.archive?.primaryBeam;
    if (!beam) continue;
    const inputId = `${b.dataset.id}-primary-beam`, catalogueId = `source-${id}-${inputId}`, index = inputs.length;
    const evidence = pinnedEvidence.get(`${inputId}/${catalogueId}`) ?? `${packageBase}/manifest.json#/inputs/${index}`;
    inputs.push({ id: inputId, dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] }, path: beam.path, origin: beam.url,
      sourceUrl: b.dataset.archive!.landing, title: beam.title, credit: b.dataset.archive!.credit, displayCredit: b.dataset.archive!.displayCredit, acquisition: b.dataset.archive!.acquisition,
      license: b.dataset.archive!.license, datasetId: b.dataset.id });
  }
  const produced = new Map(outputs.map(([name, bytes]) => [name, bytes]));
  const local = (path: string, reason: string) => ({ id: path.replace(/[^a-z0-9-]+/gu, '-').toLowerCase(), path: `${packageBase}/${path}`, sourceBinding: { kind: 'local', reason } });
  const intermediates = outputs.filter(([name]) => name.endsWith('.ktx2') || name.startsWith('volume-') || name.startsWith('previews/')).map(([name]) =>
    local(name, `Written by packages/telescope-cli/authoring/circumstellar/author.mts from the mosaics bound above and the recipe circumstellar.json.`));
  const documents = [local('circumstellar.json', 'Object-owned recipe: the datasets, their pinned program and bands, the stated conventions and the published geometry each is checked against.'),
    ...recipe.datasets.flatMap(dataset => dataset.colorMap ? [local(dataset.colorMap.path, `The publisher's color map the ${dataset.id} dataset is shown in, read from the published figure as the file itself records (${dataset.colorMap.source}).`)] : []),
    ...['delivery.json', 'presentation.json', 'provenance.json'].map(name => local(name, 'Object-owned delivery, presentation or provenance record written by the author; the published inputs it cites are bound above.'))];
  outputs.push(['manifest.json', Buffer.from(JSON.stringify({ schema: VOLUME_SOURCE_MANIFEST_SCHEMA, pathBase: 'repository', inputs, documents, generatedIntermediates: intermediates }, null, 2) + '\n')]);
  return { outputs, measured, root };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), id = args.find(argument => !argument.startsWith('--') && !args[args.indexOf(argument) - 1]?.startsWith('--')), check = args.includes('--check');
  if (!id) throw new TypeError('Usage: author <object id> [--check] [--raw <dir>]...');
  const { outputs, measured, root } = await author(id, { sources: args.flatMap((argument, index) => argument === '--raw' ? [resolve(args[index + 1]!)] : []) });
  await mkdir(resolve(root, 'previews'), { recursive: true });
  for (const [name, bytes] of outputs) {
    const target = resolve(root, name);
    if (check) { const existing = await readFile(target).catch(() => null); if (!existing || !existing.equals(bytes)) throw new Error(`Authored output differs: ${name}`); }
    else await writeFile(target, bytes);
  }
  const summary = Object.fromEntries(Object.entries(measured).map(([dataset, m]) => [dataset, 'geometry' in m
    ? { positionAngle: +m.positionAngleDeg.toFixed(2), sideRatio: +m.sideBrightness.ratio.toFixed(3), lightEnds: +m.lightEndsUnits.toFixed(0), reconstruction: m.reconstruction.checks, voxels: m.filledVoxels }
    : { radius: +m.semiMajorUnits.toFixed(1), inclination: +m.inclinationDeg.toFixed(1), positionAngle: +m.positionAngleDeg.toFixed(1), residual: +m.envelope.residualRms.toExponential(2), shell: +m.envelope.alternatives.sphericalShell.residualRms.toExponential(2), flat: +m.envelope.alternatives.constantDepthResidualRms.toExponential(2), voxels: m.filledVoxels }]));
  console.log(`${check ? 'CHECKED' : 'AUTHORED'} ${id}: ${JSON.stringify(summary)}`);
}
