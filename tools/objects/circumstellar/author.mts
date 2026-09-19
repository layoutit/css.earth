#!/usr/bin/env node
/** Author a circumstellar volume: the material around a star, drawn from coronagraph mosaics as a density grid attached to
 * that star, the way Betelgeuse's shell is (tools/objects/source-authoring/betelgeuse-shell/author.mts), but from one
 * checked-in recipe rather than a script per star.
 *
 *   node tools/objects/circumstellar/author.mts <object id> [--check] [--raw <dir>]...
 *
 * The recipe is src/objects/<id>/source/circumstellar.json. A lens names one coronagraph band of a pinned JWST imaging
 * program (tools/objects/jwst/imaging/programs) and the published figure whose colour bar it is drawn in. The band's MAST
 * level-3 mosaic is downloaded into .local/<id>/observations and read about the star through its own WCS (disc-envelope.mts
 * readSkyPlane), and its measured background is subtracted. The ring's geometry is measured on it, checked against the
 * published geometry the recipe cites, and the envelope that best projects to the image is fitted (disc-envelope.mts). The
 * brightness goes through the publisher's own logarithmic stretch and colours, read off their colour bar by colourbar.mts:
 * tent weights over the bar's four quarter stops ride four emission channels, so a line of sight emits the bar colour of its
 * own brightness, and every channel is spread along the ring with one depth profile (src/preparation/volume/column-depth.ts
 * spreadColumns), so it keeps that colour through its depth. One volume unit is one astronomical unit at the
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
import { readFitsFileHdus } from '../../fits.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { logBarPosition, quarterWeights, type LogBar } from './colourbar.mts';
import { mastDownloadUrl, mastFile } from '../jwst/mast.mts';
import { readImagingProgram } from '../jwst/imaging/image3.mts';
import { JWST_BANDS } from '../jwst/imaging/bands.mts';
import { DEFAULT_SEARCH, discDensity, fitDiscEnvelope, readSkyPlane, ringGeometry, type SkyPlane } from './disc-envelope.mts';

const METERS_PER_PARSEC = 3.085677581491367e16;

export interface CircumstellarLens {
  readonly id: string; readonly label: string; readonly title: string; readonly summary: string; readonly description: string;
  readonly program: string; readonly band: string;
  /** The publisher's colour bar for this band, measured by colourbar.mts: its logarithmic stretch in the image's units, its
   * four quarter stops (0-255, black below the first), the figure it is printed in, and how well the stretch fits its ticks. */
  readonly colourMap: { readonly figure: string; readonly url: string; readonly bar: LogBar; readonly stops: readonly (readonly [number, number, number])[]; readonly tickErrorPixels: number };
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
    const band = requireString(lens.band);
    if (!Object.hasOwn(JWST_BANDS, band) || !JWST_BANDS[band]!.coronagraph) throw new TypeError(`${band} is not a coronagraph band.`);
    const map = requireRecord(lens.colourMap, 'colour map'), bar = requireRecord(map.bar, 'bar');
    const stops = requireArray(map.stops).map(stop => { const rgb = requireArray(stop).map(v => requireFiniteNumber(v)); if (rgb.length !== 3 || !rgb.every(v => v >= 0 && v <= 255)) throw new TypeError('A stop is three bytes.'); return rgb as unknown as readonly [number, number, number]; });
    if (stops.length !== 4) throw new TypeError('A colour map carries four stops, one per channel.');
    const colourMap = { figure: requireString(map.figure), url: requireString(map.url), bar: { vmin: number('vmin', bar), vmax: number('vmax', bar), a: number('a', bar) }, stops, tickErrorPixels: number('tickErrorPixels', map) };
    if (!(colourMap.bar.vmax > colourMap.bar.vmin && colourMap.bar.a > 0)) throw new TypeError('Invalid colour bar stretch.');
    return { id: requireString(lens.id, 'lens id'), label: requireString(lens.label), title: requireString(lens.title), summary: requireString(lens.summary), description: requireString(lens.description),
      program: requireString(lens.program), band, colourMap,
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
const filterOf = (band: string) => JWST_BANDS[band]!.filter;

/** One band: its mosaic read about the star onto the sky plane, background subtracted. */
async function readBand(recipe: CircumstellarRecipe, lens: CircumstellarLens, band: string, distancePc: number, downloads: string, sources: readonly string[]) {
  const { program } = await readImagingProgram(lens.program), entry = program.bands.find(other => other.band === band);
  if (!entry || entry.stage !== 'coron3') throw new Error(`${lens.program} has no coron3 band ${band}.`);
  const mosaic = await mastFile(entry.level3, resolve(downloads, 'observations'), sources), mosaicSha256 = (await sha256File(mosaic)).sha256;
  const primary = (await readFitsFileHdus(mosaic))[0]!.header;
  const starRaDeg = requireFiniteNumber(primary.TARG_RA, 'TARG_RA'), starDecDeg = requireFiniteNumber(primary.TARG_DEC, 'TARG_DEC');
  const { size, halfUnits } = recipe.grid;
  const sky = await readSkyPlane(mosaic, { starRaDeg, starDecDeg, arcsecPerUnit: 1 / distancePc, halfUnits, size, backgroundAnnulusArcsec: lens.backgroundAnnulusArcsec });
  return { band, program, entry, mosaic, mosaicSha256, primary, sky };
}

/** One lens: its band read, the ring measured on it and checked, the envelope fitted, the publisher's colours spread along it. */
async function buildLens(recipe: CircumstellarRecipe, lens: CircumstellarLens, distancePc: number, downloads: string, sources: readonly string[]) {
  const read = await readBand(recipe, lens, lens.band, distancePc, downloads, sources), bands = [read], { sky } = read;
  const { size, halfUnits } = recipe.grid, count = size * size, step = 2 * halfUnits / size, innerMaskUnits = lens.innerMaskArcsec * distancePc;
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
  // Each sky sample's brightness goes through the publisher's own stretch to a position along their bar; under the drawn
  // inner edge is not data, and beyond the ring the light tapers to the grid edge.
  const positions = new Float32Array(count).fill(NaN);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const p = j * size + i, r = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step), v = sky.plane[p]!;
    if (r < innerMaskUnits || !Number.isFinite(v)) continue;
    positions[p] = logBarPosition(lens.colourMap.bar, v) * (1 - smoothstep(taperFromUnits, halfUnits, r));
  }
  const channels = [0, 1, 2, 3].map(k => Float32Array.from(positions, position => Number.isFinite(position) ? quarterWeights(position)[k]! : NaN));
  const density = discDensity(fit.ring), zs = Array.from({ length: size }, (_, k) => -halfUnits + (k + 0.5) * step);
  const spread = spreadColumns({ width: size, height: size, depth: size, channels, depthStep: step,
    profile: (i, j, out) => { const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step; let total = 0; for (const [k, z] of zs.entries()) { out[k] = density(x, y, z); total += out[k]!; } return total; } });
  const ktx2 = encodeDensityKtx2({ width: size, height: size, depth: size, encodedRgba: spread.rgba }, 9);
  // The baker integrates each channel's decoded density (its column over the grid peak) times that channel's stop colour, and
  // the renderer turns the brightest colour's column into 1 - exp(-gain * column). A column at the top of the publisher's bar
  // carries weight 1 on the last stop, so the gain puts exactly that column at the stated alpha.
  const stopColours = lens.colourMap.stops.map(stop => stop.map(v => v / 255));
  const exposureGain = -Math.log(1 - lens.topAlpha) * spread.peak / Math.max(...stopColours.at(-1)!);
  const columnEmission = (p: number) => Math.max(...[0, 1, 2].map(c => spread.integral.reduce((total, channel, k) => total + channel[p]! / spread.peak * stopColours[k]![c]!, 0)));
  // How opaque the drawn lines of sight are, face-on.
  const alphas = Array.from({ length: count }, (_, p) => 1 - Math.exp(-exposureGain * columnEmission(p))).filter(alpha => alpha > 0.001).sort((a, b) => a - b);
  const quantile = (q: number) => alphas[Math.min(alphas.length - 1, Math.floor(q * (alphas.length - 1)))]!;
  const opacity = { drawnColumns: alphas.length, median: quantile(0.5), p90: quantile(0.9), max: alphas.at(-1)! };
  // A preview of the image as read, in the publisher's colours: north up, east left.
  const preview = Buffer.alloc(count * 3);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // The sky plane's x grows west and y north, so north up and east left is row flipped, column kept.
    const position = positions[(size - 1 - j) * size + i]!, w = Number.isFinite(position) ? quarterWeights(position) : [0, 0, 0, 0];
    preview.set([0, 1, 2].map(c => Math.round(Math.min(255, w.reduce((total, weight, k) => total + weight * lens.colourMap.stops[k]![c]!, 0)))), (j * size + i) * 3);
  }
  const previewPng = await sharp(preview, { raw: { width: size, height: size, channels: 3 } }).resize(512, 512, { kernel: 'nearest' }).png({ compressionLevel: 9 }).toBuffer();
  return { lens, bands, geometry, fit, innerMaskUnits, taperFromUnits, radialProfile, spread, ktx2, exposureGain, opacity, previewPng, differences };
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
    colourMap: b.lens.colourMap,
    innerMaskUnits: b.innerMaskUnits, lightEndsUnits: b.taperFromUnits, radialProfile: b.radialProfile.filter(ring => ring.radiusUnits <= halfUnits), ridgeSamples: b.geometry.ridge.length, ringCentreUnits: b.geometry.centreUnits, semiMajorUnits: b.geometry.semiMajorUnits, semiMinorUnits: b.geometry.semiMinorUnits,
    inclinationDeg: b.geometry.inclinationDeg, positionAngleDeg: b.geometry.positionAngleDeg, ridgeResidualUnits: b.geometry.ridgeResidualUnits, binningSpread: b.geometry.binningSpread,
    published: b.lens.published, differences: b.differences,
    envelope: { shape: b.fit.shape, gaussianWidthUnits: b.fit.ring.gaussianWidthUnits, gaussianHeightUnits: b.fit.ring.gaussianHeightUnits, residualRms: b.fit.ring.residualRms, signalRms: b.fit.signalRms, scoredPixels: b.fit.scoredPixels,
      alternatives: { sphericalShell: b.fit.shell, constantDepthResidualRms: b.fit.constantDepthResidualRms }, heightResiduals: b.fit.heightResiduals, search: DEFAULT_SEARCH },
    exposureGain: b.exposureGain, topAlpha: b.lens.topAlpha, faceOnOpacity: b.opacity, droppedShare: b.spread.droppedShare, filledVoxels: b.spread.filledVoxels,
  }]));
  const provenance = {
    schema: 'cssearth-volume-provenance@1', title: `${recipe.name}: JWST coronagraph imaging given the depth of the fitted ring`, kind: 'observed-sky-image-on-fitted-envelope',
    authors: [], organizations: ['NASA/ESA/CSA JWST; MAST (STScI)'],
    license: { spdx: recipe.license.spdx, dataLicenseDeclaration: recipe.license.url, note: recipe.license.note },
    sources: built.flatMap(b => b.bands.map(band => ({ id: b.lens.id, url: mastDownloadUrl(band.entry.level3.uri), landing: recipe.sourceUrl, sha256: band.mosaicSha256, bytes: band.entry.level3.bytes,
      role: `MAST level-3 coronagraph mosaic ${band.entry.level3.name} (calwebb_coron3), the ${filterOf(band.band)} band of the ${b.lens.id} leaves; reproduced by tools/objects/jwst/imaging/coron3.mts in programs/${b.lens.program}.${band.band}.reproduction.json` }))),
    paper: built.map(b => ({ lens: b.lens.id, citation: b.lens.published.citation, url: b.lens.published.url })),
    measured: { sceneOriginRaDecDeg: [raDeg, decDeg], distancePc, arcsecPerUnit: 1 / distancePc, grid: recipe.grid, lenses: measured },
    models: Object.fromEntries(built.map(b => [b.lens.id, `Fitted ring, drawn in the publisher's own colours and scale. The ${filterOf(b.lens.band)} mosaic is read about the star through its own WCS onto a sky plane in astronomical units; the star's position is the observation's target position (TARG_RA, TARG_DEC). Its background, the median in the ${b.lens.backgroundAnnulusArcsec.join('–')}″ annulus (${b.bands[0]!.sky.background.toFixed(3)} ${b.bands[0]!.sky.unit}), is subtracted so that zero is empty sky, as on the published scale. The ring's ridge, the radius of peak brightness in each azimuth under nine binnings, traces an ellipse of semi-major axis ${b.geometry.semiMajorUnits.toFixed(1)} au, axis ratio ${(b.geometry.semiMinorUnits / b.geometry.semiMajorUnits).toFixed(3)} (inclination ${b.geometry.inclinationDeg.toFixed(1)}°), line of nodes at position angle ${b.geometry.positionAngleDeg.toFixed(1)}°, centre ${Math.hypot(...b.geometry.centreUnits).toFixed(1)} au from the star; the single binnings scatter by ${b.geometry.binningSpread.semiMajorUnits.toFixed(1)} au, ${b.geometry.binningSpread.inclinationDeg.toFixed(1)}° and ${b.geometry.binningSpread.positionAngleDeg.toFixed(1)}°. This stands against ${b.lens.published.citation}'s ${b.lens.published.radiusUnits} au, ${b.lens.published.inclinationDeg}° and ${b.lens.published.positionAngleDeg}°. Depth is not the image pushed backwards: an inclined ring of that geometry with gaussian radial width ${b.fit.ring.gaussianWidthUnits.toFixed(1)} au projects to the image with a residual of ${b.fit.ring.residualRms.toExponential(2)} against a signal of ${b.fit.signalRms.toExponential(2)}, where a spherical shell leaves ${b.fit.shell.residualRms.toExponential(2)} and constant depth, what an extrusion assumes, leaves ${b.fit.constantDepthResidualRms.toExponential(2)}. The ring's vertical height is a stated ${b.lens.heightOfRadius} of its radius (the projection changes by ${heightSpread(b)}% across the heights tried), and which side is nearer is a convention: ${b.lens.nearSideSource}. Colour and scale are the publisher's: ${b.lens.colourMap.figure}, whose printed ticks follow log(1 + a u) / log(1 + a) with a = ${b.lens.colourMap.bar.a}, from ${b.lens.colourMap.bar.vmin} to ${b.lens.colourMap.bar.vmax} ${b.bands[0]!.sky.unit} (every tick within ${b.lens.colourMap.tickErrorPixels} figure pixel), in the bar's colours at its quarters, carried as four emission channels whose tent weights interpolate the bar. Every channel shares one depth profile, so each column is spread along the ring and emits the bar colour of its own brightness. The top of the bar reaches an alpha of ${b.lens.topAlpha}, the renderer's convention for a volume; the median drawn line of sight reaches ${b.opacity.median.toFixed(2)}. The image is drawn from ${b.innerMaskUnits.toFixed(0)} au to the grid edge at ${halfUnits} au, tapering from ${b.taperFromUnits.toFixed(0)} au, where the median brightness in the disc plane falls to the per-pixel noise (${b.bands[0]!.sky.noise.toFixed(2)} ${b.bands[0]!.sky.unit}).`])),
    limitations: [
      'One image, one epoch, one filter: no third axis was observed. The depth is the ring that best projects to the image, an inference from that projection, not a measurement.',
      'Which side of the inclined ring is nearer the observer is a stated convention; the image alone cannot tell.',
      'The ring’s vertical thickness is a stated convention; at this inclination the projection barely changes with it.',
      'Azimuthal brightness differences in the image, from forward scattering and from real structure, are kept as measured; the ring model supplies only the depth.',
      'Inside the coronagraph mask the star and its immediate surroundings are not data and are not drawn; the star is the host body’s own sphere.',
      'The colours are the publisher\u2019s legend for surface brightness in this filter, on their logarithmic scale; they are not the colour of the dust. Their scale was printed for their own reduction of the same exposures; this is MAST\u2019s pipeline product drawn on it.',
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
      material: { intensityScale: 1, stepScale: 1, stepMetric: 'source', emission: b.lens.colourMap.stops.map((stop, channel) => ({ channel, color: stop.map(v => +(v / 255).toFixed(4)), strength: 1 })),
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
        { id: 'instrument', label: 'Instrument', value: `JWST/NIRCam ${filterOf(b.lens.band)} behind the ${JWST_BANDS[b.lens.band]!.coronagraph} coronagraph, ${String(b.bands[0]!.primary['DATE-OBS'])}` },
        { id: 'scale', label: 'Scale', value: `Surface brightness ${b.lens.colourMap.bar.vmin.toFixed(1)} to ${b.lens.colourMap.bar.vmax} ${b.bands[0]!.sky.unit}, logarithmic, in the colours and scale of ${b.lens.colourMap.figure}` },
        { id: 'ring', label: 'Ring measured here', value: `${b.geometry.semiMajorUnits.toFixed(0)} au, tilted ${b.geometry.inclinationDeg.toFixed(0)}°, nodes at position angle ${b.geometry.positionAngleDeg.toFixed(0)}°; published ${b.lens.published.radiusUnits} au, ${b.lens.published.inclinationDeg}°, ${b.lens.published.positionAngleDeg}°` },
        { id: 'extent', label: 'Drawn extent', value: `${b.innerMaskUnits.toFixed(0)} to ${halfUnits} au; the light reaches the noise at ${b.taperFromUnits.toFixed(0)} au` },
        { id: 'depth', label: 'Depth', value: `Not measured; the inclined ring that best projects to the images, with its ${compass(b.lens.nearSidePositionAngleDeg)} side nearer by convention` },
      ],
      input: b.lens.id,
      preview: { path: `${packageBase}/previews/${b.lens.id}.png`, sha256: sha256(b.previewPng), bytes: b.previewPng.length, authoredFrom: b.lens.id } })),
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
    const inputId = lens.id, catalogueId = `source-${id}-${inputId}`;
    const evidence = pinnedEvidence.get(`${inputId}/${catalogueId}`) ?? `${packageBase}/manifest.json@${'0'.repeat(40)}#/inputs/${index}`;
    return { id: inputId, dependencies: [], sourceBinding: { kind: 'catalogued', references: [{ catalogueId, role: 'material', evidence }] },
      path: `${downloadsBase}/observations/${band.entry.level3.name}`, origin: mastDownloadUrl(band.entry.level3.uri), sourceUrl: recipe.sourceUrl,
      title: `MAST JWST programme ${band.program.programme} · ${band.entry.observation} level-3 coronagraph mosaic`, credit: recipe.credit, displayCredit: 'NASA/ESA/CSA JWST, MAST',
      acquisition: `Downloaded unchanged from MAST by its URI ${band.entry.level3.uri} (tools/objects/jwst/mast.mts mastFile), the pipeline's own calwebb_coron3 product of the association pinned in tools/objects/jwst/imaging/programs/${lens.program}.json. This repository re-ran that stage on the pinned toolchain and compared the result (compare.mts receipt beside the program).`,
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
