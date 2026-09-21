/** The circumstellar volume recipe (src/objects/<id>/source/circumstellar.json): its lenses, their image sources and the
 * conventions and published geometry each states. Shared by author.mts and fit-figure-stretch.mts. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { JWST_BANDS } from '../jwst/imaging/bands.mts';

export const CHANNELS = ['red', 'green', 'blue'] as const;

/** An author's deposit of reduced images, pinned file by file at one commit of a public repository. */
export interface ImageDeposit {
  readonly repository: string; readonly commit: string; readonly citation: string;
  /** Each band's image: its path in the repository, bytes and sha256, and the value it pads missing data with. */
  readonly files: Readonly<Record<string, { readonly path: string; readonly bytes: number; readonly sha256: string; readonly blankValue?: number }>>;
  /** True when the authors already subtracted the sky background (from dedicated background exposures): the annulus then
   * gives only the noise, and nothing is subtracted. */
  readonly backgroundSubtracted?: boolean;
  /** The deposit's headers do not name the star; its ICRS position at the observation, and where that comes from. */
  readonly starRaDeg: number; readonly starDecDeg: number; readonly starSource: string;
}
export interface CircumstellarLens {
  readonly id: string; readonly label: string; readonly title: string; readonly summary: string; readonly description: string;
  /** Where the images come from: a pinned JWST imaging program's MAST coron3 mosaics, or an author's deposit of reduced images. */
  readonly program?: string; readonly deposit?: ImageDeposit;
  /** Reflectance (each band over the star's flux: scattered starlight) or surface brightness (the dust's own emission). */
  readonly quantity: 'reflectance' | 'surface-brightness';
  /** The bands each display channel averages, longest wavelengths red. */
  readonly channels: Readonly<Record<(typeof CHANNELS)[number], readonly string[]>>;
  /** For reflectance: the star's flux in each band, which each band is divided by; and where it is published. */
  readonly stellarFluxJy?: Readonly<Record<string, number>>; readonly stellarFluxSource?: string;
  /** Whether the ring's geometry is measured on the image and checked against the publication, or adopted from it. */
  readonly geometry: 'measured' | 'published';
  /** The display stretch, log(1 + a u) / log(1 + a) with u = reflectance / top, fitted to the publisher's panel. */
  readonly stretch?: { readonly a: number; readonly top: number; readonly source: string; readonly fit: Record<string, unknown> };
  /** Or the publisher's own printed colour scale: colours sampled evenly in log brightness from `minimum` to `maximum`. */
  readonly colorbar?: { readonly minimum: number; readonly maximum: number; readonly colours: readonly (readonly [number, number, number])[]; readonly source: string };
  /** Inside this radius the coronagraph mask holds the star and the image is not data; the source of the number. */
  readonly innerMaskArcsec: number; readonly innerMaskSource: string;
  /** Where the ring is scored from, when a separate inner component lies inside it and is drawn but is not the ring; and why. */
  readonly ringScoredFromUnits?: number; readonly ringScoredFromSource?: string;
  /** The ring's annulus, in units, scored out to `outerUnits`. The image is drawn to the grid edge, tapering from where its
   * deprojected median brightness falls to the per-pixel noise, which the author measures. */
  readonly outerUnits: number;
  readonly backgroundAnnulusArcsec: readonly [number, number];
  /** Conventions, stated: which end of the minor axis is nearer the observer, and the ring's vertical height as a fraction of its radius. */
  readonly nearSidePositionAngleDeg: number; readonly nearSideSource: string; readonly heightOfRadius: number;
  /** The alpha the brightest column reaches. */
  readonly topAlpha: number;
  /** The published geometry the measured ring is checked against. */
  readonly published: { readonly citation: string; readonly url: string; readonly radiusUnits: number; readonly inclinationDeg: number; readonly positionAngleDeg: number; readonly toleranceDeg: number; readonly radiusTolerance: number;
    /** An adopted geometry's ring centre, projected on the sky (east, north) from the star, and where it comes from. */
    readonly centreOffsetEastNorthUnits?: readonly [number, number]; readonly centreSource?: string };
}
export interface CircumstellarRecipe {
  readonly schema: 'cssearth-circumstellar-volume@1';
  readonly id: string; readonly host: string; readonly name: string; readonly description: string; readonly sourceUrl: string;
  readonly credit: string; readonly license: { readonly spdx: string; readonly note: string; readonly url: string };
  readonly grid: { readonly size: number; readonly halfUnits: number; readonly slabs: number };
  readonly defaultLens: string;
  readonly lenses: readonly CircumstellarLens[];
}
export function parseDeposit(value: unknown): ImageDeposit {
  const row = requireRecord(value, 'deposit'), files = requireRecord(row.files, 'deposit files');
  const commit = requireString(row.commit, 'deposit commit'), repository = requireString(row.repository, 'deposit repository');
  if (!/^[0-9a-f]{40}$/u.test(commit)) throw new TypeError('A deposit is pinned to a full commit.');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) throw new TypeError('A deposit names its repository as owner/name.');
  if (row.backgroundSubtracted !== undefined && typeof row.backgroundSubtracted !== 'boolean') throw new TypeError('backgroundSubtracted is true or false.');
  return { repository, commit, citation: requireString(row.citation), ...(row.backgroundSubtracted === true ? { backgroundSubtracted: true } : {}), starRaDeg: requireFiniteNumber(row.starRaDeg), starDecDeg: requireFiniteNumber(row.starDecDeg), starSource: requireString(row.starSource),
    files: Object.fromEntries(Object.entries(files).map(([band, raw]) => {
      const file = requireRecord(raw, `${band} deposit file`), sha = requireString(file.sha256);
      if (!/^[0-9a-f]{64}$/u.test(sha)) throw new TypeError(`${band}: invalid sha256.`);
      return [band, { path: requireString(file.path), bytes: requireFiniteNumber(file.bytes), sha256: sha, ...(file.blankValue === undefined ? {} : { blankValue: requireFiniteNumber(file.blankValue) }) }];
    })) };
}
export function parseCircumstellarRecipe(value: unknown): CircumstellarRecipe {
  const row = requireRecord(value, 'circumstellar recipe');
  if (row.schema !== 'cssearth-circumstellar-volume@1') throw new TypeError('Unsupported circumstellar recipe.');
  const grid = requireRecord(row.grid, 'grid'), license = requireRecord(row.license, 'license');
  const lenses = requireArray(row.lenses).map(raw => {
    const lens = requireRecord(raw, 'lens'), published = requireRecord(lens.published, 'published geometry'), annulus = requireArray(lens.backgroundAnnulusArcsec);
    const number = (key: string, from: Record<string, unknown> = lens) => requireFiniteNumber(from[key], key);
    const quantity: CircumstellarLens['quantity'] = lens.quantity === undefined ? 'reflectance' : lens.quantity === 'reflectance' || lens.quantity === 'surface-brightness' ? lens.quantity : (() => { throw new TypeError('Unknown lens quantity.'); })();
    const geometry: CircumstellarLens['geometry'] = lens.geometry === undefined ? 'measured' : lens.geometry === 'measured' || lens.geometry === 'published' ? lens.geometry : (() => { throw new TypeError('Unknown lens geometry.'); })();
    const deposit = lens.deposit === undefined ? undefined : parseDeposit(lens.deposit);
    if ((lens.program === undefined) === (deposit === undefined)) throw new TypeError(`${String(lens.id)}: a lens reads either a program or a deposit.`);
    const fluxRecord = lens.stellarFluxJy === undefined ? undefined : requireRecord(lens.stellarFluxJy, 'stellar fluxes');
    if (quantity === 'reflectance' && !fluxRecord) throw new TypeError('A reflectance lens needs the star\'s flux in each band.');
    const channelRecord = requireRecord(lens.channels, 'channels');
    const channels = Object.fromEntries(CHANNELS.map(channel => {
      const bands = requireArray(channelRecord[channel]).map(band => requireString(band));
      if (!bands.length) throw new TypeError(`The ${channel} channel names no band.`);
      for (const band of bands) {
        if (!Object.hasOwn(JWST_BANDS, band)) throw new TypeError(`${band} is not a JWST band.`);
        if (!deposit && !JWST_BANDS[band]!.coronagraph) throw new TypeError(`${band} is not a coronagraph band.`);
        if (deposit && !deposit.files[band]) throw new TypeError(`The deposit has no image for ${band}.`);
        if (quantity === 'reflectance' && !(requireFiniteNumber(fluxRecord![band], `${band} stellar flux`) > 0)) throw new TypeError(`${band}: the stellar flux is positive.`);
      }
      return [channel, bands];
    })) as unknown as CircumstellarLens['channels'];
    const centre = published.centreOffsetEastNorthUnits === undefined ? undefined : requireArray(published.centreOffsetEastNorthUnits).map(v => requireFiniteNumber(v)) as [number, number];
    if (geometry === 'published' && (!centre || centre.length !== 2 || typeof published.centreSource !== 'string' || !published.centreSource.trim())) throw new TypeError('An adopted geometry states its ring centre and its source.');
    if ((lens.stretch === undefined) === (lens.colorbar === undefined)) throw new TypeError('A lens is shown through either a fitted stretch or a printed colorbar.');
    const stretchRecord = lens.stretch === undefined ? undefined : requireRecord(lens.stretch, 'stretch');
    const stretch = stretchRecord && { a: number('a', stretchRecord), top: number('top', stretchRecord), source: requireString(stretchRecord.source), fit: requireRecord(stretchRecord.fit, 'stretch fit') };
    if (stretch && !(stretch.a > 0 && stretch.top > 0)) throw new TypeError('Invalid display stretch.');
    const colorbarRecord = lens.colorbar === undefined ? undefined : requireRecord(lens.colorbar, 'colorbar');
    const colorbar = colorbarRecord && { minimum: number('minimum', colorbarRecord), maximum: number('maximum', colorbarRecord), source: requireString(colorbarRecord.source),
      colours: requireArray(colorbarRecord.colours).map(raw => { const rgb = requireArray(raw).map(v => requireFiniteNumber(v)); if (rgb.length !== 3 || rgb.some(v => v < 0 || v > 255)) throw new TypeError('A colorbar colour is three values in 0-255.'); return rgb as unknown as readonly [number, number, number]; }) };
    if (colorbar && !(colorbar.minimum > 0 && colorbar.maximum > colorbar.minimum && colorbar.colours.length >= 2)) throw new TypeError('Invalid colorbar.');
    return { id: requireString(lens.id, 'lens id'), label: requireString(lens.label), title: requireString(lens.title), summary: requireString(lens.summary), description: requireString(lens.description),
      ...(lens.program === undefined ? {} : { program: requireString(lens.program) }), ...(deposit ? { deposit } : {}), quantity, geometry, channels,
      ...(fluxRecord ? { stellarFluxJy: fluxRecord as Record<string, number>, stellarFluxSource: requireString(lens.stellarFluxSource) } : {}), ...(stretch ? { stretch } : {}), ...(colorbar ? { colorbar } : {}),
      innerMaskArcsec: number('innerMaskArcsec'), innerMaskSource: requireString(lens.innerMaskSource),
      ...(lens.ringScoredFromUnits === undefined ? {} : { ringScoredFromUnits: number('ringScoredFromUnits'), ringScoredFromSource: requireString(lens.ringScoredFromSource) }),
      outerUnits: number('outerUnits'), backgroundAnnulusArcsec: [requireFiniteNumber(annulus[0]), requireFiniteNumber(annulus[1])] as const,
      nearSidePositionAngleDeg: number('nearSidePositionAngleDeg'), nearSideSource: requireString(lens.nearSideSource), heightOfRadius: number('heightOfRadius'),
      topAlpha: number('topAlpha'),
      published: { citation: requireString(published.citation), url: requireString(published.url), radiusUnits: number('radiusUnits', published), inclinationDeg: number('inclinationDeg', published),
        positionAngleDeg: number('positionAngleDeg', published), toleranceDeg: number('toleranceDeg', published), radiusTolerance: number('radiusTolerance', published),
        ...(centre ? { centreOffsetEastNorthUnits: centre, centreSource: requireString(published.centreSource) } : {}) } };
  });
  if (!lenses.length || new Set(lenses.map(lens => lens.id)).size !== lenses.length) throw new TypeError('Lenses need distinct ids.');
  const defaultLens = requireString(row.defaultLens);
  if (!lenses.some(lens => lens.id === defaultLens)) throw new TypeError('The default lens is not one of the lenses.');
  for (const lens of lenses) if (!(lens.outerUnits <= requireFiniteNumber(grid.halfUnits) && lens.topAlpha > 0 && lens.topAlpha < 1 && lens.heightOfRadius > 0))
    throw new TypeError(`${lens.id}: scoring ends inside the grid, and the top alpha lies in (0, 1).`);
  return { schema: row.schema, id: requireString(row.id), host: requireString(row.host), name: requireString(row.name), description: requireString(row.description), sourceUrl: requireString(row.sourceUrl),
    credit: requireString(row.credit), license: { spdx: requireString(license.spdx), note: requireString(license.note), url: requireString(license.url) },
    grid: { size: requireFiniteNumber(grid.size), halfUnits: requireFiniteNumber(grid.halfUnits), slabs: requireFiniteNumber(grid.slabs) }, defaultLens, lenses };
}
