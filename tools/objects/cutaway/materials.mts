import { sha256 } from '../../../src/platform/sha256.mts';
import {parse} from '@cssearth/core/schema';
import {cutawayRecipe} from './recipe-contract.mts';
import {interiorSource, type InteriorSource} from './source-contract.mts';
import type {ReadonlyVector3, Vector3} from '../material-composition/ellipsoid.mts';
interface InteriorLensPlan {id:string;model:string;qualification:string;palette:InteriorSource['palette'];sectionResponse:{innerFloor:number;startRadius:number;exponent:number};shellGain:{metallic:number;core:number};filter?:string;wavelength?:string}
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {optimizePreparedQ75Webp,PREPARED_Q75_WEBP_ENCODING} from '../../prepared/prepared-webp.mts';
import {writeLossyWebp} from '../../../src/preparation/raster/lossy-lane.ts';
import {verifyObservationSources} from '../observed-surfaces/index.mts';
import {dotVector as dot3} from '../material-composition/ellipsoid.mts';

/** Interior cutaways are smooth illustrations, written in the lossy lane (lossy-lane.ts). */
const INTERIOR_WEBP = { alphaQuality: 100, effort: 6 } as const;
import {validateMaterialRecipe,validateRelativePath} from '../material-composition/recipe.mts';
/** Declared radial composition, two-face cutaway shading, and polar wedge rasters. */
export async function prepareCutawayMaterials({sourceDirectory,publicDirectory,config:input,objectLightDirection}: {sourceDirectory:string;publicDirectory:string;config:unknown;objectLightDirection:ReadonlyVector3}) {
  const config=parse(input,cutawayRecipe,'cutaway material recipe');
  validateMaterialRecipe(config, 'cssearth-cutaway-materials@1');
  validateRelativePath(config.source);
  await verifyObservationSources(sourceDirectory,[{path:config.source}]);













const OUTER_POLE_SOURCES = config.outerPoleSources;
const THUMBNAIL_URL = config.thumbnailUrl;
const INTERIOR_OBJECT_LIGHT_DIRECTION = objectLightDirection;

const manifest = parse(JSON.parse(await readFile(resolve(sourceDirectory,config.source),'utf8')),interiorSource,'interior source');
validateManifest(manifest);

const interiorLensPlans:readonly InteriorLensPlan[] = Object.freeze([
  Object.freeze({
    id: "normal",
    model: "prepared-schematic-composition-depth-map",
    qualification: manifest.cutaway.qualification,
    palette: manifest.palette,
    sectionResponse: Object.freeze({
      innerFloor: 1,
      startRadius: 0,
      exponent: 1,
    }),
    shellGain: Object.freeze({ metallic: 1, core: 1 }),
  }),
]);
const interiorLensAssets = Object.freeze(Object.fromEntries(await Promise.all(
  interiorLensPlans.map(async (plan) => [
    plan.id,
    await prepareInteriorLensAssets(plan),
  ] as const),
)));
const assets = Object.freeze({
  ...interiorLensAssets.normal,
  outerPoles: Object.freeze(Object.fromEntries(await Promise.all(
    Object.entries(OUTER_POLE_SOURCES).map(async ([lens, sourceUrl]) => [
      lens,
      await writePreparedOuterPoleRaster({
        sourceUrl,
        url: `${config.publicPrefix}${config.namespace}-interior-outer-poles-${lens}.webp`,
        url2x: `${config.publicPrefix}${config.namespace}-interior-outer-poles-${lens}@2x.webp`,
        cutaway: manifest.cutaway,
      }),
    ] as const),
  ))),
});

const thumbnail = await renderThumbnail(manifest);
await sharp(thumbnail, {
  raw: { width: config.thumbnail.width, height: config.thumbnail.height, channels: 4 },
}).webp({ lossless: true }).toFile(publicPath(THUMBNAIL_URL));
await optimizePreparedQ75Webp(publicPath(THUMBNAIL_URL));
const thumbnailBytes = await readFile(publicPath(THUMBNAIL_URL));

const prepared = Object.freeze({
  schema: config.outputSchema,
  presentation: "cross-section-lens",
  runtimeGeometry: false,
  runtimeRasterization: false,
  cutaway: Object.freeze({ ...manifest.cutaway }),
  lighting: Object.freeze({
    model: "prepared-object-light-two-face-cutaway-and-curved-shell-shading",
    authority: "prepared-ring-source-object-light-direction",
    objectLightDirection: INTERIOR_OBJECT_LIGHT_DIRECTION,
    sectionFaceLongitudesDegrees: Object.freeze(sectionFaceLongitudes(manifest)),
    sectionFaceCount: 2,
    runtimeLighting: false,
  }),
  interiorLenses: Object.freeze(Object.fromEntries(interiorLensPlans.map(
    (plan) => [plan.id, Object.freeze({
      id: plan.id,
      model: plan.model,
      qualification: plan.qualification,
      ...(plan.filter ? { filter: plan.filter } : {}),
      ...(plan.wavelength ? { wavelength: plan.wavelength } : {}),
      sectionResponse: plan.sectionResponse,
      shellGain: plan.shellGain,
      assets: interiorLensAssets[plan.id],
      runtimeFiltering: false,
      runtimeRasterization: false,
    })] as const,
  ))),
  assets: Object.freeze({
    ...assets,
    thumbnail: Object.freeze({
      url: THUMBNAIL_URL,
      width: config.thumbnail.width,
      height: config.thumbnail.height,
      bytes: thumbnailBytes.byteLength,
      sha256: sha256(thumbnailBytes),
      encoding: PREPARED_Q75_WEBP_ENCODING,
    }),
  }),
  provenance: Object.freeze({
    sourceManifest: config.provenanceSource,
    sources: Object.freeze(manifest.sources),
  }),
});





function validateManifest(value:InteriorSource) {
  if (value?.schema !== config.sourceSchema ||
      value.defaultView !== "exterior" ||
      !Array.isArray(value.sources) || value.sources.length < 3) {
    throw new TypeError("Cutaway interior source manifest is incompatible.");
  }
  const { cutaway, palette } = value;
  for (const key of [
    "centerLongitudeDegrees",
    "widthDegrees",
    "metallicShellRadius",
    "diffuseCoreVisualRadius",
    "diffuseCoreTransitionRadius",
  ] as const) {
    if (!Number.isFinite(cutaway?.[key])) {
      throw new TypeError(`Cutaway interior ${key} is invalid.`);
    }
  }
  if (cutaway.widthDegrees <= 0 || cutaway.widthDegrees >= 180 ||
      cutaway.diffuseCoreVisualRadius >= cutaway.metallicShellRadius ||
      cutaway.diffuseCoreTransitionRadius <= cutaway.diffuseCoreVisualRadius) {
    throw new RangeError("Cutaway interior radial or cutaway ranges are invalid.");
  }
  for (const key of [
    "molecularEnvelope",
    "metallicHydrogen",
    "diffuseCore",
    "deepCore",
  ] as const) {
    if (!Array.isArray(palette?.[key]) || palette[key].length !== 3 ||
        palette[key].some((channel) => !Number.isInteger(channel) ||
          channel < 0 || channel > 255)) {
      throw new TypeError(`Cutaway interior palette ${key} is invalid.`);
    }
  }
}

async function prepareInteriorLensAssets(plan:InteriorLensPlan) {
  const urls = (kind:string) => interiorAssetUrls(kind, plan.id);
  return Object.freeze({
    section: await writePreparedRaster({
      ...urls("section"),
      width: config.rasters.section[0],
      height: config.rasters.section[1],
      render: (width, height) =>
        renderSectionAtlas(width, height, manifest, plan),
    }),
    metallic: await writePreparedRaster({
      ...urls("metallic"),
      width: config.rasters.shell[0],
      height: config.rasters.shell[1],
      render: (width, height) => renderShell(
        width,
        height,
        plan.palette.metallicHydrogen,
        "metallic",
        plan,
      ),
    }),
    core: await writePreparedRaster({
      ...urls("core"),
      width: config.rasters.shell[0],
      height: config.rasters.shell[1],
      render: (width, height) => renderShell(
        width,
        height,
        plan.palette.diffuseCore,
        "core",
        plan,
      ),
    }),
    metallicPoles: await writePreparedRaster({
      ...urls("metallic-poles"),
      width: config.rasters.poles[0],
      height: config.rasters.poles[1],
      render: (width, height) => renderPoleAtlas(
        width,
        height,
        plan.palette.metallicHydrogen,
        manifest.cutaway,
        true,
        plan,
        "metallic",
      ),
    }),
    corePoles: await writePreparedRaster({
      ...urls("core-poles"),
      width: config.rasters.poles[0],
      height: config.rasters.poles[1],
      render: (width, height) => renderPoleAtlas(
        width,
        height,
        plan.palette.diffuseCore,
        manifest.cutaway,
        false,
        plan,
        "core",
      ),
    }),
  });
}

function interiorAssetUrls(kind:string, lensId:string) {
  const suffix = lensId === "normal" ? "" : `-${lensId}`;
  return Object.freeze({
    url: `${config.publicPrefix}${config.namespace}-interior-${kind}${suffix}.webp`,
    url2x: `${config.publicPrefix}${config.namespace}-interior-${kind}${suffix}@2x.webp`,
  });
}

async function writePreparedRaster({ url, url2x, width, height, render }: {url:string;url2x:string;width:number;height:number;render:(width:number,height:number)=>Buffer}) {
  const outputs = [];
  for (const [assetUrl, scale] of [[url, 1], [url2x, 2]] as const) {
    const rasterWidth = width * scale;
    const rasterHeight = height * scale;
    const raw = render(rasterWidth, rasterHeight);
    await writeLossyWebp(sharp(raw, {
      raw: { width: rasterWidth, height: rasterHeight, channels: 4 },
    }), publicPath(assetUrl), INTERIOR_WEBP);
    const bytes = await readFile(publicPath(assetUrl));
    outputs.push(Object.freeze({
      url: assetUrl,
      width: rasterWidth,
      height: rasterHeight,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }));
  }
  return Object.freeze({
    url,
    url2x,
    width,
    height,
    asset: outputs[0],
    asset2x: outputs[1],
  });
}

async function writePreparedOuterPoleRaster({
  sourceUrl,
  url,
  url2x,
  cutaway,
}: {sourceUrl:string;url:string;url2x:string;cutaway:InteriorSource['cutaway']}) {
  const sourcePath = publicPath(sourceUrl);
  const metadata = await sharp(sourcePath).metadata();
  if (metadata.width !== config.outerPoleAtlas.width || metadata.height !== config.outerPoleAtlas.height) {
    throw new Error(`Cutaway outer pole source changed: ${sourceUrl}.`);
  }
  const outputs = [];
  for (const [assetUrl, scale] of [[url, 1], [url2x, 2]] as const) {
    const tileSize = config.outerPoleAtlas.outputTileSize * scale;
    const width = tileSize * 2;
    const height = tileSize;
    const { data, info } = await sharp(sourcePath)
      .extract(config.outerPoleAtlas.extract)
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) {
      throw new Error(`Cutaway outer pole source lost alpha: ${sourceUrl}.`);
    }
    for (let tile = 0; tile < 2; tile += 1) {
      for (let row = 0; row < tileSize; row += 1) {
        const y = (row + 0.5) / tileSize * 2 - 1;
        for (let column = 0; column < tileSize; column += 1) {
          const x = (column + 0.5) / tileSize * 2 - 1;
          const longitude = Math.atan2(y, x) * 180 / Math.PI;
          if (angularDistance(
            longitude,
            cutaway.centerLongitudeDegrees,
          ) <= cutaway.widthDegrees / 2) {
            data[(row * width + tile * tileSize + column) * 4 + 3] = 0;
          }
        }
      }
    }
    await writeLossyWebp(sharp(data, {
      raw: { width, height, channels: 4 },
    }), publicPath(assetUrl), INTERIOR_WEBP);
    const bytes = await readFile(publicPath(assetUrl));
    outputs.push(Object.freeze({
      url: assetUrl,
      width,
      height,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
    }));
  }
  return Object.freeze({
    sourceUrl,
    url,
    url2x,
    width: outputs[0].width,
    height: outputs[0].height,
    asset: outputs[0],
    asset2x: outputs[1],
  });
}

function renderSectionAtlas(width:number, height:number, manifest:InteriorSource, lensPlan:InteriorLensPlan) {
  if (width % 2 !== 0) {
    throw new RangeError("Cutaway interior section atlas width must be even.");
  }
  const output = Buffer.alloc(width * height * 4);
  const faceWidth = width / 2;
  const longitudes = sectionFaceLongitudes(manifest);
  for (let faceIndex = 0; faceIndex < longitudes.length; faceIndex += 1) {
    renderSectionFace({
      output,
      atlasWidth: width,
      faceLeft: faceIndex * faceWidth,
      width: faceWidth,
      height,
      faceLongitudeDegrees: longitudes[faceIndex],
      manifest,
      lensPlan,
    });
  }
  return output;
}

function renderSectionFace({
  output,
  atlasWidth,
  faceLeft,
  width,
  height,
  faceLongitudeDegrees,
  manifest: { cutaway },
  lensPlan,
}: {output:Buffer;atlasWidth:number;faceLeft:number;width:number;height:number;faceLongitudeDegrees:number;manifest:InteriorSource;lensPlan:InteriorLensPlan}) {
  const { palette, sectionResponse } = lensPlan;
  const edge = config.section.edgePixels / Math.min(width, height);
  const longitude = faceLongitudeDegrees * Math.PI / 180;
  const faceNormal:Vector3 = [-Math.sin(longitude), Math.cos(longitude), 0];
  const faceExposure = Math.abs(dot3(
    faceNormal,
    INTERIOR_OBJECT_LIGHT_DIRECTION,
  ));
  const faceLight = config.section.faceAmbient + faceExposure * config.section.faceExposureGain;
  for (let row = 0; row < height; row += 1) {
    const y = (row + 0.5) / height * 2 - 1;
    for (let column = 0; column < width; column += 1) {
      const x = (column + 0.5) / width;
      const radius = Math.hypot(x, y);
      const offset = (row * atlasWidth + faceLeft + column) * 4;
      if (radius > 1 + edge) continue;
      const envelope = smoothstep(...config.section.envelope, radius);
      const core = 1 - smoothstep(
        cutaway.diffuseCoreVisualRadius * config.section.coreInnerScale,
        cutaway.diffuseCoreTransitionRadius,
        radius,
      );
      const metallic = Math.max(0, 1 - envelope - core * config.section.metallicCoreGain);
      const deepCore = 1 - smoothstep(...config.section.deepCore, radius);
      const weights = normalizeWeights([
        envelope,
        metallic,
        core * (1 - deepCore),
        deepCore,
      ]);
      const base = mixPalette([
        palette.molecularEnvelope,
        palette.metallicHydrogen,
        palette.diffuseCore,
        palette.deepCore,
      ], weights);
      const texture = sectionTexture(x, y, radius);
      const depthLight = config.section.depthAmbient + config.section.depthGain * smoothstep(config.section.depthStart, 1, radius);
      const rimLight = 1 + smoothstep(config.section.rimStart, 1, radius) * config.section.rimGain;
      const contactShadow = 1 -
        softBand(radius, cutaway.diffuseCoreTransitionRadius, config.section.contactCoreWidth) * config.section.contactCoreGain -
        softBand(radius, config.section.contactEnvelopeRadius, config.section.contactEnvelopeWidth) * config.section.contactEnvelopeGain;
      const spectralResponse = sectionResponse.innerFloor +
        (1 - sectionResponse.innerFloor) * Math.pow(
          smoothstep(sectionResponse.startRadius, 1, radius),
          sectionResponse.exponent,
        );
      const light = faceLight * depthLight * rimLight * contactShadow *
        spectralResponse;
      output[offset] = clampByte(base[0] * light + texture * config.section.textureGain[0]);
      output[offset + 1] = clampByte(base[1] * light + texture * config.section.textureGain[1]);
      output[offset + 2] = clampByte(base[2] * light + texture * config.section.textureGain[2]);
      output[offset + 3] = clampByte(
        (1 - smoothstep(1 - edge, 1 + edge, radius)) * 255,
      );
    }
  }
}

function renderShell(width:number, height:number, color:readonly number[], kind:'metallic'|'core', lensPlan:InteriorLensPlan) {
  const shell=config.shells[kind];
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const latitude = (0.5 - (row + 0.5) / height) * Math.PI;
    for (let column = 0; column < width; column += 1) {
      const longitude = (column + 0.5) / width * Math.PI * 2;
      const offset = (row * width + column) * 4;
      const bands = Math.sin(latitude * shell.bandFrequency +
        Math.sin(longitude * 3) * 0.55);
      const grains = deterministicNoise(column, row, shell.seed);
      const normal:Vector3 = [
        Math.cos(latitude) * Math.cos(longitude),
        Math.cos(latitude) * Math.sin(longitude),
        Math.sin(latitude),
      ];
      const lambert = Math.max(0, dot3(
        normal,
        INTERIOR_OBJECT_LIGHT_DIRECTION,
      ));
      const light = shell.ambient +
        lambert * shell.directional;
      const spectralGain = lensPlan.shellGain[kind];
      const detail = bands * 5 + grains * shell.grainGain;
      output[offset] = clampByte(color[0] * light * spectralGain + detail);
      output[offset + 1] = clampByte(
        color[1] * light * spectralGain + detail * 0.72,
      );
      output[offset + 2] = clampByte(
        color[2] * light * spectralGain + detail * 0.45,
      );
      output[offset + 3] = 255;
    }
  }
  return output;
}

function renderPoleAtlas(
  width:number,
  height:number,
  color:readonly number[],
  cutaway:InteriorSource['cutaway'],
  removeWedge:boolean,
  lensPlan:InteriorLensPlan,
  kind:'metallic'|'core',
) {
  const output = Buffer.alloc(width * height * 4);
  const tileSize = height;
  for (let tile = 0; tile < 2; tile += 1) {
    const tileLeft = tile * tileSize;
    for (let row = 0; row < tileSize; row += 1) {
      const y = (row + 0.5) / tileSize * 2 - 1;
      for (let column = 0; column < tileSize; column += 1) {
        const x = (column + 0.5) / tileSize * 2 - 1;
        const radius = Math.hypot(x, y);
        if (radius > 1) continue;
        const longitude = Math.atan2(y, x) * 180 / Math.PI;
        const inWedge = removeWedge && angularDistance(
          longitude,
          cutaway.centerLongitudeDegrees,
        ) <= cutaway.widthDegrees / 2;
        if (inWedge) continue;
        const offset = (row * width + tileLeft + column) * 4;
        const grains = deterministicNoise(column, row, tile + 101);
        const z = Math.sqrt(Math.max(0, 1 - radius * radius)) *
          (tile === 0 ? 1 : -1);
        const normal = normalize3([x, y, z]);
        const lambert = Math.max(0, dot3(
          normal,
          INTERIOR_OBJECT_LIGHT_DIRECTION,
        ));
        const light = 0.68 + lambert * 0.32;
        const spectralGain = lensPlan.shellGain[kind];
        output[offset] = clampByte(
          color[0] * light * spectralGain + grains * 11,
        );
        output[offset + 1] = clampByte(
          color[1] * light * spectralGain + grains * 8,
        );
        output[offset + 2] = clampByte(
          color[2] * light * spectralGain + grains * 5,
        );
        output[offset + 3] = 255;
      }
    }
  }
  return output;
}

function renderThumbnail({ palette }:{palette:InteriorSource['palette']}) {
  const {width,height} = config.thumbnail;
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const offset = (row * width + column) * 4;
      const y = (row + 0.5) / height;
      const molecularToMetallic = smoothstep(0.28, 0.5, y);
      const metallicToCore = smoothstep(0.58, 0.82, y);
      const envelopeMetallic = mixPalette([
        palette.molecularEnvelope,
        palette.metallicHydrogen,
      ], [1 - molecularToMetallic, molecularToMetallic]);
      const color = mixPalette([
        envelopeMetallic,
        palette.diffuseCore,
      ], [1 - metallicToCore, metallicToCore]);
      const band = Math.sin(y * 34 + Math.sin(column * 0.09) * 0.6) * 4;
      const grain = deterministicNoise(column, row, 907) * 5;
      output[offset] = clampByte(color[0] + band + grain);
      output[offset + 1] = clampByte(color[1] + band * 0.72 + grain * 0.7);
      output[offset + 2] = clampByte(color[2] + band * 0.48 + grain * 0.45);
      output[offset + 3] = 255;
    }
  }
  return output;
}

function sectionTexture(x:number, y:number, radius:number) {
  const broad = Math.sin(radius * 22 + Math.sin(y * 7) * 1.15) * 0.34;
  const directional = Math.sin((x * 9 + y * 6) * Math.PI) * 0.2;
  const grain = deterministicNoise(
    Math.floor(x * 4096),
    Math.floor((y + 1) * 2048),
    29,
  ) * 0.28;
  return broad + directional + grain;
}

function sectionFaceLongitudes({ cutaway }:{cutaway:InteriorSource['cutaway']}) {
  return [
    cutaway.centerLongitudeDegrees - cutaway.widthDegrees / 2,
    cutaway.centerLongitudeDegrees + cutaway.widthDegrees / 2,
  ];
}

function softBand(value:number, center:number, width:number) {
  const distance = Math.abs(value - center) / width;
  if (distance >= 1) return 0;
  const amount = 1 - distance;
  return amount * amount * (3 - 2 * amount);
}



function normalize3(vector:ReadonlyVector3):Vector3 {
  const length = Math.hypot(...vector);
  return length > 0 ? [vector[0]/length,vector[1]/length,vector[2]/length] : [0, 0, 0];
}

function smoothstep(start:number, end:number, value:number) {
  const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

function normalizeWeights(weights:readonly number[]) {
  const sum = weights.reduce((total, weight) => total + Math.max(0, weight), 0);
  if (sum <= 0) return weights.map(() => 0);
  return weights.map((weight) => Math.max(0, weight) / sum);
}

function mixPalette(colors:readonly (readonly number[])[], weights:readonly number[]) {
  return [0, 1, 2].map((channel) => colors.reduce(
    (sum, color, index) => sum + color[channel] * weights[index],
    0,
  ));
}

function deterministicNoise(x:number, y:number, seed:number) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 19.19) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function angularDistance(left:number, right:number) {
  return Math.abs(((left - right + 540) % 360) - 180);
}

function clampByte(value:number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function publicPath(url:string) { const filename=url.startsWith(config.publicPrefix)?url.slice(config.publicPrefix.length):'';if(!/^[a-z0-9@.-]+$/u.test(filename))throw new TypeError('Invalid cutaway texture URL.');return resolve(publicDirectory,filename); }



return prepared;
}
