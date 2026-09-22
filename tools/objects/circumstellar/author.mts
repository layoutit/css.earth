#!/usr/bin/env node
/** Author a circumstellar volume: the material around a star, drawn from coronagraph mosaics as a density grid attached to
 * that star, the way Betelgeuse's shell is (tools/objects/source-authoring/betelgeuse-shell/author.mts), but from one
 * checked-in recipe rather than a script per star.
 *
 *   node tools/objects/circumstellar/author.mts <object id> [--check] [--raw <dir>]...
 *
 * The recipe is src/objects/<id>/source/circumstellar.json. A lens names coronagraph bands of a pinned JWST imaging program
 * (tools/objects/jwst/imaging/programs), the star's flux in each and the red, green and blue channels they average into: the
 * reflectance colour a publisher shows. Each band's MAST level-3 mosaic is downloaded into .local/<id>/observations, read about
 * the star through its own WCS (disc-envelope.mts readSkyPlane), background-subtracted and divided by the star's flux
 * (fit-figure-stretch.mts reflectanceChannels). The ring's geometry is measured on the mean of the channels, checked against
 * the published geometry the recipe cites, and the envelope that best projects to that image is fitted (disc-envelope.mts).
 * Each channel is shown through the stretch fitted to the publisher's own panel (fit-figure-stretch.mts), and the three are
 * spread along the ring with one depth profile (src/preparation/volume/column-depth.ts spreadColumns), so a line of sight keeps
 * its colour through its depth. One volume unit is one astronomical unit at the
 * star's distance; the frame is anchored on the star's prepared scene origin, so the star's sphere sits at the centre.
 *
 * --check recomputes every output and fails if any differs from the file on disk. After the first authoring, bake the bank
 * (node tools/nebula/prepare.mts --object=<id>) and author again: the presentation pins the baked bank. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { sha256, sha256File } from '../../../src/platform/sha256.mts';
import { encodeDensityKtx2 } from '../../../src/preparation/volume/acquisition.ts';
import { gainForTopAlpha, spreadColumns } from '../../../src/preparation/volume/column-depth.ts';
import { readFitsFileHdus } from '../../fits/fits.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { CHANNELS, reflectanceChannels, stretchOf } from './fit-figure-stretch.mts';
import { mastDownloadUrl, mastFile } from '../astronomy-packages/mast.mts';
import { readImagingProgram } from '../jwst/imaging/image3.mts';
import { JWST_BANDS } from '../jwst/imaging/bands.mts';
import { DEFAULT_SEARCH, discDensity, fitDiscEnvelope, profileDiscDensity, scoreEnvelope, readSkyPlane, ringGeometry, type SkyPlane } from './disc-envelope.mts';

const METERS_PER_PARSEC = 3.085677581491367e16;

export interface CircumstellarLens {
  readonly id: string; readonly label: string; readonly title: string; readonly summary: string; readonly description: string;
  readonly program: string;
  /** The coronagraph bands each display channel averages, longest wavelengths red. */
  readonly channels: Readonly<Record<(typeof CHANNELS)[number], readonly string[]>>;
  /** The star's flux in each band, which each band is divided by to give reflectance; and where it is published. */
  readonly stellarFluxJy: Readonly<Record<string, number>>; readonly stellarFluxSource: string;
  /** The display stretch, log(1 + a u) / log(1 + a) with u = reflectance / top, fitted to the publisher's panel. */
  readonly stretch: { readonly a: number; readonly top: number; readonly source: string; readonly fit: Record<string, unknown> };
  /** Inside this radius the coronagraph mask holds the star and the image is not data; the source of the number. */
  readonly innerMaskArcsec: number; readonly innerMaskSource: string;
  /** The ring's annulus, in units, scored out to `outerUnits`. The image is drawn to the grid edge, tapering from where its
   * deprojected median brightness falls to the per-pixel noise, which the author measures. */
  readonly outerUnits: number;
  readonly backgroundAnnulusArcsec: readonly [number, number];
  /** Conventions, stated: which end of the minor axis is nearer the observer, and the ring's vertical height as a fraction of its radius. */
  readonly nearSidePositionAngleDeg: number; readonly nearSideSource: string; readonly heightOfRadius: number;
  /** The alpha the brightest column reaches. */
  readonly topAlpha: number;
  /** The published geometry the measured ring is checked against. */
  readonly published: { readonly citation: string; readonly url: string; readonly radiusUnits: number; readonly inclinationDeg: number; readonly positionAngleDeg: number; readonly toleranceDeg: number; readonly radiusTolerance: number };
}
export interface CircumstellarRecipe {
  readonly schema: 'cssearth-circumstellar-volume@1';
  readonly id: string; readonly host: string; readonly name: string; readonly description: string; readonly sourceUrl: string;
  readonly credit: string; readonly license: { readonly spdx: string; readonly note: string; readonly url: string };
  readonly grid: { readonly size: number; readonly halfUnits: number; readonly slabs: number };
  readonly defaultLens: string;
  readonly lenses: readonly CircumstellarLens[];
}
export function parseCircumstellarRecipe(value: unknown): CircumstellarRecipe {
  const row = requireRecord(value, 'circumstellar recipe');
  if (row.schema !== 'cssearth-circumstellar-volume@1') throw new TypeError('Unsupported circumstellar recipe.');
  const grid = requireRecord(row.grid, 'grid'), license = requireRecord(row.license, 'license');
  const lenses = requireArray(row.lenses).map(raw => {
    const lens = requireRecord(raw, 'lens'), published = requireRecord(lens.published, 'published geometry'), annulus = requireArray(lens.backgroundAnnulusArcsec);
    const number = (key: string, from: Record<string, unknown> = lens) => requireFiniteNumber(from[key], key);
    const channelRecord = requireRecord(lens.channels, 'channels'), fluxRecord = requireRecord(lens.stellarFluxJy, 'stellar fluxes');
    const channels = Object.fromEntries(CHANNELS.map(channel => {
      const bands = requireArray(channelRecord[channel]).map(band => requireString(band));
      if (!bands.length) throw new TypeError(`The ${channel} channel names no band.`);
      for (const band of bands) {
        if (!Object.hasOwn(JWST_BANDS, band) || !JWST_BANDS[band]!.coronagraph) throw new TypeError(`${band} is not a coronagraph band.`);
        if (!(requireFiniteNumber(fluxRecord[band], `${band} stellar flux`) > 0)) throw new TypeError(`${band}: the stellar flux is positive.`);
      }
      return [channel, bands];
    })) as unknown as CircumstellarLens['channels'];
    const stretchRecord = requireRecord(lens.stretch, 'stretch');
    const stretch = { a: number('a', stretchRecord), top: number('top', stretchRecord), source: requireString(stretchRecord.source), fit: requireRecord(stretchRecord.fit, 'stretch fit') };
    if (!(stretch.a > 0 && stretch.top > 0)) throw new TypeError('Invalid display stretch.');
    return { id: requireString(lens.id, 'lens id'), label: requireString(lens.label), title: requireString(lens.title), summary: requireString(lens.summary), description: requireString(lens.description),
      program: requireString(lens.program), channels, stellarFluxJy: fluxRecord as Record<string, number>, stellarFluxSource: requireString(lens.stellarFluxSource), stretch,
      innerMaskArcsec: number('innerMaskArcsec'), innerMaskSource: requireString(lens.innerMaskSource),
      outerUnits: number('outerUnits'), backgroundAnnulusArcsec: [requireFiniteNumber(annulus[0]), requireFiniteNumber(annulus[1])] as const,
      nearSidePositionAngleDeg: number('nearSidePositionAngleDeg'), nearSideSource: requireString(lens.nearSideSource), heightOfRadius: number('heightOfRadius'),
      topAlpha: number('topAlpha'),
      published: { citation: requireString(published.citation), url: requireString(published.url), radiusUnits: number('radiusUnits', published), inclinationDeg: number('inclinationDeg', published),
        positionAngleDeg: number('positionAngleDeg', published), toleranceDeg: number('toleranceDeg', published), radiusTolerance: number('radiusTolerance', published) } };
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

const compass = (positionAngleDeg: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((positionAngleDeg % 360) + 360) % 360 / 45) % 8]!;
const smoothstep = (a: number, b: number, t: number) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
const filterOf = (band: string): string => {
  const filter = JWST_BANDS[band]?.filter;
  if (!filter) throw new TypeError(`${band} has no imaging filter.`);
  return filter;
};
/** One manifest input per band a lens reads. */
const inputIdOf = (lens: CircumstellarLens, band: string) => `${lens.id}-${filterOf(band).toLowerCase()}`;

/** One lens: its bands read as reflectance, the ring measured on their mean and checked, the envelope fitted, the colours spread
 * along it. */
async function buildLens(recipe: CircumstellarRecipe, lens: CircumstellarLens, distancePc: number, downloads: string, sources: readonly string[]) {
  const { size, halfUnits } = recipe.grid, count = size * size, step = 2 * halfUnits / size, innerMaskUnits = lens.innerMaskArcsec * distancePc;
  const read = await reflectanceChannels({ program: lens.program, channels: lens.channels, stellarFluxJy: lens.stellarFluxJy, distancePc, halfUnits, size,
    backgroundAnnulusArcsec: lens.backgroundAnnulusArcsec, downloads, sources });
  const { program } = await readImagingProgram(lens.program), bands = [];
  for (const { band, entry, mosaic, primary } of read.entries) bands.push({ band, entry, mosaic, primary, program, sky: read.planes.get(band)!, mosaicSha256: (await sha256File(mosaic)).sha256 });
  // The ring is measured on the mean reflectance of the three channels; its noise is the bands' combined, in reflectance.
  const mean = Float32Array.from({ length: count }, (_, p) => (read.channels[0]![p]! + read.channels[1]![p]! + read.channels[2]![p]!) / 3);
  const noise = Math.sqrt(CHANNELS.reduce((total, channel) => total + lens.channels[channel].reduce((sum, band) => sum + (read.planes.get(band)!.noise / lens.stellarFluxJy[band]!) ** 2, 0) / lens.channels[channel].length ** 2, 0)) / 3;
  const sky: SkyPlane = { ...bands[0]!.sky, plane: mean, background: 0, noise, unit: 'reflectance (MJy/sr per Jy of starlight)' };
  const geometry = ringGeometry(sky, { innerMaskUnits, outerUnits: lens.outerUnits });
  const { published } = lens, angle = (a: number, b: number) => Math.abs(((a - b) % 180 + 270) % 180 - 90);
  const differences = { radius: Math.abs(geometry.semiMajorUnits / published.radiusUnits - 1), inclinationDeg: Math.abs(geometry.inclinationDeg - published.inclinationDeg), positionAngleDeg: angle(geometry.positionAngleDeg, published.positionAngleDeg) };
  if (differences.radius > published.radiusTolerance || differences.inclinationDeg > published.toleranceDeg || differences.positionAngleDeg > published.toleranceDeg)
    throw new Error(`${lens.id}: the measured ring (radius ${geometry.semiMajorUnits.toFixed(1)}, inclination ${geometry.inclinationDeg.toFixed(1)}, position angle ${geometry.positionAngleDeg.toFixed(1)}) does not match ${published.citation} (${published.radiusUnits}, ${published.inclinationDeg}, ${published.positionAngleDeg}).`);
  const fit = fitDiscEnvelope(sky, geometry, { innerMaskUnits, outerUnits: lens.outerUnits, nearSidePositionAngleDeg: lens.nearSidePositionAngleDeg, heightOfRadius: lens.heightOfRadius });
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
    throw new Error(`${lens.id}: the light reaches the noise at ${lightEndsUnits?.toFixed(0) ?? 'no radius inside the grid'}; the grid (${halfUnits} au) must reach 1.25 times that.`);
  const taperFromUnits = lightEndsUnits;
  // The drawn envelope: a disc of the measured geometry whose surface density follows the image's own deprojected radial
  // profile, so the halo lies in the disc plane like the ring. It has to project to the image better than the fitted gaussian
  // ring, the spherical shell and constant depth, or the author refuses.
  const planeProfile = radialProfile.filter(ring => ring.radiusUnits >= innerMaskUnits).map(ring => ({ radiusUnits: ring.radiusUnits, value: Math.max(0, ring.median) }));
  const drawnModel = { ...fit.ring };
  const density = profileDiscDensity(drawnModel, planeProfile);
  const profileScore = scoreEnvelope(sky, density, { innerMaskUnits, outerUnits: lens.outerUnits });
  if (!(profileScore.residualRms < fit.ring.residualRms && profileScore.residualRms < fit.shell.residualRms && profileScore.residualRms < fit.constantDepthResidualRms))
    throw new Error(`${lens.id}: the measured-profile disc (${profileScore.residualRms.toExponential(3)}) does not beat the ring (${fit.ring.residualRms.toExponential(3)}), the shell (${fit.shell.residualRms.toExponential(3)}) and constant depth (${fit.constantDepthResidualRms.toExponential(3)}).`);
  // How much light each envelope would put on the cube's front and back faces: the share of every drawn column's depth
  // weight within two cells of them.
  const faceShare = (d: (x: number, y: number, z: number) => number) => {
    let face = 0, total = 0;
    for (let j = 0; j < size; j += 2) for (let i = 0; i < size; i += 2) {
      const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, r = Math.hypot(x, y);
      if (r < innerMaskUnits || r > taperFromUnits) continue;
      let column = 0, edge = 0;
      for (let k = 0; k < size; k++) { const z = -halfUnits + (k + 0.5) * step, w = d(x, y, z); column += w; if (k < 2 || k >= size - 2) edge += w; }
      if (column > 0) { face += edge / column; total++; }
    }
    return face / total;
  };
  const cubeFaceShare = { gaussianRing: faceShare(discDensity(fit.ring)), measuredProfileDisc: faceShare(density) };
  // Each channel goes through the stretch fitted to the publisher's panel; under the drawn inner edge is not data, and beyond
  // the light's end it tapers to the grid edge.
  const display = stretchOf(lens.stretch.a, lens.stretch.top), shown = [0, 1, 2].map(() => new Float32Array(count).fill(NaN));
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = j * size + i, r = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step);
    if (r < innerMaskUnits || !read.channels.every(channel => Number.isFinite(channel[p]!))) continue;
    const taper = 1 - smoothstep(taperFromUnits, halfUnits, r);
    for (let c = 0; c < 3; c++) shown[c]![p] = display(read.channels[c]![p]!) * taper;
  }
  const channels = shown;
  const zs = Array.from({ length: size }, (_, k) => -halfUnits + (k + 0.5) * step);
  const spread = spreadColumns({ width: size, height: size, depth: size, channels, depthStep: step,
    profile: (i, j, out) => { const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step; let total = 0; for (const [k, z] of zs.entries()) { out[k] = density(x, y, z); total += out[k]!; } return total; } });
  const ktx2 = encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: spread.rgba }, 9);
  // The baker integrates each channel's decoded density (its column over the grid peak) in its own colour, and the renderer
  // turns the brightest channel's column into 1 - exp(-gain * column). A white column at the top of the stretch carries 1 in
  // every channel, so the gain puts exactly that column at the stated alpha.
  const exposureGain = -Math.log(1 - lens.topAlpha) * spread.peak;
  const columnEmission = (p: number) => Math.max(...spread.integral.map(channel => channel[p]! / spread.peak));
  // How opaque the drawn lines of sight are, face-on.
  const alphas = Array.from({ length: count }, (_, p) => 1 - Math.exp(-exposureGain * columnEmission(p))).filter(alpha => alpha > 0.001).sort((a, b) => a - b);
  const quantile = (q: number) => alphas[Math.min(alphas.length - 1, Math.floor(q * (alphas.length - 1)))]!;
  const opacity = { drawnColumns: alphas.length, median: quantile(0.5), p90: quantile(0.9), max: alphas.at(-1)! };
  // A preview of the image as read, in its displayed colours: north up, east left.
  const preview = Buffer.alloc(count * 3);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // The sky plane's x grows west and y north, so north up and east left is row flipped, column kept.
    const p = (size - 1 - j) * size + i;
    preview.set([0, 1, 2].map(c => Number.isFinite(shown[c]![p]!) ? Math.round(255 * Math.min(1, shown[c]![p]!)) : 0), (j * size + i) * 3);
  }
  const previewPng = await sharp(preview, { raw: { width: size, height: size, channels: 3 } }).resize(512, 512, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toBuffer();
  return { lens, bands, geometry, fit, profileScore, cubeFaceShare, innerMaskUnits, taperFromUnits, radialProfile, spread, ktx2, exposureGain, opacity, previewPng, differences };
}

export async function author(id: string, options: { sources?: readonly string[] } = {}) {
  const repository = resolve(import.meta.dirname, '../../..'), packageBase = `src/objects/${id}/source`, root = resolve(repository, packageBase);
  const recipe = parseCircumstellarRecipe(JSON.parse(await readFile(resolve(root, 'circumstellar.json'), 'utf8')));
  if (recipe.id !== id) throw new TypeError(`The recipe is for ${recipe.id}, not ${id}.`);
  const downloadsBase = `.local/${id}`, downloads = resolve(repository, downloadsBase);
  const scene = requireRecord(requireRecord(JSON.parse(await readFile(resolve(repository, 'src/objects', recipe.host, 'prepared/scene.json'), 'utf8')) as unknown).worldFrame);
  const origin = requireArray(scene.originM).map(v => requireFiniteNumber(v)) as [number, number, number], distanceM = Math.hypot(...origin), distancePc = distanceM / METERS_PER_PARSEC;
  const raDeg = (Math.atan2(origin[1], origin[0]) * 180 / Math.PI + 360) % 360, decDeg = Math.asin(origin[2] / distanceM) * 180 / Math.PI;
  const built: Awaited<ReturnType<typeof buildLens>>[] = [];
  for (const lens of recipe.lenses) built.push(await buildLens(recipe, lens, distancePc, downloads, options.sources ?? []));
  const { size, halfUnits, slabs } = recipe.grid;
  const heightSpread = (b: typeof built[number]) => ((Math.max(...b.fit.heightResiduals.map(h => h.residualRms)) / Math.min(...b.fit.heightResiduals.map(h => h.residualRms)) - 1) * 100).toFixed(1);
  const measured = Object.fromEntries(built.map(b => [b.lens.id, {
    bands: b.bands.map(band => ({ band: band.band, mosaic: band.entry.level3.name, sha256: band.mosaicSha256, observed: band.primary['DATE-OBS'], starRaDecDeg: [band.primary.TARG_RA, band.primary.TARG_DEC],
      starPixel: band.sky.starPixel, mosaicArcsecPerPixel: band.sky.mosaicArcsecPerPixel, background: band.sky.background, noise: band.sky.noise, backgroundPixels: band.sky.backgroundPixels, unit: band.sky.unit })),
    channels: b.lens.channels, stellarFluxJy: b.lens.stellarFluxJy, stellarFluxSource: b.lens.stellarFluxSource, stretch: b.lens.stretch,
    innerMaskUnits: b.innerMaskUnits, lightEndsUnits: b.taperFromUnits, radialProfile: b.radialProfile.filter(ring => ring.radiusUnits <= halfUnits), ridgeSamples: b.geometry.ridge.length, ringCentreUnits: b.geometry.centreUnits, semiMajorUnits: b.geometry.semiMajorUnits, semiMinorUnits: b.geometry.semiMinorUnits,
    inclinationDeg: b.geometry.inclinationDeg, positionAngleDeg: b.geometry.positionAngleDeg, ridgeResidualUnits: b.geometry.ridgeResidualUnits, binningSpread: b.geometry.binningSpread,
    published: b.lens.published, differences: b.differences,
    envelope: { shape: 'measured-profile-disc', residualRms: b.profileScore.residualRms, cubeFaceShare: b.cubeFaceShare, heightUnits: b.fit.ring.gaussianHeightUnits,
      fittedRing: { gaussianWidthUnits: b.fit.ring.gaussianWidthUnits, gaussianHeightUnits: b.fit.ring.gaussianHeightUnits, residualRms: b.fit.ring.residualRms }, signalRms: b.fit.signalRms, scoredPixels: b.fit.scoredPixels,
      alternatives: { sphericalShell: b.fit.shell, constantDepthResidualRms: b.fit.constantDepthResidualRms }, heightResiduals: b.fit.heightResiduals, search: DEFAULT_SEARCH },
    exposureGain: b.exposureGain, topAlpha: b.lens.topAlpha, faceOnOpacity: b.opacity, droppedShare: b.spread.droppedShare, filledVoxels: b.spread.filledVoxels,
  }]));
  const provenance = {
    schema: 'cssearth-volume-provenance@1', title: `${recipe.name}: JWST coronagraph imaging given the depth of the fitted ring`, kind: 'observed-sky-image-on-fitted-envelope',
    authors: [], organizations: ['NASA/ESA/CSA JWST; MAST (STScI)'],
    license: { spdx: recipe.license.spdx, dataLicenseDeclaration: recipe.license.url, note: recipe.license.note },
    sources: built.flatMap(b => b.bands.map(band => ({ id: inputIdOf(b.lens, band.band), url: mastDownloadUrl(band.entry.level3.uri), landing: recipe.sourceUrl, sha256: band.mosaicSha256, bytes: band.entry.level3.bytes,
      role: `MAST level-3 coronagraph mosaic ${band.entry.level3.name} (calwebb_coron3), the ${filterOf(band.band)} band of the ${b.lens.id} leaves; reproduced by tools/objects/jwst/imaging/coron3.mts in programs/${b.lens.program}.${band.band}.reproduction.json` }))),
    paper: built.map(b => ({ lens: b.lens.id, citation: b.lens.published.citation, url: b.lens.published.url })),
    measured: { sceneOriginRaDecDeg: [raDeg, decDeg], distancePc, arcsecPerUnit: 1 / distancePc, grid: recipe.grid, lenses: measured },
    models: Object.fromEntries(built.map(b => [b.lens.id, `Fitted ring, in the reflectance colour the publisher shows. Each of the ${b.bands.length} mosaics is read about the star through its own WCS onto a sky plane in astronomical units; the star's position is the observation's target position (TARG_RA, TARG_DEC). Each band's background, the median in the ${b.lens.backgroundAnnulusArcsec.join('–')}″ annulus, is subtracted, and the band is divided by the star's own flux in it (${b.lens.stellarFluxSource}), which leaves how the dust reflects starlight at that wavelength. The channels average them in pairs: ${CHANNELS.map(channel => `${channel} ${b.lens.channels[channel].map(filterOf).join(' + ')}`).join(', ')}. The ring is measured on the mean of the channels: its ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse of semi-major axis ${b.geometry.semiMajorUnits.toFixed(1)} au, axis ratio ${(b.geometry.semiMinorUnits / b.geometry.semiMajorUnits).toFixed(3)} (inclination ${b.geometry.inclinationDeg.toFixed(1)}°), line of nodes at position angle ${b.geometry.positionAngleDeg.toFixed(1)}°, centre ${Math.hypot(...b.geometry.centreUnits).toFixed(1)} au from the star; the single binnings scatter by ${b.geometry.binningSpread.semiMajorUnits.toFixed(1)} au, ${b.geometry.binningSpread.inclinationDeg.toFixed(1)}° and ${b.geometry.binningSpread.positionAngleDeg.toFixed(1)}°. This stands against ${b.lens.published.citation}'s ${b.lens.published.radiusUnits} au, ${b.lens.published.inclinationDeg}° and ${b.lens.published.positionAngleDeg}°. Depth is not the image pushed backwards: a disc of that geometry whose surface density follows the image's own deprojected radial profile, halo included, projects to the mean image with a residual of ${b.profileScore.residualRms.toExponential(2)} against a signal of ${b.fit.signalRms.toExponential(2)}, where a single gaussian ring of radial width ${b.fit.ring.gaussianWidthUnits.toFixed(1)} au leaves ${b.fit.ring.residualRms.toExponential(2)}, a spherical shell ${b.fit.shell.residualRms.toExponential(2)} and constant depth, what an extrusion assumes, ${b.fit.constantDepthResidualRms.toExponential(2)}. A narrow ring would also put the light of sight lines through the halo on the cube's faces, where its density along them peaks; the profile disc puts every column where it crosses the disc plane. The ring's vertical height is a stated ${b.lens.heightOfRadius} of its radius (the projection changes by ${heightSpread(b)}% across the heights tried), and which side is nearer is a convention: ${b.lens.nearSideSource}. Each channel is shown as log(1 + a u) / log(1 + a) with u = reflectance / ${b.lens.stretch.top} and a = ${b.lens.stretch.a}; ${b.lens.stretch.source}. Every channel shares one depth profile, so each column is spread along the ring and keeps its colour. The top of the stretch reaches an alpha of ${b.lens.topAlpha}, the renderer's convention for a volume; the median drawn line of sight reaches ${b.opacity.median.toFixed(2)}. The image is drawn from ${b.innerMaskUnits.toFixed(0)} au to the grid edge at ${halfUnits} au, tapering from ${b.taperFromUnits.toFixed(0)} au, where the mean reflectance in the disc plane falls to its per-pixel noise.`])),
    limitations: [
      'One image, one epoch, one filter: no third axis was observed. The depth is the ring that best projects to the image, an inference from that projection, not a measurement.',
      'Which side of the inclined ring is nearer the observer is a stated convention; the image alone cannot tell.',
      'The ring’s vertical thickness is a stated convention; at this inclination the projection barely changes with it.',
      'Azimuthal brightness differences in the image, from forward scattering and from real structure, are kept as measured; the ring model supplies only the depth.',
      'Inside the coronagraph mask the star and its immediate surroundings are not data and are not drawn; the star is the host body’s own sphere.',
      'The colours are the dust\u2019s reflectance across 1.8 to 4.4 micrometres, the publisher\u2019s recipe, mapped to blue, green and red by wavelength: infrared colours, not what an eye would see. The stretch was fitted to the publisher\u2019s panel, which prints no scale; this is MAST\u2019s pipeline product drawn on it.',
      'Opacity is the renderer\u2019s convention, not the dust\u2019s: brightness and blocking are one number in its emission model, and the real ring blocks a small fraction of a percent of what is behind it.',
      'Nothing finer than the mosaic\u2019s pixels or the grid\u2019s cells is in the drawn volume.',
    ],
  };
  const provenanceBytes = Buffer.from(JSON.stringify(provenance, null, 2) + '\n'), provenanceSha = sha256(provenanceBytes);
  const outputs: [string, Buffer][] = [['provenance.json', provenanceBytes]];
  const deliveryGrids: { id: string; label: string; sourceUrl: string; recipe: { path: string; sha256: string } }[] = [];
  for (const b of built) {
    const file = `density-${b.lens.id}.ktx2`, recipeBytes = Buffer.from(JSON.stringify({
      schema: 'cssearth-volume-recipe@1',
      grid: { path: file, sha256: sha256(b.ktx2), decodedSha256: sha256(b.spread.rgba), dimensions: [size, size, size], encoding: 'sqrt-density-unorm8', bounds: { min: [-halfUnits, -halfUnits, -halfUnits], max: [halfUnits, halfUnits, halfUnits] } },
      material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', emission: [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((color, channel) => ({ channel, color, strength: 1 })),
        absorption: [], emissionTransfer: 'shared-opacity', exposureGain: b.exposureGain },
      bake: { sliceCounts: { x: slabs, y: slabs, z: slabs }, unitsPerSourceUnit: 1, imageWidth: 320, samplesPerSlab: 4, cropTransparent: true, opticalWeight: 1, imageEncoding: { format: 'webp', quality: 90 } },
      anchors: [{ id: recipe.host, referencePositionM: [0, 0, 0] }],
      provenance: { path: 'provenance.json', sha256: provenanceSha },
    }, null, 2) + '\n');
    outputs.push([file, Buffer.from(b.ktx2)], [`volume-${b.lens.id}.json`, recipeBytes], [`previews/${b.lens.id}.png`, b.previewPng]);
    deliveryGrids.push({ id: b.lens.id, label: b.lens.label, sourceUrl: recipe.sourceUrl, recipe: { path: `${packageBase}/volume-${b.lens.id}.json`, sha256: sha256(recipeBytes) } });
  }
  const request = deliveryGrids.find(grid => grid.id === recipe.defaultLens)!.recipe;
  outputs.push(['delivery.json', Buffer.from(JSON.stringify({
    schema: 'cssearth-nebula-delivery@1', id, method: 'density-grid', request,
    inputPins: [{ path: `${packageBase}/provenance.json`, sha256: provenanceSha }, ...built.map(b => ({ path: `${packageBase}/density-${b.lens.id}.ktx2`, sha256: sha256(b.ktx2) }))],
    sky: { centerIcrsDegrees: [raDeg, decDeg], distancePc, imageRotationDegrees: 0, arcsecPerUnit: 1 / distancePc },
    sourceUrl: recipe.sourceUrl, description: recipe.description, defaultLens: recipe.defaultLens, framingRadiusUnits: halfUnits,
    attachedTo: recipe.host, acceptedLabResult: `${id}-density-grids`, compactInputs: request, compactMethod: 'density-grid', grids: deliveryGrids,
  }, null, 2) + '\n')]);
  const presentation = {
    schema: 'cssearth-volume-presentation-source@1', objectId: id, name: recipe.name, defaultLens: recipe.defaultLens,
    bank: { path: `src/objects/${id}/prepared/lenses.json`, sha256: '', bytes: 0 },
    recipes: deliveryGrids.map(grid => ({ id: grid.id, path: grid.recipe.path, sha256: grid.recipe.sha256, bytes: outputs.find(([name]) => `${packageBase}/${name}` === grid.recipe.path)![1].length })),
    sharedInputs: [], inputEvidence: [],
    lenses: built.map(b => ({ id: b.lens.id, label: b.lens.label, title: b.lens.title, description: b.lens.description, summary: b.lens.summary,
      detail: `${String(b.bands[0]!.primary['DATE-OBS'])}, ${(b.bands[0]!.sky.mosaicArcsecPerPixel * 1000).toFixed(1)} mas pixels`,
      facts: [
        { id: 'instrument', label: 'Instrument', value: `JWST/NIRCam behind the ${JWST_BANDS[b.bands[0]!.band]!.coronagraph} coronagraph, ${String(b.bands[0]!.primary['DATE-OBS'])}: ${b.bands.map(band => filterOf(band.band)).join(', ')}` },
        { id: 'colour', label: 'Colour', value: `Reflectance: each filter over the star's own flux, ${CHANNELS.map(channel => `${channel} ${b.lens.channels[channel].map(filterOf).join(' + ')}`).join(', ')}` },
        { id: 'ring', label: 'Ring measured here', value: `${b.geometry.semiMajorUnits.toFixed(0)} au, tilted ${b.geometry.inclinationDeg.toFixed(0)}°, nodes at position angle ${b.geometry.positionAngleDeg.toFixed(0)}°; published ${b.lens.published.radiusUnits} au, ${b.lens.published.inclinationDeg}°, ${b.lens.published.positionAngleDeg}°` },
        { id: 'extent', label: 'Drawn extent', value: `${b.innerMaskUnits.toFixed(0)} to ${halfUnits} au; the light reaches the noise at ${b.taperFromUnits.toFixed(0)} au` },
        { id: 'depth', label: 'Depth', value: `Not measured; the inclined ring that best projects to the images, with its ${compass(b.lens.nearSidePositionAngleDeg)} side nearer by convention` },
      ],
      input: inputIdOf(b.lens, b.bands[0]!.band),
      preview: { path: `${packageBase}/previews/${b.lens.id}.png`, sha256: sha256(b.previewPng), bytes: b.previewPng.length, authoredFrom: inputIdOf(b.lens, b.bands[0]!.band) } })),
  };
  const bankBytes = await readFile(resolve(root, '..', 'prepared/lenses.json')).catch(() => null);
  if (bankBytes) presentation.bank = { path: `src/objects/${id}/prepared/lenses.json`, sha256: sha256(bankBytes), bytes: bankBytes.length };
  outputs.push(['presentation.json', Buffer.from(JSON.stringify(presentation, null, 2) + '\n')]);
  // The manifest: every retained byte under source/ and the downloads it reads, accounted for once.
  const recipeBytes = await readFile(resolve(root, 'circumstellar.json'));
  type Pinned = { inputs?: { id?: string; sourceBinding?: { references?: { catalogueId?: string; evidence?: string }[] } }[] };
  const pinned: Pinned = await readFile(resolve(root, 'manifest.json'), 'utf8').then(text => JSON.parse(text) as Pinned, (): Pinned => ({}));
  const pinnedEvidence = new Map((pinned.inputs ?? []).flatMap(input => (input.sourceBinding?.references ?? []).map(reference => [`${input.id}/${reference.catalogueId}`, reference.evidence])));
  const inputs = built.flatMap(b => b.bands.map(band => ({ lens: b.lens, band }))).map(({ lens, band }, index) => {
    const inputId = inputIdOf(lens, band.band), catalogueId = `source-${id}-${inputId}`;
    const evidence = pinnedEvidence.get(`${inputId}/${catalogueId}`) ?? `${packageBase}/manifest.json@${'0'.repeat(40)}#/inputs/${index}`;
    return { id: inputId, dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] },
      path: `${downloadsBase}/observations/${band.entry.level3.name}`, origin: mastDownloadUrl(band.entry.level3.uri), sourceUrl: recipe.sourceUrl,
      title: `MAST JWST programme ${band.program.programme} · ${band.entry.observation} level-3 coronagraph mosaic`, credit: recipe.credit, displayCredit: 'NASA/ESA/CSA JWST, MAST',
      acquisition: `Downloaded unchanged from MAST by its URI ${band.entry.level3.uri} (tools/objects/astronomy-packages/mast.mts mastFile), the pipeline's own calwebb_coron3 product of the association pinned in tools/objects/jwst/imaging/programs/${lens.program}.json. This repository re-ran that stage on the pinned toolchain and compared the result (compare.mts receipt beside the program).`,
      license: recipe.license.note, lensId: lens.id, expectedSha256: band.mosaicSha256, expectedBytes: band.entry.level3.bytes };
  });
  const produced = new Map(outputs.map(([name, bytes]) => [name, bytes]));
  const local = (path: string, reason: string) => ({ id: path.replace(/[^a-z0-9-]+/gu, '-').toLowerCase(), path: `${packageBase}/${path}`, expectedSha256: sha256(produced.get(path) ?? recipeBytes), expectedBytes: (produced.get(path) ?? recipeBytes).length, sourceBinding: { kind: 'local', reason } });
  const intermediates = outputs.filter(([name]) => name.endsWith('.ktx2') || name.startsWith('volume-') || name.startsWith('previews/')).map(([name]) =>
    local(name, `Written by tools/objects/circumstellar/author.mts from the mosaics bound above and the recipe circumstellar.json.`));
  const documents = [local('circumstellar.json', 'Object-owned recipe: the lenses, their pinned program and bands, the stated conventions and the published geometry each is checked against.'),
    ...['delivery.json', 'presentation.json', 'provenance.json'].map(name => local(name, 'Object-owned delivery, presentation or provenance record written by the author; the published inputs it cites are bound above.'))];
  outputs.push(['manifest.json', Buffer.from(JSON.stringify({ schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository', inputs, documents, generatedIntermediates: intermediates }, null, 2) + '\n')]);
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
  const summary = Object.fromEntries(Object.entries(measured).map(([lens, m]) => [lens, { radius: +m.semiMajorUnits.toFixed(1), inclination: +m.inclinationDeg.toFixed(1), positionAngle: +m.positionAngleDeg.toFixed(1), residual: +m.envelope.residualRms.toExponential(2), shell: +m.envelope.alternatives.sphericalShell.residualRms.toExponential(2), flat: +m.envelope.alternatives.constantDepthResidualRms.toExponential(2), voxels: m.filledVoxels }]));
  console.log(`${check ? 'CHECKED' : 'AUTHORED'} ${id}: ${JSON.stringify(summary)}`);
}
