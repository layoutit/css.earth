#!/usr/bin/env node

import { constants } from "node:fs";
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import sharp from "sharp";
import type { ObjectEntry } from '../../site/object-schema.mts';
import type { MarkerDescriptor } from './marker-recipe.mts';
import type { MarkerPresentation } from '../../src/navigation/marker-presentation.mts';
import { hasErrorCode, isRecord, requireRecord } from '@cssearth/core';

type MarkerPlanet = Pick<ObjectEntry, 'id' | 'classification'>;
type ObjectMarkerDescriptor = MarkerDescriptor & {presentation: MarkerPresentation};
interface NavigationChange { source?: string; target: string; }
type MoveNavigationFile = (source: string, target: string) => Promise<void>;
interface MarkerLoadOptions { planets?: readonly MarkerPlanet[]; projectRoot?: string; }
interface NavigationOptions extends MarkerLoadOptions { objectIds?: readonly string[]; catalogOnly?: boolean; outputRoot?: string; presentationPath?: string; moveFile?: MoveNavigationFile; }
interface MarkerRenderOptions { projectRoot: string; outputRoot: string; descriptors: readonly MarkerDescriptor[]; }


import {
  NAVIGATION_BLACKHOLE_SOURCE,
  NAVIGATION_DOWNLOAD_SOURCE,
  NAVIGATION_GITHUB_SOURCE,
  NAVIGATION_SETTINGS_SOURCE,
  NAVIGATION_SHARE_SOURCE,
  NAVIGATION_SUN_SOURCE,
  NAVIGATION_SUPERNOVA_SOURCE,
} from "../../src/navigation/marker-descriptors.mts";
import {
  MARKER_SOURCE_HINTS,
  renderMarker,
  readMarkerImage,
  validateMarkerDescriptor,
  validateMarkerSourceBytes,
} from "./marker-recipe.mts";
import { validateMarkerPresentation } from "../../src/navigation/marker-presentation.mts";
import { SCENE_OBJECTS } from "../../site/objects.mts";
import { optimizePreparedQ75Webp } from "../prepared/prepared-webp.mts";
import { encodeLossyWebp } from '../../src/preparation/raster/lossy-lane.ts';
import { loadAstronomyPackage } from "../../src/platform/astronomy-package.mts";
import { authoredObject } from '../sources/authored-object.mts';

const markerTileSize = 16;
export const BODY_MARKER_ATLAS_PAGE_SIZE = 256;
const PLANET_MARKER_PLANETS = Object.freeze(
  SCENE_OBJECTS
    .toSorted((left, right) => left.distance.meters - right.distance.meters),
);

export async function loadMarkerDescriptors({
  planets = PLANET_MARKER_PLANETS,
  projectRoot = resolve(import.meta.dirname, "../.."),
} : MarkerLoadOptions = {}) {
  const descriptors: ObjectMarkerDescriptor[] = [];
  for (const planet of planets) {
    const input = await loadObjectDescriptor(planet.id, projectRoot);
    const descriptor = validateMarkerDescriptor(input);
    if (!descriptor) {
      throw new Error(`Navigation marker descriptor is missing: ${planet.id}.`);
    }
    validateMarkerDescriptor(descriptor);
    validateMarkerPresentation(descriptor.presentation);
    if (descriptor.owner !== "object") throw new Error(`Object marker must be owned by ${planet.id}.`);
    if (descriptor.objectId !== planet.id) {
      throw new Error(`Navigation marker identity drifted: ${planet.id}.`);
    }
    // Both the image recipe and its shell presentation have been validated.
    descriptors.push(descriptor as ObjectMarkerDescriptor);
  }
  if (new Set(descriptors.map(({ objectId }) => objectId)).size !== planets.length) {
    throw new Error("Navigation marker descriptors are not unique.");
  }
  return Object.freeze(descriptors);
}

export async function prepareNavigation({
  projectRoot = resolve(import.meta.dirname, "../.."),
  outputRoot = resolve(projectRoot, "public/navigation"),
  planets = PLANET_MARKER_PLANETS,
  presentationPath = resolve(projectRoot, "site/prepared-navigation-markers.mjs"),
  moveFile = moveNavigationFile,
  objectIds,
  catalogOnly = false,
} : NavigationOptions = {}) {
  const descriptors = await loadMarkerDescriptors({ planets, projectRoot });
  if (objectIds?.some(id => !descriptors.some(descriptor => descriptor.objectId === id))) throw new TypeError('Unknown navigation object.');
  const selected = objectIds ? descriptors.filter(descriptor => objectIds.includes(descriptor.objectId)) : descriptors;
  // A crash or failed rollback must never leave recoverable source/backups in
  // public/, which Vite copies recursively (including dot directories).
  const cacheRoot = resolve(projectRoot, "node_modules/.cache");
  await mkdir(cacheRoot, { recursive: true });
  const staging = await mkdtemp(resolve(cacheRoot, "navigation-prepare-"));
  let cleanup = true;
  try {
    const stagedOutput = resolve(staging, "assets");
    await mkdir(stagedOutput);
    const result = catalogOnly ? { planetCount: descriptors.length } : await renderNavigation({ projectRoot, outputRoot: stagedOutput, descriptors: selected });
    if (!catalogOnly) {
      await prepareContextMarkers({ projectRoot, outputRoot: stagedOutput, descriptors: selected, planets });
      await prepareBodyMarkerAtlases({ outputRoot: stagedOutput, descriptors, directories: [stagedOutput, outputRoot] });
    }
    const presentations = await markerPresentations(descriptors, planets, [stagedOutput, outputRoot]);
    const stagedPresentation = resolve(staging, "presentation.mjs");
    await writeFile(stagedPresentation, "// Generated from object-owned marker recipes. Do not edit.\nexport const PREPARED_NAVIGATION_MARKERS = Object.freeze(" + JSON.stringify(presentations) + ");\n");
    const changes: NavigationChange[] = (await readdir(stagedOutput)).sort().map((filename) => ({
      source: resolve(stagedOutput, filename), target: resolve(outputRoot, filename),
    }));
    const generatedTargets = new Set(changes.map(({ target }) => target));
    // 1x marker tiles and pages are no longer made: the app reads only 2x.
    const pageCount = Math.ceil(descriptors.length / BODY_MARKER_ATLAS_PAGE_SIZE);
    const obsolete = catalogOnly ? [] : [...selected.flatMap(({ objectId }) => [`${objectId}.webp`, `${objectId}-context.webp`]),
      ...descriptors.map(({ objectId }) => `body-${objectId}.webp`),
      ...Array.from({ length: pageCount + 1 }, (_, page) => `body-markers-${String(page).padStart(2, '0')}.webp`),
      "planet-markers.webp", "planet-markers@2x.webp", "blackhole-marker.webp", "blackhole-marker@2x.webp", "supernova-marker.webp", "supernova-marker@2x.webp", "sun-indicator-hexagon.png"];
    changes.push(...[...new Set(obsolete)].map((filename) => ({ target: resolve(outputRoot, filename) })).filter(({ target }) => !generatedTargets.has(target)));
    changes.push({ source: stagedPresentation, target: presentationPath });
    await mkdir(outputRoot, { recursive: true });
    try { await publishNavigation(changes, staging, moveFile); }
    catch (error) {
      // If rollback itself fails, preserve the backups for recovery.
      cleanup = !(error instanceof AggregateError);
      throw error;
    }
    return Object.freeze({ ...result, outputRoot });
  } finally {
    if (cleanup) await rm(staging, { recursive: true, force: true });
  }
}

async function markerPresentations(descriptors: readonly ObjectMarkerDescriptor[], planets: readonly MarkerPlanet[], directories: readonly string[]) {
  const { BODIES } = await loadAstronomyPackage();
  const bodies: Readonly<Partial<Record<string, (typeof BODIES)[keyof typeof BODIES]>>> = BODIES;
  const parents = new Set<string | null | undefined>(planets.filter(body => body.classification === 'satellite').map(body => bodies[body.id]?.parent));
  const metadata = async (filename: string) => {
    for (const directory of directories) {
      const path = resolve(directory, filename);
      try { await lstat(path); }
      catch (error) { if (hasErrorCode(error, 'ENOENT')) continue; throw error; }
      return sharp(path).metadata();
    }
    throw new Error(`Missing prepared navigation image: ${filename}. Run prepare:navigation for its body.`);
  };
  const entries = [];
  for (const [descriptorIndex, descriptor] of descriptors.entries()) {
    const id = descriptor.objectId;
    const page = Math.floor(descriptorIndex / BODY_MARKER_ATLAS_PAGE_SIZE);
    const index = descriptorIndex % BODY_MARKER_ATLAS_PAGE_SIZE;
    const count = Math.min(BODY_MARKER_ATLAS_PAGE_SIZE, descriptors.length - page * BODY_MARKER_ATLAS_PAGE_SIZE);
    const pageName = `body-markers-${String(page).padStart(2, '0')}`;
    const image = await metadata(`${pageName}@2x.webp`);
    if (image.width !== markerTileSize * 2 * count || image.height !== markerTileSize * 2) throw new TypeError(`Invalid marker atlas dimensions: ${pageName}.`);
    const context = parents.has(id) || descriptor.context ? await metadata(`${id}-context.webp`) : null;
    entries.push([id, { url2x: `/navigation/${pageName}@2x.webp`, url2xPixels: markerTileSize * 2, index, count,
      presentation: descriptor.presentation, ...(context ? { context: { url: `/navigation/${id}-context.webp`, pixels: context.width } } : {}) }]);
  }
  return Object.fromEntries(entries);
}

/** Pack the object-owned 16 px markers, at 2x density, into bounded horizontal pages. The
 * individual prepared images remain the ownership/oracle artifacts; runtime
 * presentation references only these pages, collapsing hundreds of requests.
 * A page is photographic sprites, so it goes through the lossy lane with exact alpha: the three lossless pages were
 * 482 KB, lossy 289 KB, and pixelmatch (threshold 0.1) flags at most 13 of a page's 262,144 pixels (2026-09-25). */
export async function prepareBodyMarkerAtlases({ outputRoot, descriptors, directories }: {
  outputRoot: string; descriptors: readonly ObjectMarkerDescriptor[]; directories: readonly string[];
}) {
  if (!descriptors.length) throw new TypeError('Marker atlases require at least one descriptor.');
  const locate = async (filename: string) => {
    for (const directory of directories) {
      const path = resolve(directory, filename);
      try { if ((await lstat(path)).isFile()) return path; }
      catch (error) { if (!hasErrorCode(error, 'ENOENT')) throw error; }
    }
    throw new Error(`Missing prepared navigation image: ${filename}.`);
  };
  for (let start = 0, page = 0; start < descriptors.length; start += BODY_MARKER_ATLAS_PAGE_SIZE, page++) {
    const members = descriptors.slice(start, start + BODY_MARKER_ATLAS_PAGE_SIZE);
    const pageName = `body-markers-${String(page).padStart(2, '0')}`;
    {
      const tile = markerTileSize * 2;
      // Copy decoded straight-alpha pixels, not a composite operation: blending
      // partially transparent edges changes their RGB by a rounding unit.
      const tiles = await Promise.all(members.map(async ({ objectId }) => sharp(await locate(`body-${objectId}@2x.webp`))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
      if (tiles.some(({ info }) => info.width !== tile || info.height !== tile || info.channels !== 4)) throw new TypeError(`Invalid marker tile dimensions in ${pageName}.`);
      const width = tile * members.length, pixels = Buffer.alloc(width * tile * 4);
      for (let row = 0; row < tile; row++) for (const [index, image] of tiles.entries()) {
        image.data.copy(pixels, (row * width + index * tile) * 4, row * tile * 4, (row + 1) * tile * 4);
      }
      await writeFile(resolve(outputRoot, `${pageName}@2x.webp`),
        await encodeLossyWebp(sharp(pixels, { raw: { width, height: tile, channels: 4 } }), { alphaQuality: 100, effort: 6 }));
    }
  }
}

// Preparation must finish before touching accepted files. Roll back a failed
// publication too; this is not a live-server or crash-atomic release mechanism.
async function publishNavigation(changes: readonly NavigationChange[], staging: string, moveFile: MoveNavigationFile) {
  const applied: (NavigationChange & {backup: string | null; installed: boolean})[] = [];
  try {
    for (const [index, change] of changes.entries()) {
      const previous = await lstat(change.target).catch((error) => {
        if (!hasErrorCode(error, "ENOENT")) throw error;
      });
      if (previous && !previous.isFile()) throw new Error(`Navigation output is not a regular file: ${change.target}`);
      const entry = { ...change, backup: previous ? resolve(staging, `backup-${index}`) : null, installed: false };
      if (entry.backup) await moveFile(entry.target, entry.backup);
      applied.push(entry);
      if (entry.source) {
        await moveFile(entry.source, entry.target);
        entry.installed = true;
      }
    }
  } catch (error) {
    const failures = [];
    for (const entry of applied.reverse()) {
      try {
        if (entry.installed) await unlink(entry.target);
        if (entry.backup) await moveFile(entry.backup, entry.target);
      } catch (failure) { failures.push(failure); }
    }
    if (failures.length) throw new AggregateError([error, ...failures], `Navigation rollback failed; backups remain in ${staging}`);
    throw error;
  }
}

// Default staging is on the project's device. Custom outputs or symlinked
// caches may cross devices; preserve move semantics for both install/rollback.
export async function moveNavigationFile(source: string, target: string, io: {rename: typeof rename; copyFile: typeof copyFile; unlink: typeof unlink} = { rename, copyFile, unlink }) {
  try { await io.rename(source, target); }
  catch (error) {
    if (!hasErrorCode(error, "EXDEV")) throw error;
    await io.copyFile(source, target, constants.COPYFILE_EXCL);
    try { await io.unlink(source); }
    catch (failure) {
      try { await io.unlink(target); }
      catch (cleanupFailure) {
        throw new AggregateError([failure, cleanupFailure], `Navigation move failed; recovery copy remains at ${target}`);
      }
      throw failure;
    }
  }
}

// A moon's parent can occupy hundreds of pixels in the shared world view.
// Parents and explicitly sized resolved views use their own image; UI icons stay tiny.
export async function prepareContextMarkers({ projectRoot, outputRoot, descriptors, planets = PLANET_MARKER_PLANETS }: MarkerRenderOptions & {planets?: readonly MarkerPlanet[]}) {
  const { BODIES } = await loadAstronomyPackage();
  const bodies: Readonly<Partial<Record<string, (typeof BODIES)[keyof typeof BODIES]>>> = BODIES;
  const parents = new Set<string | null | undefined>(planets.filter(({ classification }) => classification === "satellite")
    .map(({ id }) => bodies[id]?.parent).filter(Boolean));
  const markers: Record<string, {url: string; pixels: number}> = {};
  const contexts = descriptors.filter(descriptor => parents.has(descriptor.objectId) || descriptor.context);
  // Each context image is independent: encode them concurrently, a bounded few at a time; bytes and file names are unchanged.
  let next = 0;
  const results: {url: string; pixels: number}[] = [];
  await Promise.all(Array.from({ length: Math.min(8, contexts.length) }, async () => {
    for (let index = next++; index < contexts.length; index = next++) {
      const descriptor = contexts[index];
      const sourcePath = resolve(projectRoot, "src/objects", descriptor.objectId, "source", descriptor.source.path);
      let crop = await readMarkerImage(descriptor.source, sourcePath);
      for (const operation of descriptor.operations) {
        if (operation.type === "resize") break;
        if (operation.type === "rotate") crop = crop.rotate();
        if (operation.type === "trim") crop = crop.trim({ threshold: operation.threshold });
        if (operation.type === "extract") crop = crop.extract({ left: operation.left, top: operation.top, width: operation.width, height: operation.height });
      }
      const { info } = await crop.raw().toBuffer({ resolveWithObject: true });
      // Fixed canonical image, capped by the actual native crop, never the UI atlas.
      const pixels = Math.min(descriptor.context?.pixels ?? 1536, info.width, info.height);
      const png = await renderMarker(descriptor, { sourcePath, tileSize: pixels });
      const filename = `${descriptor.objectId}-context.webp`;
      await sharp(png).webp({ quality: 85, alphaQuality: 100, effort: 6 }).toFile(resolve(outputRoot, filename));
      results[index] = { url: `/navigation/${filename}`, pixels };
    }
  }));
  contexts.forEach((descriptor, index) => { markers[descriptor.objectId] = results[index]; });
  return markers;
}

/** Each body owns its marker bytes; catalogue order never changes an image. */
export async function prepareBodyMarkers({ projectRoot, outputRoot, descriptors }: MarkerRenderOptions) {
  if (!descriptors.length) throw new TypeError('Markers require at least one descriptor.');
  await mkdir(outputRoot, { recursive: true });
  // 2x only: the app reads the 2x pages, and every screen gets them (no 1x rasters).
  {
    const tileSize = markerTileSize * 2;
    for (const descriptor of descriptors) {
      const sourcePath = descriptor.owner === 'object'
        ? resolve(projectRoot, 'src/objects', descriptor.objectId, 'source', descriptor.source.path)
        : resolve(projectRoot, 'src/navigation/source', descriptor.source.path);
      const tile = await renderMarker(descriptor, { sourcePath, tileSize });
      await sharp(tile).webp({ lossless: true, effort: 6 }).toFile(resolve(outputRoot, `body-${descriptor.objectId}@2x.webp`));
    }
  }
}

export async function renderNavigation({ projectRoot, outputRoot, descriptors }: MarkerRenderOptions) {
  const navigationSourceRoot = resolve(projectRoot, "src/navigation/source");
  await prepareSunIndicator({ projectRoot, outputRoot });

  await prepareBodyMarkers({ projectRoot, outputRoot, descriptors });

  const sunSourcePath = resolve(navigationSourceRoot, NAVIGATION_SUN_SOURCE.path);
  const sunSource = await validateMarkerSourceBytes(
    NAVIGATION_SUN_SOURCE,
    sunSourcePath,
  );
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const sunSize = 28 * density;
    const sunMask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${sunSize}" height="${sunSize}">` +
      `<circle cx="${sunSize / 2}" cy="${sunSize / 2}" ` +
      `r="${13 * density}" fill="white"/>` +
      "</svg>",
    );
    const sun = await sharp(sunSource)
      .trim({ threshold: 10 })
      .resize(sunSize, sunSize, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .greyscale()
      .blur(0.9 * density)
      .linear(0.58, 78)
      .tint("#e6a436")
      .modulate({ brightness: 1.12 })
      .ensureAlpha()
      .composite([{ input: sunMask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const outputPath = resolve(
      outputRoot,
      `sun-marker${density === 2 ? "@2x" : ""}.webp`,
    );
    await sharp({
      create: {
        width: tileSize,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: sun,
        left: (tileSize - sunSize) / 2,
        top: (tileSize - sunSize) / 2,
      }])
      .webp({ lossless: true, effort: 6 })
      .toFile(outputPath);
    await optimizePreparedQ75Webp(outputPath);
  }

  const blackHoleSource = await validateMarkerSourceBytes(
    NAVIGATION_BLACKHOLE_SOURCE,
    resolve(navigationSourceRoot, NAVIGATION_BLACKHOLE_SOURCE.path),
  );
  const blackHoleLuminance: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];
  const luminanceRow = (scale: number): [number, number, number] => [blackHoleLuminance[0] * scale, blackHoleLuminance[1] * scale, blackHoleLuminance[2] * scale];
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const blackHoleBase = sharp(blackHoleSource)
      .extract({ left: 112, top: 112, width: 800, height: 800 })
      .resize(tileSize, tileSize, {
        fit: "contain",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      });
    const [blackHoleRgb, blackHoleAlpha] = await Promise.all([
      blackHoleBase.clone()
        .recomb([
          luminanceRow(0.78),
          luminanceRow(0.60),
          luminanceRow(1),
        ])
        .modulate({ brightness: 1.12 })
        .removeAlpha()
        .raw()
        .toBuffer(),
      blackHoleBase.clone()
        .removeAlpha()
        .greyscale()
        .linear(3, -6)
        .raw()
        .toBuffer(),
    ]);
    const outputPath = resolve(
      outputRoot,
      `blackhole-marker${density === 2 ? "@2x" : ""}.png`,
    );
    await sharp(blackHoleRgb, {
      raw: {
        width: tileSize,
        height: tileSize,
        channels: 3,
      },
    })
      .joinChannel(blackHoleAlpha, {
        raw: {
          width: tileSize,
          height: tileSize,
          channels: 1,
        },
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  }

  const supernovaSource = await validateMarkerSourceBytes(
    NAVIGATION_SUPERNOVA_SOURCE,
    resolve(navigationSourceRoot, NAVIGATION_SUPERNOVA_SOURCE.path),
  );
  for (const density of [1, 2]) {
    const tileSize = 48 * density;
    const markSize = 30 * density;
    const supernovaBase = sharp(supernovaSource)
      .rotate(45, { background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .trim({ background: "#000", threshold: 4 })
      .resize(markSize, markSize, {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.7 });
    const [supernovaRgb, supernovaAlpha] = await Promise.all([
      supernovaBase.clone()
        .removeAlpha()
        .raw()
        .toBuffer(),
      supernovaBase.clone()
        .removeAlpha()
        .greyscale()
        .linear(3, -6)
        .raw()
        .toBuffer(),
    ]);
    const supernova = await sharp(supernovaRgb, {
      raw: {
        width: markSize,
        height: markSize,
        channels: 3,
      },
    })
      .joinChannel(supernovaAlpha, {
        raw: {
          width: markSize,
          height: markSize,
          channels: 1,
        },
      })
      .png()
      .toBuffer();
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${markSize}" height="${markSize}">` +
      `<circle cx="${markSize / 2}" cy="${markSize / 2}" ` +
      `r="${markSize / 2 - density}" fill="white"/>` +
      "</svg>",
    );
    const clipped = await sharp(supernova)
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
    const outputPath = resolve(
      outputRoot,
      `supernova-marker${density === 2 ? "@2x" : ""}.png`,
    );
    await sharp({
      create: {
        width: tileSize,
        height: tileSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{
        input: clipped,
        left: (tileSize - markSize) / 2,
        top: (tileSize - markSize) / 2,
      }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputPath);
  }

  const actionSources = Object.freeze([
    Object.freeze({ id: "github", source: NAVIGATION_GITHUB_SOURCE }),
    Object.freeze({ id: "settings", source: NAVIGATION_SETTINGS_SOURCE }),
    Object.freeze({ id: "download", source: NAVIGATION_DOWNLOAD_SOURCE }),
    Object.freeze({ id: "share", source: NAVIGATION_SHARE_SOURCE }),
  ]);
  for (const { id, source } of actionSources) {
    const sourceBytes = await validateMarkerSourceBytes(
      source,
      resolve(navigationSourceRoot, source.path),
    );
    for (const density of [1, 2]) {
      const tileSize = 48 * density;
      const markSize = 26 * density;
      const actionMask = await sharp(sourceBytes)
        .trim({ threshold: 10 })
        .resize(markSize, markSize, {
          fit: "contain",
          position: "centre",
          kernel: sharp.kernel.lanczos3,
        })
        .ensureAlpha()
        .png()
        .toBuffer();
      const shade = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${markSize}" height="${markSize}">` +
        '<defs><radialGradient id="shade" cx="32%" cy="27%" r="84%">' +
        '<stop offset="0" stop-color="#cecece"/>' +
        '<stop offset="0.08" stop-color="#b8b8b8"/>' +
        '<stop offset="0.62" stop-color="#969696"/>' +
        '<stop offset="1" stop-color="#757575"/>' +
        '</radialGradient></defs><rect width="100%" height="100%" fill="url(#shade)"/>' +
        "</svg>",
      );
      const action = await sharp(shade)
        .ensureAlpha()
        .composite([{ input: actionMask, blend: "dest-in" }])
        .png()
        .toBuffer();
      const outputPath = resolve(
        outputRoot,
        `body-${id}${density === 2 ? "@2x" : ""}.webp`,
      );
      await sharp({
        create: {
          width: tileSize,
          height: tileSize,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{
          input: action,
          left: (tileSize - markSize) / 2,
          top: (tileSize - markSize) / 2,
        }])
        .webp({ lossless: true, effort: 6 })
        .toFile(outputPath);
      await optimizePreparedQ75Webp(outputPath);
    }
  }

  return Object.freeze({
    outputRoot,
    planetCount: descriptors.length,
  });
}

/** Project-authored UI outline, rasterized once at canonical 4x density. */
export async function prepareSunIndicator({
  projectRoot = resolve(import.meta.dirname, "../.."),
  outputRoot = resolve(projectRoot, "public/navigation"),
} = {}) {
  const swatch = requireRecord(JSON.parse(await readFile(resolve(projectRoot, "src/objects/sun/swatch.json"), "utf8")));
  const hex = (isRecord(swatch.display) ? swatch.display.hex : undefined) ?? swatch.hex;
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error("Invalid Sun swatch.");
  const points = Array.from({ length: 7 }, (_, index) => {
    const angle = index * Math.PI * 2 / 7 - Math.PI / 2;
    const radius = 9.1;
    return [10 + Math.cos(angle) * radius, 10 + Math.sin(angle) * radius];
  });
  const inset = (point: readonly number[], neighbour: readonly number[]) => point.map((value, axis) => value + (neighbour[axis] - value) * .12);
  const rounded = points.map((point, index) => ({ point,
    before: inset(point, points[(index + 6) % 7]), after: inset(point, points[(index + 1) % 7]),
  }));
  const xy = (point: readonly number[]) => point.map(value => value.toFixed(4)).join(" ");
  const path = `M ${xy(rounded[0].before)} ` + rounded.map(({ point, after }, index) =>
    `Q ${xy(point)} ${xy(after)} L ${xy(rounded[(index + 1) % 7].before)}`).join(" ") + " Z";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 20 20">` +
    `<path d="${path}" fill="none" stroke="${hex}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="10" cy="10" r="1" fill="${hex}"/></svg>`;
  await mkdir(outputRoot, { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(outputRoot, "sun-indicator-heptagon.png"));
}

/**
 * An object's marker recipe with its source record taken from the source manifest, which owns the pins and
 * attribution. Older recipes still carry a copy of that record; it is ignored here and removed by write mode.
 */
export async function loadObjectMarkerDescriptor(objectId: string, projectRoot: string): Promise<Record<string, unknown>> {
  const directory = resolve(projectRoot, 'src/objects', objectId);
  const navigation = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/preparation/navigation.json'), 'utf8')), 'navigation marker');
  const source = requireRecord(navigation.source, 'navigation marker source'), path = source.path;
  if (typeof path !== 'string') throw new TypeError(`Navigation marker source path is missing: ${objectId}.`);
  const manifest = requireRecord(JSON.parse(await readFile(resolve(directory, 'source/manifest.json'), 'utf8')), 'source manifest');
  const record = ['inputs', 'documents', 'generatedIntermediates'].flatMap(key => Array.isArray(manifest[key]) ? manifest[key] as unknown[] : [])
    .map(value => requireRecord(value, 'source record')).find(entry => entry.path === path);
  if (!record) throw new TypeError(`Navigation marker source is not in the source manifest: ${objectId}/${path}.`);
  const hints = Object.fromEntries(MARKER_SOURCE_HINTS.filter(hint => hint in source).map(hint => [hint, source[hint]]));
  return { ...navigation, source: { ...record, ...hints } };
}

async function loadObjectDescriptor(objectId: string, projectRoot: string): Promise<unknown> {
  if (await authoredObject(objectId, projectRoot)) return loadObjectMarkerDescriptor(objectId, projectRoot);
  const modulePath = resolve(
    projectRoot,
    "src/objects",
    objectId,
    "tools/navigation-marker.mjs",
  );
  const module: unknown = await import(pathToFileURL(modulePath).href);
  if (!module || typeof module !== 'object' || !('default' in module)) throw new TypeError('Navigation marker module requires a default export.');
  return module.default;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const catalogOnly = args.includes('--catalog-only');
  const objectIds = args.filter(arg => arg !== '--catalog-only');
  const result = await prepareNavigation({ catalogOnly, objectIds: objectIds.length ? objectIds : undefined });
  console.log(JSON.stringify({
    ...result,
    bodyMarkers:
      `${result.planetCount} prepared 16px raster markers with 2x density`,
    sunMarker: "NASA HMI raster marker with 2x density",
    blackHoleMarker: "NASA/GSFC simulated accretion-disk marker with 2x density",
    supernovaMarker: "NASA/ESA/CSA Webb MIRI Cassiopeia A marker with 2x density",
    actionMarkers: "4 prepared monochrome shaded markers with 2x density",
  }));
}
