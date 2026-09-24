import { applyLinearTint } from '../color-transfer.mts';
import { isArray } from '../../../src/platform/is-array.mts';
import {basename} from 'node:path';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';
import type {WebpOptions} from 'sharp';
import type {RasterInfo} from '../observation/raster.mts';
import type {PagedAssetConfiguration, SurfaceAssetsConfiguration, SurfaceMapInput, ResizeKernel} from './asset-contract.mts';
import type {Cutaway} from './contracts.mts';
import type {InteriorSource} from './scene-contract.mts';
import type {createAtmospherePreparation} from './atmosphere.mts';
import type {createPagedSurfaceRaster, NativeDeepOceanFill, NativePhotographicCloudComposite, PagedSurfaceRasterPlan} from './surface-raster.mts';
import {applyDeepOceanFill, clearDeepOceanFillCache, readDeepOceanFill, resizeDeepOceanFill} from './deep-ocean-fill.mts';
import {readJsonSource, requireFiniteNumber, requireString} from '../../sources/source-values.mts';
import {parseInteriorSource, parseMapFocusBindings} from './source-contract.mts';
type AtmospherePreparation = ReturnType<typeof createAtmospherePreparation>;
type AtmosphereModel = Awaited<ReturnType<AtmospherePreparation['readAtmosphereModel']>>;
type Tomography = Awaited<ReturnType<typeof readMantleTomography>>;
interface SphereAssetInput extends RasterInfo {data: Buffer; density: number; canonical?: boolean; outputRoot?: string; name: string; bandCount: number; polarCapBandSpan?: number; projectiveSurface?: boolean; longitudeOffsetDegrees: number; webp?: WebpOptions; cutaway?: Cutaway; nativePhotographicClouds?: NativePhotographicCloudComposite; nativePhotographicSampling?: boolean; nativePhotographicDisplayGamma?: number; nativeDeepOceanFill?: NativeDeepOceanFill;}
interface MaterialFrameInput {size: number; scenePitchDegrees: number; role: string; atmosphereModel: AtmosphereModel; shadowless?: boolean; phaseFrame?: number;}
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import type { EllipsoidAttitude } from './attitude.mts';
import { LIT_DEFAULT_VIEW } from '../../../src/platform/default-camera.mts';
import { readCoraltempAnomaly } from "./sst-anomaly.mts";
import { verifyPreparedMurImage, writeMurLegend } from "./mur-imagery.mts";
import { prepareElevationMap, writeElevationLegend } from "./elevation.mts";
import { prepareNightLightsMap, writeNightLightsLegend } from "./night-lights.mts";
import { textureTintFactors } from "@layoutit/polycss";
import { cutInteriorPoles } from "./interior-poles.mts";
import { readMantleTomography, tomographyLegend } from "./tomography.mts";
import { applyDisplayGamma } from "./display-tone.mts";


/** `mode` 'extras' prepares the interior, legends and thumbnails without surface maps or materials. `materialSlice` runs
 * every `count`th material image from `index`, so parallel workers each write a disjoint share (parallel-assets.mts). */
export async function preparePagedEllipsoidAssets({ config, sourceDirectory, publicDirectory, surfaceRasterPlan, atmosphere, atmosphereModel, raster, mode = 'all', surfaceMapNames, attitude, materialSlice = { index: 0, count: 1 } }: {attitude?: EllipsoidAttitude; config: PagedAssetConfiguration; sourceDirectory: string; publicDirectory: string; surfaceRasterPlan: PagedSurfaceRasterPlan; atmosphere?: AtmospherePreparation; atmosphereModel?: AtmosphereModel; raster: ReturnType<typeof createPagedSurfaceRaster>; mode?: string; surfaceMapNames?: readonly string[]; materialSlice?: {index: number; count: number}}) {
const { bakeSurfaceRaster, surfacePageUrls } = raster;
const requireMaterialPreparation=()=>{
  if(!atmosphere||!atmosphereModel||!attitude)throw new Error('Paged ellipsoid material preparation requires an atmosphere model and the body attitude.');
  return {atmosphere,atmosphereModel,attitude};
};
const PUBLIC_ROOT = publicDirectory;
const surfaceOutputRoot = publicDirectory;
const surfaceQuality = config.surface.quality;
const surfaceMaps = surfaceMapNames
  ? config.surface.maps.filter(map => surfaceMapNames.includes(map.name))
  : config.surface.maps;
if (surfaceMapNames && surfaceMaps.length !== new Set(surfaceMapNames).size) {
  throw new Error('Paged ellipsoid preparation requested an unknown surface map.');
}
const source = (path: string) => resolve(sourceDirectory,path);
const produced = new Set<string>();
const output = (path: string) => { produced.add(`${config.publicBase}${path}`); return resolve(publicDirectory,path); };
await mkdir(publicDirectory,{recursive:true});
if (mode === 'interior') {
  await prepareInteriorAssets({ exterior: false });
  return { assets: [...produced].sort() };
}
if (mode === 'shadowless') {
  const {atmosphere}=requireMaterialPreparation();
  for (const density of [1, 2]) await prepareShadowlessMaterial(atmosphere.MATERIAL_TILE_SIZE * density, density === 2 ? '@2x' : '');
  return { assets: [...produced].sort() };
}
if (mode !== 'materials') {
  const inputs = new Map<string, string | Buffer>();
  const focusByMap = new Map<string, {longitude?: number} | undefined>();
  if (mode !== 'maps') {
    const bindings = parseMapFocusBindings(await readJsonSource(source('content/lens-bindings.json')));
    for (const lens of bindings.controls) if(lens.surfacePagePrefix) focusByMap.set(lens.surfacePagePrefix,lens.focus);
  }
  for (const map of surfaceMaps) {
    let input: string | Buffer = source(map.path);
    if (map.scientific) {
      if (map.scientific.kind === "coraltemp-anomaly") {
        const decoded = await readCoraltempAnomaly(source(map.path), map.scientific);
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
      } else if (map.scientific.kind === "gebco-elevation") {
        const decoded = await preparePagedSurfaceMap({ config, sourceDirectory, map });
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
        await writeElevationLegend(map.scientific, output(map.scientific.legend.image));
      } else if (map.scientific.kind === "black-marble-radiance") {
        const decoded = await preparePagedSurfaceMap({ config, sourceDirectory, map });
        input = await sharp(decoded.data, { raw: decoded.info }).png().toBuffer();
        await writeNightLightsLegend(map.scientific, output(map.scientific.legend.image));
      } else if (map.scientific.kind === "gibs-mur-imagery") {
        input = await verifyPreparedMurImage(sourceDirectory, map.scientific);
        await writeMurLegend(sourceDirectory, output("earth-enso-legend.png"));
      } else throw new TypeError("Unknown scientific surface source");
    }
    inputs.set(map.name, input);
    if (mode !== 'thumbnails' && mode !== 'extras') await prepareMap(input,map.name,{compositeClouds:map.compositeClouds,displayGamma:map.displayGamma,nativePhotographicSampling:map.nativePhotographicSampling,deepOceanFill:map.deepOceanFill,kernel:map.scientific?"nearest":undefined,webp:map.webp});
  }
  if (mode === 'thumbnails') await prepareInteriorAssets({ exterior: false, thumbnailsOnly: true });
  else if (mode !== 'maps') await prepareInteriorAssets();
  if (mode !== 'maps') for (const map of surfaceMaps) {
    let input = inputs.get(map.name);
    if (!input) throw new Error(`Prepared map input is missing: ${map.name}`);
    if (map.compositeClouds || map.displayGamma !== undefined) {
      const preview = await preparePagedSurfaceMap({ config: { ...config, surface: { ...config.surface, width: 2048, height: 1024 } }, sourceDirectory, map: { ...map, nativePhotographicSampling: false } });
      input = await sharp(preview.data, { raw: preview.info }).png().toBuffer();
    }
    await prepareLensThumbnail(input,map.thumbnail,focusByMap.get(map.name)?.longitude ?? null,map.thumbnailRegion);
  }
}
if (mode !== 'surfaces' && mode !== 'thumbnails' && mode !== 'maps' && mode !== 'extras') await prepareMaterialBanks();
clearDeepOceanFillCache();
return { assets: [...produced].sort() };
async function prepareMap(input: string | Buffer, name: string, {
  compositeClouds = false, displayGamma, nativePhotographicSampling = false, deepOceanFill, kernel = "lanczos3", webp = {},
}: {compositeClouds?: boolean; displayGamma?: number; nativePhotographicSampling?: boolean; deepOceanFill?: SurfaceMapInput['deepOceanFill']; kernel?: ResizeKernel; webp?: WebpOptions} = {}) {
  const prepared = await preparePagedSurfaceMap({
    config, sourceDirectory, map: { path: input, compositeClouds, displayGamma, nativePhotographicSampling, deepOceanFill }, kernel,
  });
  const { data: preparedData, info } = prepared;
  const nativePhotographicClouds = 'nativePhotographicClouds' in prepared
    ? prepared.nativePhotographicClouds : undefined;
  const nativeDeepOceanFill = 'nativeDeepOceanFill' in prepared
    ? prepared.nativeDeepOceanFill : undefined;
  const { width, height } = info;
  await writeSphereAssets({
    data: preparedData,
    width,
    height,
    channels: info.channels,
    density: 4,
    canonical: true,
    outputRoot: surfaceOutputRoot,
    name,
    bandCount: 16,
    polarCapBandSpan: 1,
    projectiveSurface: true,
    longitudeOffsetDegrees: 0,
    nativePhotographicSampling,
    nativePhotographicClouds,
    nativeDeepOceanFill,
    nativePhotographicDisplayGamma: displayGamma,
    webp: { quality: surfaceQuality, smartSubsample: true, ...webp },
  });
}


async function writeSphereAssets({ data, width, height, channels, density,
  canonical = false, outputRoot = PUBLIC_ROOT, name, bandCount,
  polarCapBandSpan = 1, projectiveSurface = false,
  longitudeOffsetDegrees, webp, cutaway, nativePhotographicClouds, nativeDeepOceanFill,
  nativePhotographicSampling = false, nativePhotographicDisplayGamma = 1 }: SphereAssetInput) {
  const suffix = canonical ? "" : density === 2 ? "@2x" : "";
  let surfaceData = data;
  let surfaceWidth = width;
  let surfaceHeight = height;
  if (projectiveSurface && !nativePhotographicSampling) {
    surfaceWidth = 2048 * density;
    surfaceHeight = 1024 * density;
    if (surfaceWidth !== width || surfaceHeight !== height) {
      surfaceData = await sharp(data, { raw: { width, height, channels } })
        .resize(surfaceWidth, surfaceHeight, { kernel: sharp.kernel.lanczos3 })
        .raw()
        .toBuffer();
    }
  }
  if (projectiveSurface) {
    const urls = surfacePageUrls(name, surfaceRasterPlan.pages.length, suffix);
    for (const [page, url] of urls.entries()) {
      const raster = bakeSurfaceRaster(surfaceData, {
        width: surfaceWidth, height: surfaceHeight, channels,
      }, surfaceRasterPlan.cells, density * 2, page, nativePhotographicClouds, nativePhotographicDisplayGamma, nativeDeepOceanFill);
      await sharp(raster.data, { raw: raster })
        .webp({ ...webp, alphaQuality: 100 })
        .toFile(output(basename(url)));
    }
  } else {
    const oriented = orientLatitudeBands(surfaceData,
      { width: surfaceWidth, height: surfaceHeight, channels }, bandCount);
    await sharp(oriented, { raw: { width: surfaceWidth, height: surfaceHeight, channels } })
      .webp(webp).toFile(output(`${name}${suffix}.webp`));
  }
  const polarTileSize = 128 * density * polarCapBandSpan;
  const poles = preparePolarAtlas(data, {
    width,
    height,
    channels,
    tileSize: polarTileSize,
    boundaryLatitudeRadians: Math.PI / 2 -
      Math.PI / bandCount * polarCapBandSpan,
    longitudeOffsetRadians: longitudeOffsetDegrees * Math.PI / 180,
  }, nativePhotographicClouds, nativePhotographicDisplayGamma, nativeDeepOceanFill);
  if (cutaway) cutInteriorPoles(poles, polarTileSize, cutaway);
  await sharp(poles, { raw: {
      width: polarTileSize * 4,
      height: polarTileSize,
      channels: 4,
    } })
      .webp(cutaway ? { lossless: true } : { ...webp, alphaQuality: 100 })
      .toFile(output(`${name}-poles${suffix}.webp`));
}

function orientLatitudeBands(data: Buffer, { width, height, channels }: RasterInfo, bandCount: number) {
  const bandHeight = height / bandCount;
  if (!Buffer.isBuffer(data) || !Number.isInteger(bandHeight)) {
    throw new Error("Paged ellipsoid latitude texture does not match its prepared band grid.");
  }
  const output = Buffer.alloc(data.length);
  const rowBytes = width * channels;
  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = band * bandHeight;
    for (let row = 0; row < bandHeight; row += 1) {
      const sourceRow = bandStart + row;
      const outputRow = bandStart + bandHeight - 1 - row;
      data.copy(output, outputRow * rowBytes, sourceRow * rowBytes, (sourceRow + 1) * rowBytes);
    }
  }
  return output;
}

function preparePolarAtlas(data: Uint8Array, { width, height, channels, tileSize, boundaryLatitudeRadians, longitudeOffsetRadians }: RasterInfo & {tileSize: number; boundaryLatitudeRadians: number; longitudeOffsetRadians: number},
  nativeClouds?: NativePhotographicCloudComposite, nativeDisplayGamma = 1, nativeOcean?: NativeDeepOceanFill) {
  const output = Buffer.alloc(tileSize * 4 * tileSize * 4);
  const supersampling = 2;
  const sampleCount = supersampling ** 2;
  const tiles = [
    { pole: "north", inner: false },
    { pole: "south", inner: false },
    { pole: "north", inner: true },
    { pole: "south", inner: true },
  ];
  for (const [tile, { pole, inner }] of tiles.entries()) {
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const premultiplied = [0, 0, 0];
        let alphaTotal = 0;
        for (let sampleY = 0; sampleY < supersampling; sampleY += 1) {
          for (let sampleX = 0; sampleX < supersampling; sampleX += 1) {
            const unitX = (x + (sampleX + 0.5) / supersampling) / tileSize * 2 - 1;
            const unitY = (y + (sampleY + 0.5) / supersampling) / tileSize * 2 - 1;
            const radius = Math.hypot(unitX, unitY);
            if (radius > 1) continue;
            const sampleRadius = inner ? 1 : radius;
            const latitudeMagnitude = Math.acos(Math.min(
              1,
              sampleRadius * Math.cos(boundaryLatitudeRadians),
            ));
            const latitude = pole === "north" ? latitudeMagnitude : -latitudeMagnitude;
            let longitude = Math.atan2(unitY, unitX) - longitudeOffsetRadians;
            longitude = ((longitude % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const sourceX = longitude / (Math.PI * 2) * width - 0.5;
            const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
            const rgba = sampleBilinear(data, { width, height, channels }, sourceX, sourceY, nativeClouds, false, nativeDisplayGamma, nativeOcean);
            const alpha = rgba[3] / 255;
            for (let channel = 0; channel < 3; channel += 1) premultiplied[channel] += rgba[channel] * alpha;
            alphaTotal += alpha;
          }
        }
        const target = (y * tileSize * 4 + tile * tileSize + x) * 4;
        if (alphaTotal > 0) {
          for (let channel = 0; channel < 3; channel += 1) output[target + channel] = Math.round(premultiplied[channel] / alphaTotal);
          output[target + 3] = Math.round(alphaTotal / sampleCount * 255);
        }
      }
    }
  }
  return output;
}

function sampleBilinear(data: Uint8Array, { width, height, channels }: RasterInfo, x: number, y: number,
  nativeClouds?: NativePhotographicCloudComposite, preservePrecision = false, nativeDisplayGamma = 1, nativeOcean?: NativeDeepOceanFill) {
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = x0 + 1;
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - Math.floor(y);
  const sample = (sourceX: number, sourceY: number, channel: number) => {
    const wrappedX = ((sourceX % width) + width) % width;
    return data[(sourceY * width + wrappedX) * channels + channel] ?? (channel === 3 ? 255 : 0);
  };
  const rgba = [0, 0, 0, 255];
  for (let channel = 0; channel < 4; channel += 1) {
    if (channel >= channels) continue;
    const top = sample(x0, y0, channel) * (1 - tx) + sample(x1, y0, channel) * tx;
    const bottom = sample(x0, y1, channel) * (1 - tx) + sample(x1, y1, channel) * tx;
    const sampled = top * (1 - ty) + bottom * ty;
    const adjusted = nativeDisplayGamma === 1 ? sampled : Math.round(255 * (Math.round(sampled) / 255) ** (1 / nativeDisplayGamma));
    rgba[channel] = nativeClouds || preservePrecision ? adjusted : Math.round(adjusted);
  }
  if (nativeOcean) {
    if (nativeOcean.width !== width || nativeOcean.height !== height) {
      throw new Error("Paged ellipsoid deep ocean fill replacement does not share the plain source grid.");
    }
    const weight = sampleBilinear(nativeOcean.weight, { width, height, channels: 1 }, x, y, undefined, true)[0] / 255;
    if (weight > 0) {
      const replacement = sampleBilinear(nativeOcean.data, { width, height, channels: 3 }, x, y, undefined, true);
      for (let channel = 0; channel < 3; channel += 1) {
        const mixed = rgba[channel] * (1 - weight) + replacement[channel] * weight;
        rgba[channel] = nativeClouds || preservePrecision ? mixed : Math.round(mixed);
      }
    }
  }
  if (nativeClouds) {
    const cloudX = (x + .5) / width * nativeClouds.width - .5;
    const cloudY = (y + .5) / height * nativeClouds.height - .5;
    const cloud = sampleBilinear(nativeClouds.data, nativeClouds, cloudX, cloudY, undefined, true);
    const luminance = cloud[0] * .2126 + cloud[1] * .7152 + cloud[2] * .0722;
    const alpha = Math.max(0, Math.min(nativeClouds.maximumAlpha,
      (luminance - nativeClouds.threshold) / 255 * nativeClouds.scale));
    for (let channel = 0; channel < 3; channel += 1) rgba[channel] =
      rgba[channel] * (1 - alpha) + nativeClouds.color[channel] * alpha;
  }
  return rgba;
}

async function prepareMaterialBanks() {
  const {atmosphere,atmosphereModel}=requireMaterialPreparation();
  const {MATERIAL_FRAMES_PER_SHARD,MATERIAL_TILE_SIZE}=atmosphere;
  const frameCount = config.material.frameCount;
  const columns = Math.sqrt(MATERIAL_FRAMES_PER_SHARD);
  const rows = columns;
  const shardCount = frameCount / MATERIAL_FRAMES_PER_SHARD;
  if (!Number.isInteger(columns) || !Number.isInteger(shardCount)) {
    throw new Error("Paged ellipsoid material shards require a square frame layout.");
  }
  const {attitude: bodyAttitude}=requireMaterialPreparation();
  const defaultFrame = Math.round((bodyAttitude.sunView(LIT_DEFAULT_VIEW.initialScenePitchDegrees)[2] + 1) / 2 * (frameCount - 1));
  let task = -1;
  const mine = () => ++task % materialSlice.count === materialSlice.index;
  for (const role of ["lighting", "atmosphere"]) {
    for (const density of [1, 2]) {
      const suffix = density === 2 ? "@2x" : "";
      const size = MATERIAL_TILE_SIZE * density;
      const gutter = 2 * density;
      const stride = size + gutter * 2;
      if (mine()) {
        const defaultRgba = renderMaterialFrame({
          size,
          scenePitchDegrees: LIT_DEFAULT_VIEW.initialScenePitchDegrees,
          role,
          atmosphereModel,
          ...(role === "lighting" ? { phaseFrame: defaultFrame } : {}),
        });
        await sharp(defaultRgba, {
          raw: { width: size, height: size, channels: 4 },
        }).webp({ lossless: true }).toFile(output(
          `${config.namespace}-${role}-default${suffix}.webp`,
        ));
      }
      if (role === "lighting" && mine()) {
        await prepareShadowlessMaterial(size, suffix);
      }
      for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        if (!mine()) continue;
        const shardWidth = stride * columns;
        const shardHeight = stride * rows;
        const shard = Buffer.alloc(shardWidth * shardHeight * 4);
        for (let frameOffset = 0;
          frameOffset < MATERIAL_FRAMES_PER_SHARD;
          frameOffset += 1) {
          const frameIndex = shardIndex * MATERIAL_FRAMES_PER_SHARD +
            frameOffset;
          const columnIndex = frameOffset % columns;
          const tileRowIndex = Math.floor(frameOffset / columns);
          const scenePitchDegrees = 65 - frameIndex /
            (frameCount - 1) * 65;
          const frame = renderMaterialFrame({
            size,
            scenePitchDegrees,
            phaseFrame: frameIndex,
            role,
            atmosphereModel,
          });
          blitRgba(frame, size, size, shard, shardWidth, shardHeight, {
            left: columnIndex * stride + gutter,
            top: tileRowIndex * stride + gutter,
          });
        }
        const rowImage = sharp(shard, {
          raw: { width: shardWidth, height: shardHeight, channels: 4 },
        });
        const rowPath = output(
          `${config.namespace}-${role}-row-${String(shardIndex).padStart(2, "0")}` +
          `${suffix}.webp`,
        );
        // Atmosphere rows carry colour in RGB: it goes through the lossy lane with its alpha exact (quality 80 flags no
        // pixel on rows 29 to 31 and keeps all 113 alpha levels; 1.46 -> 0.46 MB). Lighting rows carry their shading in
        // alpha and stay lossless.
        if (role === "atmosphere") await writeLossyWebp(rowImage, rowPath, { alphaQuality: 100, effort: 6 });
        else await rowImage.webp({ lossless: true }).toFile(rowPath);
      }
      if (role === "atmosphere" && mine()) {
        // The flood frame on its own, with its gutter, for the shadows-off view (scene.mts): same lane as its row.
        const tile = Buffer.alloc(stride * stride * 4);
        blitRgba(renderMaterialFrame({ size, scenePitchDegrees: 0, phaseFrame: frameCount - 1, role, atmosphereModel }),
          size, size, tile, stride, stride, { left: gutter, top: gutter });
        await writeLossyWebp(sharp(tile, { raw: { width: stride, height: stride, channels: 4 } }),
          output(`${config.namespace}-${role}-flood${suffix}.webp`), { alphaQuality: 100, effort: 6 });
      }
    }
  }
  if (defaultFrame < 0 || defaultFrame >= frameCount) {
    throw new Error("Paged ellipsoid default material frame is invalid.");
  }
}

async function prepareShadowlessMaterial(size: number, suffix: string) {
  const {atmosphereModel}=requireMaterialPreparation();
  const pixels = renderMaterialFrame({size, scenePitchDegrees: LIT_DEFAULT_VIEW.initialScenePitchDegrees, role: 'lighting',
    atmosphereModel, shadowless: true});
  await sharp(pixels, {raw: {width: size, height: size, channels: 4}})
    .webp({lossless: true}).toFile(output(`${config.namespace}-lighting-shadowless${suffix}.webp`));
}

function renderMaterialFrame({
  size,
  scenePitchDegrees,
  role,
  atmosphereModel,
  shadowless = false,
  phaseFrame,
}: MaterialFrameInput) {
  if (role === "atmosphere") {
    return requireMaterialPreparation().atmosphere.prepareAtmosphereMaterialFrame({ size, frame: phaseFrame, model: atmosphereModel }).data;
  }
  const radius = size * config.material.discRadius;
  const center = (size - 1) / 2;
  const rgba = Buffer.alloc(size * size * 4);
  const overlay = shadowless ? config.material.shadowlessOverlay : undefined;
  const {attitude: bodyAttitude}=requireMaterialPreparation();
  // Every lighting frame is drawn on the default pose's plane; the runtime turns it by the Sun's screen angle. Frame i puts the
  // Sun at view z = -1 + 2i/(count - 1) on the default Sun's screen azimuth, so the frame the runtime selects is the real Sun.
  const planePitch = LIT_DEFAULT_VIEW.initialScenePitchDegrees;
  const screenToObject = (vector: readonly number[]) => bodyAttitude.screenToObject(vector, planePitch);
  const right = normalizeVector(screenToObject([0, 1, 0]));
  const down = normalizeVector(screenToObject([1, 0, 0]));
  const view = normalizeVector(screenToObject([0, 0, 1]));
  const sunView = bodyAttitude.sunView(planePitch), azimuth = Math.hypot(sunView[0], sunView[1]);
  const frameZ = phaseFrame === undefined ? sunView[2] : -1 + 2 * phaseFrame / (config.material.frameCount - 1);
  const across = Math.sqrt(Math.max(0, 1 - frameZ ** 2));
  const objectLight = shadowless
    ? view
    : normalizeVector(bodyAttitude.viewToObject([sunView[0] / azimuth * across, sunView[1] / azimuth * across, frameZ], planePitch));
  const solarTint = config.material.solarTint;
  const maximumTint = textureTintFactors(
    Math.PI,
    solarTint,
    solarTint,
    0.05 * Math.PI,
  );
  const maximumLightingFactor = Math.max(
    maximumTint.r,
    maximumTint.g,
    maximumTint.b,
  );
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const screenX = (x - center) / radius * config.geometry.EQUATORIAL_RADIUS;
      const screenY = (y - center) / radius * config.geometry.EQUATORIAL_RADIUS;
      const origin = [0, 1, 2].map((axis) =>
        right[axis] * screenX + down[axis] * screenY);
      const hit = intersectEllipsoid(origin, view);
      if (!hit) continue;
      const lightAlignment = dotVector(hit.normal, objectLight);
      const lambert = Math.max(0, lightAlignment);
      if (role === "lighting") {
        const diffuse = lambert * smoothstep(0, 0.1, lambert);
        const tint = textureTintFactors(
          Math.PI * diffuse,
          solarTint,
          solarTint,
          0.05 * Math.PI,
        );
        const lightingFactor = Math.max(tint.r, tint.g, tint.b) /
          maximumLightingFactor;
        const desiredChannel = applyLinearTint(160, lightingFactor);
        const shadowAlpha = Math.round(Math.max(
          0,
          Math.min(0.93, 1 - desiredChannel / 160),
        ) * 255);
        if (overlay) {
          rgba[offset] = overlay.color[0];
          rgba[offset + 1] = overlay.color[1];
          rgba[offset + 2] = overlay.color[2];
        }
        rgba[offset + 3] = overlay ? Math.round(shadowAlpha * overlay.opacity) : shadowAlpha;
        continue;
      }

    }
  }
  return rgba;
}

function blitRgba(sourceRgba: Buffer, sourceWidth: number, sourceHeight: number, targetRgba: Buffer,
  targetWidth: number, targetHeight: number, { left, top }: {left: number; top: number}) {
  if (left < 0 || top < 0 || left + sourceWidth > targetWidth ||
      top + sourceHeight > targetHeight) {
    throw new RangeError("Paged ellipsoid prepared material frame exceeds its shard.");
  }
  const rowBytes = sourceWidth * 4;
  for (let row = 0; row < sourceHeight; row += 1) {
    sourceRgba.copy(
      targetRgba,
      ((top + row) * targetWidth + left) * 4,
      row * rowBytes,
      (row + 1) * rowBytes,
    );
  }
}

function intersectEllipsoid(origin: readonly number[], direction: readonly number[]) {
  const equatorialSquared = config.geometry.EQUATORIAL_RADIUS ** 2;
  const polarSquared = (config.geometry.EQUATORIAL_RADIUS * config.polarRadiusKm / config.equatorialRadiusKm) ** 2;
  const coefficientA =
    (direction[0] ** 2 + direction[1] ** 2) / equatorialSquared +
    direction[2] ** 2 / polarSquared;
  const coefficientB = 2 * (
    (origin[0] * direction[0] + origin[1] * direction[1]) /
      equatorialSquared +
    origin[2] * direction[2] / polarSquared
  );
  const coefficientC =
    (origin[0] ** 2 + origin[1] ** 2) / equatorialSquared +
    origin[2] ** 2 / polarSquared - 1;
  const discriminant = coefficientB ** 2 - 4 * coefficientA * coefficientC;
  if (!Number.isFinite(discriminant) || discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const candidates = [
    (-coefficientB - root) / (2 * coefficientA),
    (-coefficientB + root) / (2 * coefficientA),
  ].map((distance) => {
    const position = [0, 1, 2].map((axis) =>
      origin[axis] + direction[axis] * distance);
    const normal = normalizeVector([
      position[0] / equatorialSquared,
      position[1] / equatorialSquared,
      position[2] / polarSquared,
    ]);
    return { position, normal, visibility: dotVector(normal, direction) };
  });
  return candidates[0].visibility >= candidates[1].visibility
    ? candidates[0]
    : candidates[1];
}

function dotVector(left: readonly number[], right: readonly number[]) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function rotateX([x, y, z]: readonly number[], radians: number) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z]: readonly number[], radians: number) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z]: readonly number[], radians: number) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function normalizeVector(vector: readonly number[]) {
  const length = Math.hypot(...vector) || 1;
  return vector.map((component) => component / length);
}

async function prepareInteriorAssets({ exterior = true, thumbnailsOnly = false } = {}) {
  const interior = validateInteriorSource(await readJsonSource(source(config.interiorPath)));
  const tomography = await readMantleTomography(sourceDirectory, interior, config);
  if (tomography && !thumbnailsOnly) {
    const legend = tomographyLegend(tomography.recipe);
    await sharp(legend.data, { raw: legend }).png().toFile(output(tomography.recipe.legend.image));
  }
  if (exterior) await prepareInteriorOuterPoles();
  for (const bank of [{ name: 'interior', tomography: null }, ...(tomography ? [{ name: 'tomography', tomography }] : [])]) {
  const tomography = bank.tomography;
  if (!thumbnailsOnly) {
  for (const layer of interior.layers.slice(1)) {
    if (tomography && layer.id !== 'mantle' && !tomography.recipe.schematicColors?.[layer.id]) continue;
    for (const density of [1, 2]) {
      const width = 1024 * density;
      const height = 512 * density;
      const data = renderInteriorShell(width, height, hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color), layer.id === 'mantle' ? tomography : null);
      await writeSphereAssets({
        data,
        width,
        height,
        channels: 3,
        density,
        name: `${config.namespace}-${bank.name}-${layer.id}`,
        bandCount: 8,
        longitudeOffsetDegrees: 0,
        webp: layer.id === 'mantle' && tomography ? tomography.recipe.webp : { lossless: true },
        cutaway: interior.presentation?.cutThroughCenter || layer.innerRadiusKm > 0 ? config.geometry.interiorCutaway : undefined,
      });
    }
  }
  for (const density of [1, 2]) {
    const faceSize = 512 * density;
    const section = renderInteriorSection(interior, faceSize, tomography);
    const suffix = density === 2 ? "@2x" : "";
    await sharp(section, {
      raw: { width: faceSize * 2, height: faceSize, channels: 4 },
    }).webp(tomography ? { ...tomography.recipe.webp, alphaQuality: 100 } : { lossless: true }).toFile(output(
      `${config.namespace}-${bank.name}-section${suffix}.webp`,
    ));
  }
  }
  const thumbnail = renderInteriorThumbnail(interior, 96, tomography);
  await sharp(thumbnail, {
    raw: { width: 96, height: 96, channels: 4 },
  }).webp({ quality: 88, alphaQuality: 100 }).toFile(
    output(`${config.namespace}-view-${bank.name}.webp`),
  );
  }
}

async function prepareInteriorOuterPoles() {
  for (const density of [1, 2]) {
    const width = 2048 * density;
    const height = 1024 * density;
    const { data: base, info } = await sharp(
      source(config.surface.maps[0].path),
    ).resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    applyDisplayGamma(base, config.surface.maps[0].displayGamma);
    const oceanFill = config.surface.maps[0].deepOceanFill;
    if (oceanFill) {
      const fill = await readDeepOceanFill(sourceDirectory, oceanFill, config.surface.maps[0].path);
      applyDeepOceanFill(base, await resizeDeepOceanFill(fill, width, height), { width, height, channels: info.channels });
    }
    const clouded = await prepareCloudComposite(base, {
      width,
      height,
      channels: info.channels,
      config,
      sourceDirectory,
    });
    const lit = prepareObjectLightingMap({
      data: clouded,
      width,
      height,
      channels: info.channels,
    });
    for (const [suffix, data] of [["", clouded], ["-lit", lit]] as const) await writeSphereAssets({
      data,
      width,
      height,
      channels: info.channels,
      density,
      name: `${config.namespace}-interior-outer${suffix}`,
      projectiveSurface: true,
      bandCount: 16,
      longitudeOffsetDegrees: 0,
      webp: { quality: 88, smartSubsample: true },
      cutaway: config.geometry.interiorCutaway,
    });
  }
}

function prepareObjectLightingMap({ data, width, height, channels }: RasterInfo & {data: Buffer}) {
  const output = Buffer.from(data);
  const radians = Math.PI / 180;
  const objectLight = normalizeVector(requireMaterialPreparation().attitude.objectLight);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const latitudeRadius = Math.cos(latitude);
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const normal = [
        latitudeRadius * Math.cos(longitude),
        latitudeRadius * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const lambert = Math.max(0, dotVector(normal, objectLight));
      const factor = 0.12 + 0.88 * lambert * smoothstep(0, 0.1, lambert);
      const offset = (y * width + x) * channels;
      for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = applyLinearTint(data[offset + channel], factor);
      }
    }
  }
  return output;
}

function validateInteriorSource(input: unknown) {
  const value = parseInteriorSource(input), radius = requireFiniteNumber(value[config.interiorRadiusKey], "Interior radius");
  if (value?.schema !== config.interiorSchema ||
      !Number.isFinite(radius) || radius <= 0 ||
      !isArray(value.layers) || value.layers.length !== 4) {
    throw new TypeError("Paged ellipsoid interior source is incompatible.");
  }
  let expectedOuter = radius;
  for (const layer of value.layers) {
    if (typeof layer.id !== "string" || !/^#[0-9a-f]{6}$/iu.test(layer.color) ||
        layer.outerRadiusKm !== expectedOuter ||
        !Number.isFinite(layer.innerRadiusKm) || layer.innerRadiusKm < 0 ||
        layer.innerRadiusKm >= layer.outerRadiusKm) {
      throw new TypeError(`Paged ellipsoid interior layer is incompatible: ${layer.id}.`);
    }
    expectedOuter = layer.innerRadiusKm;
  }
  if (expectedOuter !== 0) {
    throw new TypeError("Paged ellipsoid interior layers do not close at the center.");
  }
  return value;
}

function renderInteriorShell(width: number, height: number, color: readonly number[], tomography: Tomography) {
  const rgb = Buffer.alloc(width * height * 3);
  const light = normalizeVector([0.72, -0.38, 0.58]);
  for (let y = 0; y < height; y += 1) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const latitudeRadius = Math.cos(latitude);
    for (let x = 0; x < width; x += 1) {
      const longitude = (x + 0.5) / width * Math.PI * 2;
      const normal = [
        latitudeRadius * Math.cos(longitude),
        latitudeRadius * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const diffuse = 0.46 + 0.54 * Math.max(0, dotVector(normal, light));
      const sampledColor = tomography?.shellColor(longitude * 180 / Math.PI, latitude * 180 / Math.PI);
      const offset = (y * width + x) * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        rgb[offset + channel] = sampledColor ? sampledColor[channel] : Math.round(color[channel] * diffuse);
      }
    }
  }
  return rgb;
}

function renderInteriorSection(interior: InteriorSource, faceSize: number, tomography: Tomography) {
  const width = faceSize * 2;
  const rgba = Buffer.alloc(width * faceSize * 4);
  const faceGains = [0.86, 1];
  for (let face = 0; face < 2; face += 1) {
    for (let y = 0; y < faceSize; y += 1) {
      const vertical = 1 - (y + 0.5) / faceSize * 2;
      for (let x = 0; x < faceSize; x += 1) {
        const horizontal = (x + 0.5) / faceSize;
        const radius = Math.hypot(horizontal, vertical);
        if (radius > 1) continue;
        const layer = interior.layers.find(({ innerRadiusKm, outerRadiusKm }) =>
          radius * requireFiniteNumber(interior[config.interiorRadiusKey], "Interior radius") >= innerRadiusKm &&
          radius * requireFiniteNumber(interior[config.interiorRadiusKey], "Interior radius") <= outerRadiusKm) ??
          interior.layers[interior.layers.length - 1];
        const scientific = tomography && layer.id === 'mantle';
        const color = scientific ? tomography.sectionColor(face, radius, vertical, horizontal) : hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color);
        const radialShade = 0.74 + 0.26 * Math.sqrt(1 - radius * radius);
        const offset = (y * width + face * faceSize + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          rgba[offset + channel] = Math.round(
            color[channel] * (scientific ? 1 : radialShade * faceGains[face]),
          );
        }
        rgba[offset + 3] = 255;
      }
    }
  }
  return rgba;
}

function renderInteriorThumbnail(interior: InteriorSource, size: number, tomography: Tomography) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const radiusPixels = size * 0.46;
  // A wider section makes the data legible in the 14 px list icon without
  // changing the globe's cut geometry or the source layer proportions.
  const halfCutawayDegrees = (interior.presentation?.thumbnailCutawayDegrees ?? 90) / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - center) / radiusPixels;
      const dy = (y - center) / radiusPixels;
      const radius = Math.hypot(dx, dy);
      if (radius > 1) continue;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const inCutaway = angle >= -halfCutawayDegrees && angle <= halfCutawayDegrees;
      const layer = interior.layers.find(({ innerRadiusKm, outerRadiusKm }) =>
        radius * requireFiniteNumber(interior[config.interiorRadiusKey], "Interior radius") >= innerRadiusKm &&
        radius * requireFiniteNumber(interior[config.interiorRadiusKey], "Interior radius") <= outerRadiusKm) ??
        interior.layers[interior.layers.length - 1];
      const scientific = inCutaway && tomography && layer.id === 'mantle';
      const color = scientific ? tomography.sectionColor(0, radius, -dy, dx)
        : inCutaway ? hexRgb(tomography?.recipe.schematicColors?.[layer.id] ?? layer.color) : [42, 99, 139];
      const shade = 0.64 + 0.36 * Math.sqrt(1 - radius * radius);
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[offset + channel] = Math.round(color[channel] * (scientific ? 1 : shade));
      }
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

function hexRgb(value: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(
    value.slice(offset, offset + 2),
    16,
  ));
}

async function prepareLensThumbnail(input: string | Buffer, filename: string, longitude: number | null = null, region: {longitude?: number; latitude?: number; spanDegrees?: number} = {}) {
  const metadata = await sharp(input).metadata();
  if (metadata.width === undefined || metadata.height === undefined) throw new Error("Map thumbnail dimensions are missing.");
  const centerLongitude = region.longitude ?? longitude ?? 0;
  const centerLatitude = region.latitude ?? 0;
  const spanDegrees = region.spanDegrees ?? 90;
  if (!Number.isFinite(centerLongitude) || Math.abs(centerLongitude) > 180 ||
      !Number.isFinite(centerLatitude) || Math.abs(centerLatitude) > 90 ||
      !Number.isFinite(spanDegrees) || spanDegrees <= 0 || spanDegrees > 180) {
    throw new TypeError('Invalid dataset thumbnail region.');
  }
  const cropSize = Math.max(1, Math.round(metadata.height * spanDegrees / 180));
  const size = 96;
  await sharp(input)
    .extract({
      left: Math.max(0, Math.min(metadata.width - cropSize, Math.round((centerLongitude + 180) / 360 * metadata.width - cropSize / 2))),
      top: Math.max(0, Math.min(metadata.height - cropSize, Math.round((90 - centerLatitude) / 180 * metadata.height - cropSize / 2))),
      width: cropSize,
      height: cropSize,
    })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .webp({ quality: 88, effort: 6 })
    .toFile(output(filename));
}



function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return progress * progress * (3 - 2 * progress);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

}

// Shared interpretation for globe assets and the small sidebar preview.
export async function preparePagedSurfaceMap({ config, sourceDirectory, map, kernel = map.scientific ? "nearest" : "lanczos3" }: {config: SurfaceAssetsConfiguration; sourceDirectory: string; map: SurfaceMapInput; kernel?: ResizeKernel}) {
  const width = config.surface.width;
  const height = config.surface.height;
  if (map.scientific?.kind === "gebco-elevation") return prepareElevationMap({ sourceDirectory, map: {path: requireString(map.path), scientific: map.scientific}, width, height });
  if (map.scientific?.kind === "black-marble-radiance") return prepareNightLightsMap({ sourceDirectory, map: {path: requireString(map.path), scientific: map.scientific}, width, height });
  const input = sharp(Buffer.isBuffer(map.path) ? map.path : resolve(sourceDirectory, map.path));
  if (map.nativePhotographicSampling) {
    const { data, info } = await input.removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (map.scientific || info.channels !== 3 || info.width !== info.height * 2 || info.width < width || info.height < height) {
      throw new Error("Native photographic sampling requires a complete RGB source grid at least as large as the canonical map.");
    }
    const nativeDisplayGamma = map.displayGamma ?? 1;
    if (!Number.isFinite(nativeDisplayGamma) || nativeDisplayGamma < 1 || nativeDisplayGamma > 2) {
      throw new TypeError('Display gamma must be a finite number between 1 and 2.');
    }
    const nativeDeepOceanFill = map.deepOceanFill && typeof map.path === 'string'
      ? await readDeepOceanFill(sourceDirectory, map.deepOceanFill, map.path, { data, width: info.width, height: info.height, channels: 3 })
      : undefined;
    if (map.deepOceanFill && !nativeDeepOceanFill) throw new Error('A deep ocean fill replacement requires its plain source path.');
    let nativePhotographicClouds: NativePhotographicCloudComposite | undefined;
    if (map.compositeClouds) {
      const clouds = await sharp(resolve(sourceDirectory, config.surface.clouds.path))
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const cloudChannels = clouds.info.channels;
      if (cloudChannels !== 3 || clouds.info.width !== clouds.info.height * 2 ||
          clouds.info.width < width || clouds.info.height < height) {
        throw new Error("Native photographic cloud sampling requires a complete RGB source grid at least as large as the canonical map.");
      }
      nativePhotographicClouds = { data: clouds.data, width: clouds.info.width, height: clouds.info.height,
        channels: cloudChannels, ...config.surface.clouds };
    }
    return { data, info, nativePhotographicClouds, nativeDeepOceanFill };
  }
  const { data, info } = await input
    .resize(width, height, { fit: "fill", kernel })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  applyDisplayGamma(data, map.displayGamma);
  if (map.deepOceanFill) {
    if (typeof map.path !== 'string') throw new Error('A deep ocean fill replacement requires its plain source path.');
    const fill = await readDeepOceanFill(sourceDirectory, map.deepOceanFill, map.path);
    applyDeepOceanFill(data, await resizeDeepOceanFill(fill, width, height), { width, height, channels: info.channels });
  }
  const preparedData = map.compositeClouds
    ? await prepareCloudComposite(data, {
      width,
      height,
      channels: info.channels, config, sourceDirectory,
    })
    : data;
  return { data: preparedData, info };
}

async function prepareCloudComposite(base: Buffer, { width, height, channels, config, sourceDirectory }: RasterInfo & {config: SurfaceAssetsConfiguration; sourceDirectory: string}) {
  const { data: clouds, info } = await sharp(resolve(sourceDirectory, config.surface.clouds.path))
    .resize(width, height, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.from(base);
  for (let sourceIndex = 0, targetIndex = 0;
    sourceIndex < clouds.length;
    sourceIndex += info.channels, targetIndex += channels) {
    const luminance = clouds[sourceIndex] * 0.2126 +
      clouds[sourceIndex + 1] * 0.7152 + clouds[sourceIndex + 2] * 0.0722;
    const alpha = Math.max(0, Math.min(config.surface.clouds.maximumAlpha, (luminance - config.surface.clouds.threshold) / 255 * config.surface.clouds.scale));
    for (let channel = 0; channel < 3; channel += 1) {
      const cloudColor = config.surface.clouds.color[channel];
      output[targetIndex + channel] = Math.round(
        base[targetIndex + channel] * (1 - alpha) + cloudColor * alpha,
      );
    }
  }
  return output;
}
