/** Attach a body's surface panoramas to its prepared runtime definition: six sky-cube faces and a thumbnail each, written to
 * the body's public scene directory, and a small `panoramas` plan the runtime opens them from. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import type { AuthoredObjectDescriptor } from '@cssearth/objects';
import { compileCssSky, type BakedSky } from '../../sky/index.ts';
import { DECORATIVE_WEBP, writeLossyWebp } from '../../raster/index.ts';
import { parseSurfacePanoramas, type SurfacePanorama, type SurfacePanoramas, type TiePointPlacement } from './document.ts';
import { locatePanorama, parsePlacesTable, type PanoramaSite } from './site.ts';
import { panoramaFacePixels, scaledGeometry, SKY_BASES, statedGeometry, type PanoramaGeometry, type RgbImage } from './cube.ts';
import { apolloEquipment, groundElapsedUtc, hasselbladStandpoint } from './apollo.ts';
import { fitTieAzimuths, localBearing, sunDirection, type TieAzimuth, type TieFit } from './register.ts';
import { fitHorizon, horizonProfile, readNacDtm, skylineRows, type TerrainGrid } from './horizon.ts';

export const SURFACE_PANORAMA_PLAN_SCHEMA = 'cssearth-surface-panorama-plan@2';
/** The card's list of a body's panoramas, `prepared/panoramas.json`: what the page renders before the runtime loads. */
export const SURFACE_PANORAMA_LIST_SCHEMA = 'cssearth-surface-panorama-list@2';
/** The panorama's own frame: x north, y west, z up at the camera. Nothing else is drawn in it. */
export const SURFACE_PANORAMA_FRAME = 'surface-panorama-local-north-west-up';
const THUMBNAIL_PIXELS = 80;
/** Skyline columns read across a tie-point panorama's width. */
const SKYLINE_COLUMNS = 1024;

interface Verified { readonly value: unknown }

/** Where the camera stood for each panorama: the rover localisation table, or LROC's Apollo photograph layer. */
export async function locateSurfacePanoramas(document: SurfacePanoramas, sourceDirectory: string): Promise<ReadonlyMap<string, PanoramaSite>> {
  const localization = document.localization;
  if (localization.kind === 'places') {
    const table = parsePlacesTable(await readFile(resolve(sourceDirectory, localization.path), 'utf8'), localization.path);
    return new Map(document.panoramas.map(panorama => [panorama.id, locatePanorama(table, panorama.sols!, panorama.id)]));
  }
  return new Map(document.panoramas.map(panorama => {
    const photos = panorama.photos!, standpoint = hasselbladStandpoint(resolve(sourceDirectory, photos.archive), photos.layer, photos.magazine, photos.frame, panorama.id);
    return [panorama.id, Object.freeze({ latitudeDeg: standpoint.latitudeDeg, longitudeDegEast: standpoint.longitudeDegEast, localization: standpoint.localization })];
  }));
}

/** Turn a tie-point panorama: the Sun's direction at the photographs' time and the hardware's bearings from the standpoint. */
function turnByTies(panorama: SurfacePanorama, site: PanoramaSite, sourceDirectory: string, radiusM: number): TieFit & { readonly sunElevationDeg: number } {
  const photos = panorama.photos!, subsolar = panorama.subsolar!, archive = resolve(sourceDirectory, photos.archive);
  const standpoint = hasselbladStandpoint(archive, photos.layer, photos.magazine, photos.frame, panorama.id);
  const taken = groundElapsedUtc(photos.rangeZero.utc, standpoint.groundElapsed);
  if (taken !== subsolar.utc) throw new TypeError(`${panorama.id}: the sub-solar point is for ${subsolar.utc}, but GET ${standpoint.groundElapsed} is ${taken}.`);
  const sun = sunDirection(site, { latitudeDeg: subsolar.latitudeDeg, longitudeDegEast: subsolar.longitudeDegEast });
  if (sun.elevationDeg <= 0) throw new TypeError(`${panorama.id}: the Sun is below the horizon at ${subsolar.utc}.`);
  const equipment = apolloEquipment(archive, photos.equipment);
  const ties: TieAzimuth[] = panorama.ties!.map(tie => {
    if (tie.kind === 'sun') return { label: 'Sun', column: tie.column, azimuthDeg: sun.azimuthDeg, celestial: true };
    if (tie.kind === 'antisun') return { label: 'shadow opposite the Sun', column: tie.column, azimuthDeg: (sun.azimuthDeg + 180) % 360, celestial: true };
    const at = equipment.get(tie.equipment!);
    if (!at) throw new TypeError(`${panorama.id}: ${photos.equipment} has no ${tie.equipment}; it has ${[...equipment.keys()].join(', ')}.`);
    const bearing = localBearing(site, at, radiusM), error = photos.positionError?.metres;
    return { label: tie.equipment!, column: tie.column, azimuthDeg: bearing.azimuthDeg, celestial: false,
      ...(error === undefined ? {} : { toleranceDeg: Math.atan2(error, bearing.distanceM) / (Math.PI / 180) }) };
  });
  return { ...fitTieAzimuths(ties, panorama.id), sunElevationDeg: sun.elevationDeg };
}

/** Level a tie-point panorama on its terrain horizon, on the image already resized to the faces' scale. */
async function levelOnTerrain(panorama: SurfacePanorama, site: PanoramaSite, placement: TiePointPlacement, terrain: TerrainGrid,
  resized: Sharp, width: number, height: number, turn: Pick<PanoramaGeometry, 'pxPerDeg' | 'azimuthAtLeftDeg'>) {
  const grey = await resized.clone().greyscale().raw().toBuffer();
  const fit = fitHorizon(skylineRows(grey, width, height, Math.max(1, Math.round(width / SKYLINE_COLUMNS))), turn.pxPerDeg, turn.azimuthAtLeftDeg,
    horizonProfile(terrain, site, placement.cameraHeightM, panorama.id), panorama.id);
  return { geometry: { ...turn, horizonRow: fit.horizonRow, horizonSlope: fit.horizonSlope }, fit };
}

export async function attachSurfacePanoramas({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition }: {
  descriptor: AuthoredObjectDescriptor; sources: ReadonlyMap<string, Verified>; sourceDirectory: string; publicDirectory: string; outputDirectory: string; definition: Record<string, unknown>;
}): Promise<{ definition: Record<string, unknown>; count: number; reports: readonly string[] }> {
  const recipe = descriptor.recipe.panoramas;
  if (!recipe) return { definition, count: 0, reports: [] };
  const source = sources.get(recipe.source);
  if (!source) throw new TypeError(`Authored recipe requires ${recipe.source}.`);
  const document = parseSurfacePanoramas(source.value), sites = await locateSurfacePanoramas(document, sourceDirectory), placement = document.placement;
  const id = descriptor.id, faceSize = recipe.faceSize, url = (file: string) => `/scenes/${id}/${file}`;
  // A face of `faceSize` pixels spans 90°, so every panorama is resampled to that many pixels a degree first.
  const facePxPerDeg = 4 * faceSize / 360;
  const entries = [], reports: string[] = [];
  for (const panorama of document.panoramas) {
    const path = resolve(sourceDirectory, panorama.image), meta = await sharp(path, { limitInputPixels: false }).metadata();
    if (!meta.width || !meta.height) throw new TypeError(`${id} panorama ${panorama.id}: ${panorama.image} has no size.`);
    const site = sites.get(panorama.id)!;
    let geometry: PanoramaGeometry, approximation: string, report: string;
    const terrain = placement.kind === 'stated-cylinder' ? null : readNacDtm(resolve(sourceDirectory, panorama.terrain!));
    const turn = terrain ? turnByTies(panorama, site, sourceDirectory, terrain.radiusM) : null;
    const factor = facePxPerDeg / (turn ? turn.pxPerDeg : meta.width / 360);
    const width = Math.round(meta.width * factor), height = Math.round(meta.height * factor);
    const resized = sharp(path, { limitInputPixels: false }).resize(width, height, { fit: 'fill' }).removeAlpha();
    const decoded = await resized.clone().raw().toBuffer({ resolveWithObject: true });
    if (placement.kind === 'stated-cylinder') {
      geometry = scaledGeometry(statedGeometry(meta.width, placement), factor);
      approximation = `cylinder, one scale in both axes; azimuth ${placement.azimuthAtCentreDeg}° at the centre and ${placement.topElevationDeg}° elevation at the top, as the publisher states`;
      report = `${panorama.id}: at ${site.localization}`;
    } else {
      const levelled = await levelOnTerrain(panorama, site, placement, terrain!, resized, width, height, { pxPerDeg: facePxPerDeg, azimuthAtLeftDeg: turn!.azimuthAtLeftDeg });
      geometry = levelled.geometry;
      approximation = `cylinder, one scale in both axes; turned by ${turn!.fittedBy.join(', ')} and levelled on the ${terrain!.product} horizon`;
      report = `${panorama.id}: at ${site.localization}; ${turn!.pxPerDeg.toFixed(2)} px/° at source, left edge azimuth ${turn!.azimuthAtLeftDeg.toFixed(2)}°, Sun ${turn!.sunElevationDeg.toFixed(2)}° high; ties ${
        turn!.residualsDeg.map(tie => `${tie.label} ${tie.deg >= 0 ? '+' : ''}${tie.deg.toFixed(2)}°`).join(', ')}; horizon row ${(geometry.horizonRow / factor).toFixed(1)} at source, ${
        (geometry.horizonSlope * meta.width).toFixed(1)} px of tilt across the width, skyline median miss ${levelled.fit.medianResidualDeg.toFixed(2)}° over ${levelled.fit.columns} columns`;
    }
    reports.push(report);
    const image: RgbImage = { width, height, rgb: decoded.data };
    const faces: BakedSky['faces'] = [];
    for (const basis of SKY_BASES) {
      const file = `${id}-panorama-${panorama.id}-${basis.id}.webp`;
      const rgba = panoramaFacePixels(image, geometry, basis, faceSize);
      const bytes = await writeLossyWebp(sharp(Buffer.from(rgba.buffer), { raw: { width: faceSize, height: faceSize, channels: 4 } }), resolve(publicDirectory, file), { alphaQuality: 100, effort: 5 });
      const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]] as const;
      faces.push({ ...basis, texturePath: file, widthPx: faceSize, heightPx: faceSize, bytes: bytes.length, uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
        vertices: corners.map(([u, v]) => basis.forwardIcrf.map((f, i) => f + u * basis.rightIcrf[i]! + v * basis.upIcrf[i]!) as [number, number, number]) });
    }
    const thumbnail = `${id}-panorama-${panorama.id}-thumbnail.webp`;
    // The list's round 40 px preview at 2x: a square of the image as tall as it is, centred on north where it fits.
    const side = Math.min(height, width), north = ((((0 - geometry.azimuthAtLeftDeg) % 360) + 360) % 360) * geometry.pxPerDeg;
    const left = Math.max(0, Math.min(width - side, Math.round(north - side / 2)));
    await sharp(decoded.data, { raw: { width, height, channels: 3 } }).extract({ left, top: 0, width: side, height: side })
      .resize(THUMBNAIL_PIXELS, THUMBNAIL_PIXELS).webp(DECORATIVE_WEBP).toFile(resolve(publicDirectory, thumbnail));
    const { sky, resources } = compileCssSky({ faces, provenance: { image: panorama.image, pageUrl: panorama.pageUrl }, approximation: {
      projection: approximation, resampling: 'bilinear in the published sRGB bytes', unimaged: 'transparent' } },
      { referenceFrame: SURFACE_PANORAMA_FRAME, epochJdTt: 0 } as Parameters<typeof compileCssSky>[1]);
    entries.push({ id: panorama.id, title: panorama.title, when: panorama.when, camera: panorama.camera, credit: panorama.credit, pageUrl: panorama.pageUrl,
      site: { latitudeDeg: site.latitudeDeg, longitudeDegEast: site.longitudeDegEast, localization: site.localization },
      thumbnail: url(thumbnail), faces: faces.map(face => url(face.texturePath)), sky, resources });
  }
  const plan = { schema: SURFACE_PANORAMA_PLAN_SCHEMA, source: { label: document.source, url: document.sourcePage }, frame: SURFACE_PANORAMA_FRAME, panoramas: entries };
  const list = { schema: SURFACE_PANORAMA_LIST_SCHEMA, objectId: id, source: plan.source,
    panoramas: entries.map(({ id: panoramaId, title, when, camera, credit, pageUrl, site, thumbnail }) => ({ id: panoramaId, title, when, camera, credit, pageUrl, site, thumbnail })) };
  await writeFile(resolve(outputDirectory, 'panoramas.json'), `${JSON.stringify(list, null, 1)}\n`);
  return { definition: { ...definition, panoramas: plan }, count: entries.length, reports };
}
