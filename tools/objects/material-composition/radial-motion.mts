import { applyLinearTint } from '../color-transfer.mts';
import {parse, object, string, boolean} from '@cssearth/core/schema';
import {radialMotionRecipe, type RadialMotionRecipe} from './radial-motion-recipe.mts';
import type {ReadonlyVector3} from './ellipsoid.mts';
export const bodyRingShadow = object({model:string,edgeFeather:object({model:string,runtimeWork:boolean}),overlayTextureUrl:string,authority:string});
export type RingMotionPoint = [number,number,number,string,number,boolean];
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {textureTintFactors} from '@layoutit/polycss';
import {parseRadialLayerRecipe} from '../giant-layers/index.mts';
import {sampleRadialProfile,rasterObservedRadialField, loadObservedProfile} from '../giant-layers/rings.mts';
import {verifyObservationSources} from '../observed-surfaces/index.mts';
import {cropTransparentRgba,responsiveTransparentCrop} from './rgba.mts';
import {normalizeVector,rotateX as rotateVectorX,rotateZ as rotateVectorZ} from './ellipsoid.mts';
/** Observed radial-profile sampling, seeded density tracers and ellipsoid penumbra. */
export async function prepareRadialMotionAndShadow({sourceDirectory,publicDirectory,config: input,radialRecipe: radialInput}: {sourceDirectory: string; publicDirectory: string; config: unknown; radialRecipe: unknown}) {
 const config = parse(input, radialMotionRecipe, 'radial motion recipe');
 if(config?.schema!=='cssearth-radial-motion-shadow@1')throw new TypeError('Invalid radial motion recipe.');
 const radialRecipe = parseRadialLayerRecipe(radialInput);
 const shadowModel = parse(config.shadowModel[config.fields.bodyOnRings], bodyRingShadow, 'body-on-rings shadow');
 const inputs=await verifyObservationSources(sourceDirectory,radialRecipe.sources);
 const layer=radialRecipe.layers.find(layer=>layer.kind==='observed-radial-profile');
 if(!layer)throw new TypeError('Radial motion requires an observed profile.');
 const profile=await loadObservedProfile(layer,inputs);
 const preparedRingSample=(radius: number)=>{const[red,green,blue,alpha]=sampleRadialProfile(radius,layer,profile);return{red,green,blue,alpha};};
 const publicRoot=publicDirectory;
 await mkdir(publicRoot,{recursive:true});
const MAIN_RING_MOTION_TEXTURE_SIZE = config.parameters.mainRingMotionTextureSize;
const MAIN_RING_RASTERIZED_BANDS = config.parameters.mainRingRasterizedBands;
const MAIN_RING_MOTION_TRANSPARENT_GUTTER = config.parameters.mainRingMotionTransparentGutter;
const MAIN_RING_POINT_SOURCE_OPACITY_RANGE = config.parameters.mainRingPointSourceOpacityRange;
const MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE = config.parameters.mainRingPointPresentationOpacityRange;
const BODY_GM_KM3_PER_S2 = config.parameters.bodyGmKm3PerS2;
const BODY_REFERENCE_ROTATION_SECONDS = config.parameters.bodyReferenceRotationSeconds;
const PRESENTATION_REFERENCE_ROTATION_SECONDS = config.parameters.presentationReferenceRotationSeconds;
const BODY_EQUATORIAL_RADIUS_KM = config.parameters.bodyEquatorialRadiusKm;
const BODY_POLAR_RADIUS_KM = config.parameters.bodyPolarRadiusKm;
const DISPLAY_EQUATORIAL_RADIUS = config.parameters.displayEquatorialRadius;
const F_RING_OUTER_KM = config.parameters.fRingOuterKm;
const MAIN_RING_INVERTED_LUMINANCE_THRESHOLD = config.parameters.mainRingInvertedLuminanceThreshold;
const MAIN_RING_MAX_TRACER_INTENSITY = config.parameters.mainRingMaxTracerIntensity;
const MAIN_RING_MOTION_FORMATIONS = config.parameters.mainRingMotionFormations;
const MAIN_RING_MOTION_BANDS = config.parameters.mainRingMotionBands;
const STATIC_WORLD_LIGHT_DIRECTION = config.parameters.staticWorldLightDirection;
const BODY_OBLIQUITY_DEGREES = config.parameters.bodyObliquityDegrees;
const STATIC_SYSTEM_TILT_AXIS = config.parameters.staticSystemTiltAxis;
const STATIC_SYSTEM_NODE_DEGREES = config.parameters.staticSystemNodeDegrees;
const STATIC_MESH_ROTATION_DEGREES = config.parameters.staticMeshRotationDegrees;
const BODY_SHADOW_RING_DIRECT_TRANSMISSION = config.parameters.bodyShadowRingDirectTransmission;
const BODY_SHADOW_DENSE_ALPHA_START = config.parameters.bodyShadowDenseAlphaStart;
const BODY_SHADOW_DENSE_ALPHA_END = config.parameters.bodyShadowDenseAlphaEnd;
const BODY_SHADOW_EDGE_FEATHER_SIGMA = config.parameters.bodyShadowEdgeFeatherSigma;
const BODY_SHADOW_RING_SUPPORT_ALPHA = config.parameters.bodyShadowRingSupportAlpha;
const RING_SHADOW_TEXTURE_SIZE = config.parameters.ringShadowTextureSize;
const RING_SHADOW_TRANSPARENT_GUTTER = config.parameters.ringShadowTransparentGutter;
const BODY_SOLAR_ALBEDO_MULTIPLIER = config.parameters.bodySolarAlbedoMultiplier;

const PRESENTATION_TIME_SCALE=BODY_REFERENCE_ROTATION_SECONDS/PRESENTATION_REFERENCE_ROTATION_SECONDS;
const STATIC_OBJECT_LIGHT_DIRECTION=Object.freeze(rotateVectorZ(rotateVectorX(rotateVectorZ(normalizeVector(STATIC_WORLD_LIGHT_DIRECTION),-STATIC_SYSTEM_NODE_DEGREES*Math.PI/180),-BODY_OBLIQUITY_DEGREES*Math.PI/180),-STATIC_MESH_ROTATION_DEGREES*Math.PI/180));
const ringSolarTint=textureTintFactors(Math.PI,BODY_SOLAR_ALBEDO_MULTIPLIER,BODY_SOLAR_ALBEDO_MULTIPLIER,0.05*Math.PI);
const ringSolarMaximum=Math.max(ringSolarTint.r,ringSolarTint.g,ringSolarTint.b);
const RING_SOLAR_CHANNEL_FACTORS=[ringSolarTint.r/ringSolarMaximum,ringSolarTint.g/ringSolarMaximum,ringSolarTint.b/ringSolarMaximum];
const RING_SOLAR_WHITE=RING_SOLAR_CHANNEL_FACTORS.map(factor=>applyLinearTint(255,factor));
const mainRingMotionGroups=MAIN_RING_MOTION_BANDS.map(prepareMainRingMotionGroup);
const plates=mainRingMotionGroups.filter(group=>MAIN_RING_RASTERIZED_BANDS.includes(group.population.replace('main-ring-',''))).map(prepareMainRingMotionPlate);
const raw=rasterObservedRadialField(layer,layer.size,layer.readability.minimumPixels[1],profile);
const shadow=createBodyShadowOverlay(RING_SHADOW_TEXTURE_SIZE);
const feathered=await featherBodyShadowOverlay({shadowRgba:shadow.rgba,shadowTextureSize:RING_SHADOW_TEXTURE_SIZE,ringRgba:raw,ringTextureSize:layer.size});
const cropped=cropTransparentRgba({rgba:feathered,width:RING_SHADOW_TEXTURE_SIZE,height:RING_SHADOW_TEXTURE_SIZE,gutter:RING_SHADOW_TRANSPARENT_GUTTER});
await Promise.all([writePreparedRgbaWebp(cropped.rgba,cropped.bounds.width,resolve(publicRoot,config.shadow.filename),cropped.bounds.height),...plates.flatMap(plate=>[writePreparedRgbaWebp(plate.rgba,plate.textureWidth,plate.outputPath,plate.textureHeight),writePreparedRgbaWebp(plate.rgba2x,plate.texture2xWidth,plate.output2xPath,plate.texture2xHeight)])]);
const bodyOnRings={...shadowModel,directTransmission:BODY_SHADOW_RING_DIRECT_TRANSMISSION,shadowedPixelCount:shadow.shadowedPixelCount,meanCoverage:shadow.meanCoverage,denseAlphaRamp:[BODY_SHADOW_DENSE_ALPHA_START,BODY_SHADOW_DENSE_ALPHA_END],edgeFeather:{...shadowModel.edgeFeather,sigmaTexturePixels:BODY_SHADOW_EDGE_FEATHER_SIGMA,ringSupportAlpha:BODY_SHADOW_RING_SUPPORT_ALPHA}};
const ringSource={pointCount:MAIN_RING_MOTION_BANDS.reduce((count,band)=>count+band.count,0),textureSize:layer.size,texture2xSize:layer.size*2,shadowTextureSourceSize:RING_SHADOW_TEXTURE_SIZE,shadowTextureBounds:cropped.bounds,shadowTextureTransparentGutter:RING_SHADOW_TRANSPARENT_GUTTER,planeVisualOrbitSeconds:visualOrbitSeconds(F_RING_OUTER_KM),[config.fields.gravitationalParameter]:BODY_GM_KM3_PER_S2,shadowModel:{...config.shadowModel,worldLightDirection:STATIC_WORLD_LIGHT_DIRECTION,objectLightDirection:STATIC_OBJECT_LIGHT_DIRECTION,systemTiltDegrees:BODY_OBLIQUITY_DEGREES,systemNodeDegrees:STATIC_SYSTEM_NODE_DEGREES,meshRotationDegrees:STATIC_MESH_ROTATION_DEGREES,[config.fields.bodyOnRings]:bodyOnRings}};
return {ringSource,ringPlates:plates.map(plate=>plate.metadata),ringGroups:[]};
function createBodyShadowOverlay(textureSize: number) {
  const center = (textureSize - 1) / 2;
  const sampleOffsets = config.shadow.sampleOffsets;
  const shadowRgba = Buffer.alloc(textureSize * textureSize * 4);
  let shadowedPixelCount = 0;
  let coverageTotal = 0;
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const offset = (y * textureSize + x) * 4;
      const centerXKm = (x - center) / center * F_RING_OUTER_KM;
      const centerYKm = (y - center) / center * F_RING_OUTER_KM;
      const ringAlpha = preparedRingSample(
        Math.hypot(centerXKm, centerYKm)).alpha / 255;
      if (ringAlpha === 0) continue;
      let occludedSamples = 0;
      for (const offsetY of sampleOffsets) {
        for (const offsetX of sampleOffsets) {
          const ringXKm = (x + offsetX - center) / center * F_RING_OUTER_KM;
          const ringYKm = (y + offsetY - center) / center * F_RING_OUTER_KM;
          if (rayIntersectsBody([ringXKm, ringYKm, 0], STATIC_OBJECT_LIGHT_DIRECTION)) {
            occludedSamples += 1;
          }
        }
      }
      const coverage = occludedSamples / 4;
      if (coverage === 0) continue;
      const denseRingWeight = smoothstep(
        BODY_SHADOW_DENSE_ALPHA_START,
        BODY_SHADOW_DENSE_ALPHA_END,
        ringAlpha,
      );
      const overlayAlpha = coverage *
        (1 - BODY_SHADOW_RING_DIRECT_TRANSMISSION) *
        denseRingWeight * ringAlpha * ringAlpha;
      if (overlayAlpha <= 1 / 255) continue;
      shadowRgba[offset] = 0;
      shadowRgba[offset + 1] = 0;
      shadowRgba[offset + 2] = 0;
      shadowRgba[offset + 3] = Math.round(overlayAlpha * 255);
      shadowedPixelCount += 1;
      coverageTotal += coverage;
    }
  }
  return {
    rgba: shadowRgba,
    shadowedPixelCount,
    meanCoverage: Number((coverageTotal / Math.max(1, shadowedPixelCount)).toFixed(6)),
  };
}

async function featherBodyShadowOverlay({
  shadowRgba,
  shadowTextureSize,
  ringRgba,
  ringTextureSize,
}: {shadowRgba: Buffer; shadowTextureSize: number; ringRgba: Buffer; ringTextureSize: number}) {
  const blurredAlpha = await sharp(shadowRgba, {
    raw: {
      width: shadowTextureSize,
      height: shadowTextureSize,
      channels: 4,
    },
  })
    .extractChannel(3)
    .blur(BODY_SHADOW_EDGE_FEATHER_SIGMA)
    .raw()
    .toBuffer();
  const ringAlpha = await sharp(ringRgba, {
    raw: {
      width: ringTextureSize,
      height: ringTextureSize,
      channels: 4,
    },
  })
    .resize(shadowTextureSize, shadowTextureSize, { kernel: "lanczos3" })
    .extractChannel(3)
    .raw()
    .toBuffer();
  const featheredRgba = Buffer.alloc(shadowRgba.byteLength);
  for (let pixel = 0; pixel < blurredAlpha.length; pixel += 1) {
    const ringSupport = Math.min(
      1,
      ringAlpha[pixel] / BODY_SHADOW_RING_SUPPORT_ALPHA,
    );
    featheredRgba[pixel * 4 + 3] = Math.round(
      blurredAlpha[pixel] * ringSupport,
    );
  }
  return featheredRgba;
}

function rayIntersectsBody([x, y, z]: ReadonlyVector3, [dx, dy, dz]: ReadonlyVector3) {
  const equatorialSquared = BODY_EQUATORIAL_RADIUS_KM ** 2;
  const polarSquared = BODY_POLAR_RADIUS_KM ** 2;
  const a = (dx * dx + dy * dy) / equatorialSquared + dz * dz / polarSquared;
  const b = 2 * ((x * dx + y * dy) / equatorialSquared + z * dz / polarSquared);
  const c = (x * x + y * y) / equatorialSquared + z * z / polarSquared - 1;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  const root = Math.sqrt(discriminant);
  return (-b - root) / (2 * a) > 0 || (-b + root) / (2 * a) > 0;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function prepareMainRingMotionGroup(band: RadialMotionRecipe['parameters']['mainRingMotionBands'][number], bandIndex: number) {
  const bandRandom = mulberry32(
    (config.motion.seed ^ Math.imul(bandIndex + 1, config.motion.bandSeedMultiplier)) >>> 0,
  );
  const formation = MAIN_RING_MOTION_FORMATIONS[band.id];
  const formationPointCount = Math.round(band.count * formation.share);
  const points: RingMotionPoint[] = [];
  let radiusTotalKm = 0;
  let attempts = 0;
  while (points.length < band.count) {
    attempts += 1;
    if (attempts > band.count * config.motion.maximumAttemptsPerPoint) {
      throw new Error(`Could not prepare Body ${band.id} motion samples.`);
    }
    const radiusKm = mix(band.boundsKm[0], band.boundsKm[1], bandRandom());
    const sample = preparedRingSample(radiusKm);
    const density = sample.alpha / 255;
    const compositeIntensity = ringCompositeIntensity(sample);
    if (compositeIntensity > MAIN_RING_MAX_TRACER_INTENSITY) continue;
    const visibilityWeight = Math.pow(density, config.motion.densityExponent) *
      mix(1, config.motion.brightVisibilityFloor, compositeIntensity);
    if (bandRandom() > visibilityWeight) continue;
    const inFormation = points.length < formationPointCount;
    const normalizedRadius = (radiusKm - band.boundsKm[0]) /
      (band.boundsKm[1] - band.boundsKm[0]);
    const formationCenter = inFormation
      ? formation.centersRadians[points.length % formation.centersRadians.length]
      : 0;
    const angle = inFormation
      ? formationCenter +
        (normalizedRadius - 0.5) * formation.radialShearRadians +
        normalishRandomWith(bandRandom) * formation.spreadRadians
      : bandRandom() * Math.PI * 2;
    const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
      radiusKm / BODY_EQUATORIAL_RADIUS_KM;
    const inverted = compositeIntensity >=
      MAIN_RING_INVERTED_LUMINANCE_THRESHOLD;
    const baseColor = inverted
      ? [255 - sample.red, 255 - sample.green, 255 - sample.blue]
      : [
          mix(sample.red, RING_SOLAR_WHITE[0], config.motion.whiteMix),
          mix(sample.green, RING_SOLAR_WHITE[1], config.motion.whiteMix),
          mix(sample.blue, RING_SOLAR_WHITE[2], config.motion.whiteMix),
        ];
    const luminanceVariation = mix(...config.motion.luminanceRange, bandRandom());
    const red = Math.min(255, Math.round(
      baseColor[0] * luminanceVariation,
    ));
    const green = Math.min(255, Math.round(
      baseColor[1] * luminanceVariation,
    ));
    const blue = Math.min(255, Math.round(
      baseColor[2] * luminanceVariation,
    ));
    points.push([
      Number((Math.sin(angle) * displayRadius).toFixed(3)),
      Number((Math.cos(angle) * displayRadius).toFixed(3)),
      Number(mix(...config.motion.elevationRange, bandRandom()).toFixed(3)),
      rgbHex(red, green, blue),
      Number(mix(config.motion.opacityMinimum, inFormation ? config.motion.formationOpacityMaximum : config.motion.fieldOpacityMaximum, bandRandom()).toFixed(3)),
      inverted,
    ]);
    radiusTotalKm += radiusKm;
  }
  const representativeRadiusKm = Number(
    (radiusTotalKm / points.length).toFixed(3),
  );
  return {
    population: `main-ring-${band.id}`,
    durationSeconds: visualOrbitSeconds(representativeRadiusKm),
    sourceBoundsKm: band.boundsKm,
    representativeRadiusKm,
    formation: {
      kind: formation.kind,
      pointCount: formationPointCount,
      centersRadians: formation.centersRadians,
      spreadRadians: formation.spreadRadians,
      radialShearRadians: formation.radialShearRadians,
    },
    points,
  };
}

function prepareMainRingMotionPlate(group: ReturnType<typeof prepareMainRingMotionGroup>) {
  const id = group.population.replace("main-ring-", "");
  const filename = `${config.namespace}-ring-motion-${id}.webp`;
  const filename2x = `${config.namespace}-ring-motion-${id}@2x.webp`;
  const displayRadius = DISPLAY_EQUATORIAL_RADIUS *
    group.sourceBoundsKm[1] / BODY_EQUATORIAL_RADIUS_KM;
  const outerDisplayRadius = DISPLAY_EQUATORIAL_RADIUS *
    F_RING_OUTER_KM / BODY_EQUATORIAL_RADIUS_KM;
  const textureSize = Math.ceil(
    MAIN_RING_MOTION_TEXTURE_SIZE * displayRadius / outerDisplayRadius / 64,
  ) * 64;
  const texture2xSize = textureSize * 2;
  const uncroppedRgba = renderMainRingMotionPlate(
    group,
    textureSize,
    displayRadius,
  );
  const uncroppedRgba2x = renderMainRingMotionPlate(
    group,
    texture2xSize,
    displayRadius,
  );
  const crop = responsiveTransparentCrop({
    rgba: uncroppedRgba,
    rgba2x: uncroppedRgba2x,
    textureSize,
    gutter: MAIN_RING_MOTION_TRANSPARENT_GUTTER,
  });
  return {
    outputPath: resolve(publicRoot, filename),
    output2xPath: resolve(publicRoot, filename2x),
    rgba: crop.rgba,
    rgba2x: crop.rgba2x,
    textureSize,
    texture2xSize,
    textureWidth: crop.bounds.width,
    textureHeight: crop.bounds.height,
    texture2xWidth: crop.bounds2x.width,
    texture2xHeight: crop.bounds2x.height,
    metadata: {
      population: group.population,
      pointCount: group.points.length,
      durationSeconds: group.durationSeconds,
      textureUrl: `${config.publicPrefix}${filename}`,
      texture2xUrl: `${config.publicPrefix}${filename2x}`,
      textureSize,
      texture2xSize,
      textureWidth: crop.bounds.width,
      textureHeight: crop.bounds.height,
      texture2xWidth: crop.bounds2x.width,
      texture2xHeight: crop.bounds2x.height,
      textureCropBounds: crop.bounds,
      textureTransparentGutter: MAIN_RING_MOTION_TRANSPARENT_GUTTER,
      displayRadius: Number(displayRadius.toFixed(6)),
      elevation: config.motion.plateElevation,
      sourceBoundsKm: group.sourceBoundsKm,
      formation: group.formation,
      runtimeRasterization: false,
    },
  };
}

function renderMainRingMotionPlate(group: ReturnType<typeof prepareMainRingMotionGroup>, textureSize: number, displayRadius: number) {
  const rgba = Buffer.alloc(textureSize * textureSize * 4);
  const center = (textureSize - 1) / 2;
  const pixelsPerWorldUnit = center / displayRadius;
  const pointRadius = config.motion.pointRadius * pixelsPerWorldUnit;
  for (const [x, y, , color, sourceOpacity, inverted] of group.points) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const opacity = inverted
      ? 0.5
      : prepareMainRingPointOpacity(sourceOpacity);
    drawPreparedDisc(
      rgba,
      textureSize,
      center + x * pixelsPerWorldUnit,
      center + y * pixelsPerWorldUnit,
      pointRadius,
      [red, green, blue],
      opacity,
    );
  }
  return rgba;
}

function drawPreparedDisc(
  rgba: Buffer,
  textureSize: number,
  centerX: number,
  centerY: number,
  radius: number,
  [red, green, blue]: readonly [number,number,number],
  opacity: number,
) {
  const minimumX = Math.max(0, Math.floor(centerX - radius - 1));
  const maximumX = Math.min(textureSize - 1, Math.ceil(centerX + radius + 1));
  const minimumY = Math.max(0, Math.floor(centerY - radius - 1));
  const maximumY = Math.min(textureSize - 1, Math.ceil(centerY + radius + 1));
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      const coverage = Math.max(0, Math.min(1, radius + 0.5 - distance));
      if (coverage === 0) continue;
      const sourceAlpha = opacity * coverage;
      const offset = (y * textureSize + x) * 4;
      const destinationAlpha = rgba[offset + 3] / 255;
      const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
      const destinationAmount = destinationAlpha * (1 - sourceAlpha);
      rgba[offset] = Math.round(
        (red * sourceAlpha + rgba[offset] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 1] = Math.round(
        (green * sourceAlpha + rgba[offset + 1] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 2] = Math.round(
        (blue * sourceAlpha + rgba[offset + 2] * destinationAmount) / outputAlpha,
      );
      rgba[offset + 3] = Math.round(outputAlpha * 255);
    }
  }
}

function prepareMainRingPointOpacity(sourceOpacity: number) {
  const [sourceMinimum, sourceMaximum] = MAIN_RING_POINT_SOURCE_OPACITY_RANGE;
  const normalized = Math.max(0, Math.min(1,
    (sourceOpacity - sourceMinimum) / (sourceMaximum - sourceMinimum)));
  return mix(
    MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE[0],
    MAIN_RING_POINT_PRESENTATION_OPACITY_RANGE[1],
    normalized,
  );
}

function writePreparedRgbaWebp(rgba: Buffer, textureWidth: number, outputPath: string,
  textureHeight = textureWidth) {
  return sharp(rgba, {
    raw: { width: textureWidth, height: textureHeight, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}

function normalishRandomWith(randomSource: ()=>number) {
  return randomSource() + randomSource() + randomSource() + randomSource() - 2;
}

function visualOrbitSeconds(radiusKm: number) {
  const realPeriodSeconds = 2 * Math.PI * Math.sqrt(
    Math.pow(radiusKm, 3) / BODY_GM_KM3_PER_S2,
  );
  return Number((realPeriodSeconds / PRESENTATION_TIME_SCALE).toFixed(3));
}

function rgbHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map(
    (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function mix(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000;
  };
}

function ringCompositeIntensity({ red, green, blue, alpha }: {red: number; green: number; blue: number; alpha: number}) {
  return alpha / 255 * (
    0.2126 * red + 0.7152 * green + 0.0722 * blue
  ) / 255;
}
}
