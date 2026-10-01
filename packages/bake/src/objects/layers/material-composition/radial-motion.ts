import {parse, object, string, boolean} from '@cssearth/core/schema';
import {radialMotionRecipe} from './radial-motion-recipe.ts';
import type {ReadonlyVector3} from '../../geometry/index.ts';
export const bodyRingShadow = object({model:string,edgeFeather:object({model:string,runtimeWork:boolean}),overlayTextureUrl:string,authority:string});
import {readFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {parseRadialLayerRecipe} from '../giant/index.ts';
import {sampleRadialProfile,rasterObservedRadialField, loadObservedProfile} from '../giant/index.ts';
import {verifyObservationSources} from '../observed-surfaces/index.ts';
import {cropTransparentRgba} from './rgba.ts';
import {normalizeVector,rotateX as rotateVectorX,rotateZ as rotateVectorZ} from '../../geometry/index.ts';
/** Observed radial-profile sampling and the ellipsoid penumbra the body casts on the rings. */
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
const BODY_GM_KM3_PER_S2 = config.parameters.bodyGmKm3PerS2;
const BODY_REFERENCE_ROTATION_SECONDS = config.parameters.bodyReferenceRotationSeconds;
const PRESENTATION_REFERENCE_ROTATION_SECONDS = config.parameters.presentationReferenceRotationSeconds;
const BODY_EQUATORIAL_RADIUS_KM = config.parameters.bodyEquatorialRadiusKm;
const BODY_POLAR_RADIUS_KM = config.parameters.bodyPolarRadiusKm;
const F_RING_OUTER_KM = config.parameters.fRingOuterKm;
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

const PRESENTATION_TIME_SCALE=BODY_REFERENCE_ROTATION_SECONDS/PRESENTATION_REFERENCE_ROTATION_SECONDS;
const STATIC_OBJECT_LIGHT_DIRECTION=Object.freeze(rotateVectorZ(rotateVectorX(rotateVectorZ(normalizeVector(STATIC_WORLD_LIGHT_DIRECTION),-STATIC_SYSTEM_NODE_DEGREES*Math.PI/180),-BODY_OBLIQUITY_DEGREES*Math.PI/180),-STATIC_MESH_ROTATION_DEGREES*Math.PI/180));
const raw=rasterObservedRadialField(layer,layer.size,layer.readability.minimumPixels[1],profile);
const shadow=createBodyShadowOverlay(RING_SHADOW_TEXTURE_SIZE);
const feathered=await featherBodyShadowOverlay({shadowRgba:shadow.rgba,shadowTextureSize:RING_SHADOW_TEXTURE_SIZE,ringRgba:raw,ringTextureSize:layer.size});
const cropped=cropTransparentRgba({rgba:feathered,width:RING_SHADOW_TEXTURE_SIZE,height:RING_SHADOW_TEXTURE_SIZE,gutter:RING_SHADOW_TRANSPARENT_GUTTER});
await writePreparedRgbaWebp(cropped.rgba,cropped.bounds.width,resolve(publicRoot,config.shadow.filename),cropped.bounds.height);
const bodyOnRings={...shadowModel,directTransmission:BODY_SHADOW_RING_DIRECT_TRANSMISSION,shadowedPixelCount:shadow.shadowedPixelCount,meanCoverage:shadow.meanCoverage,denseAlphaRamp:[BODY_SHADOW_DENSE_ALPHA_START,BODY_SHADOW_DENSE_ALPHA_END],edgeFeather:{...shadowModel.edgeFeather,sigmaTexturePixels:BODY_SHADOW_EDGE_FEATHER_SIGMA,ringSupportAlpha:BODY_SHADOW_RING_SUPPORT_ALPHA}};
const ringSource={textureSize:layer.size,texture2xSize:layer.size*2,shadowTextureSourceSize:RING_SHADOW_TEXTURE_SIZE,shadowTextureBounds:cropped.bounds,shadowTextureTransparentGutter:RING_SHADOW_TRANSPARENT_GUTTER,planeVisualOrbitSeconds:visualOrbitSeconds(F_RING_OUTER_KM),[config.fields.gravitationalParameter]:BODY_GM_KM3_PER_S2,shadowModel:{...config.shadowModel,worldLightDirection:STATIC_WORLD_LIGHT_DIRECTION,objectLightDirection:STATIC_OBJECT_LIGHT_DIRECTION,systemTiltDegrees:BODY_OBLIQUITY_DEGREES,systemNodeDegrees:STATIC_SYSTEM_NODE_DEGREES,meshRotationDegrees:STATIC_MESH_ROTATION_DEGREES,[config.fields.bodyOnRings]:bodyOnRings}};
return {ringSource};
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

function writePreparedRgbaWebp(rgba: Buffer, textureWidth: number, outputPath: string,
  textureHeight = textureWidth) {
  return sharp(rgba, {
    raw: { width: textureWidth, height: textureHeight, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toFile(outputPath);
}

function visualOrbitSeconds(radiusKm: number) {
  const realPeriodSeconds = 2 * Math.PI * Math.sqrt(
    Math.pow(radiusKm, 3) / BODY_GM_KM3_PER_S2,
  );
  return Number((realPeriodSeconds / PRESENTATION_TIME_SCALE).toFixed(3));
}
}
