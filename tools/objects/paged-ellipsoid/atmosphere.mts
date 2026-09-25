import type {SourceManifest} from '../../../src/platform/source-manifest.mts';
import type {PreparedDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {viewSunDirectionToPreparedLightDirection} from '../../../src/platform/directional-sun-coordinate.mts';
import {requireFiniteNumber, requireRecord} from '@cssearth/core';
import {readAtmosphereModel as parseAtmosphereModelRecord} from '@cssearth/objects';
import {limbFactors, limbOverlay, loadLimbLaw, parseLimbBlock, scatteringAngles, silhouetteColourWeight, type Channels, type LimbBlock} from '../../photometry/limb.mts';
import {compositePreparedAtmosphere, prepareAtmosphereFrame, type PreparedAtmosphereProfile} from '../../prepared/prepared-atmosphere.mts';
import {readJsonSource} from '../../sources/source-values.mts';
import {applyDisplayGamma} from './display-tone.mts';
import {parseAtmosphereResponse} from './source-contract.mts';

export interface AtmosphereConfiguration {
  material: {tileSize: number; presentationSize: number; framesPerShard: number; discRadius: number;
    illumination: {frameCount: number; minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number}};
  /** The atmosphere drawn over the lit disc and around it: the model record (Rayleigh and Mie, adapted from OpenSpace) and
   * the Google Earth Pro response that sets its display transfer, as on main before the limb laws. */
  atmosphere: {sourcePath: string; responsePath: string; sourceId: string; maximumOpacityKey: string};
  /** The published models the disc is lit with; `reference` names the default map, shown through `referenceDisplayGamma`. */
  limb: LimbBlock & {referenceDisplayGamma: number};
}

/**
 * Earth's lighting and atmosphere inputs: the measured limb law with the overlay's reference colour, and the atmosphere
 * model with its display response. The atmosphere bank's image holds both, the lit disc with the atmosphere over and
 * around it, so one image shows the planet; the lighting bank (assets.mts) holds the disc alone and shows only with the
 * atmosphere turned off.
 */
export function createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun, polarToEquatorial }: {config: AtmosphereConfiguration; sourceDirectory: string; sourceManifest: SourceManifest; sun: Pick<PreparedDirectionalSunPlan, "referenceViewDirection">; polarToEquatorial: number}) {
const MATERIAL_TILE_SIZE = config.material.tileSize;
const MATERIAL_PRESENTATION_SIZE = config.material.presentationSize;
const MATERIAL_FRAMES_PER_SHARD = config.material.framesPerShard;

async function readAtmosphereModel() {
  const limb = parseLimbBlock({ models: config.limb.models, reference: config.limb.reference }, 'paged ellipsoid limb');
  for (const path of [config.atmosphere.sourcePath, config.atmosphere.responsePath, ...limb.models, limb.reference!])
    if (!sourceManifest.inputs.some(input => input.path === path) && !sourceManifest.documents?.some(document => document.path === path))
      throw new Error(`Earth atmosphere: ${path} is not declared in source/manifest.json.`);
  if (!sourceManifest.inputs.some(({ id }) => id === config.atmosphere.sourceId))
    throw new Error(`Earth atmosphere: source id ${config.atmosphere.sourceId} is not declared in source/manifest.json.`);
  const [law, reference, text, response] = await Promise.all([
    loadLimbLaw(sourceDirectory, limb.models),
    displayedMeanColour(resolve(sourceDirectory, limb.reference!), config.limb.referenceDisplayGamma),
    readFile(resolve(sourceDirectory, config.atmosphere.sourcePath), 'utf8'),
    readJsonSource(resolve(sourceDirectory, config.atmosphere.responsePath)).then(parseAtmosphereResponse),
  ]);
  if (response.schema !== 'cssearth-google-earth-pro-atmosphere-presentation-response@1' || response.observedResponse.exposure !== 0.2 ||
      response.observedResponse.exposureRole !== 'camera-response-not-body-irradiance' || response.cleanRoomTransfer.bodySunIntensitySource !== 'body-atmosphere-model')
    throw new Error(`Earth atmosphere: ${config.atmosphere.responsePath} is incompatible (schema ${response.schema}, exposure ${response.observedResponse.exposure}).`);
  const record = parseAtmosphereModelRecord(JSON.parse(text));
  const profile: PreparedAtmosphereProfile = {
    radiusKm: record.planetRadiusKm, heightKm: record.atmosphereHeightKm,
    layers: [
      { phase: 'rayleigh', weight: 1, scatteringPerKm: channels(record.rayleigh.scatteringPerKm), scaleHeightKm: record.rayleigh.scaleHeightKm },
      { phase: 'mie', weight: response.cleanRoomTransfer.mieContribution, scatteringPerKm: channels(record.mie.scatteringPerKm), scaleHeightKm: record.mie.scaleHeightKm, anisotropy: record.mie.phaseG },
    ],
    transfer: { mode: 'scattering-rgb', intensity: record.sunIntensity, exposure: response.observedResponse.exposure, alphaScale: response.observedResponse.skyAlphaLuminanceScale,
      maximumAlpha: requireFiniteNumber(requireRecord(response.cleanRoomTransfer)[config.atmosphere.maximumOpacityKey], 'Earth atmosphere opacity'), limbConcentration: true },
  };
  return Object.freeze({
    schema: 'cssearth-limb-law-under-model-atmosphere@1', law, reference, referenceSource: `${limb.reference} (display gamma ${config.limb.referenceDisplayGamma})`,
    atmosphereSource: config.atmosphere.sourceId, profile, outerRadiusRatio: (record.planetRadiusKm + record.atmosphereHeightKm) / record.planetRadiusKm,
  });
}

function channels(values: readonly number[]): [number, number, number] {
  if (values.length !== 3 || values.some(value => !Number.isFinite(value))) throw new Error(`Earth atmosphere: RGB coefficients ${JSON.stringify(values)} are invalid.`);
  return [values[0], values[1], values[2]];
}

/** Mean colour of the default map as displayed: the lane's display gamma applied, archive black left out. */
async function displayedMeanColour(path: string, gamma: number): Promise<Channels<number>> {
  const { data, info } = await sharp(await readFile(path)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  applyDisplayGamma(data, gamma);
  const sum = [0, 0, 0]; let count = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (!data[offset] && !data[offset + 1] && !data[offset + 2]) continue;
    sum[0] += data[offset]; sum[1] += data[offset + 1]; sum[2] += data[offset + 2]; count++;
  }
  if (!count) throw new Error(`${path} has no observed pixel to take a reference colour from.`);
  return [0, 1, 2].map(channel => Math.round(sum[channel] / count * 1000) / 1000) as unknown as Channels<number>;
}

const ATMOSPHERE_ILLUMINATION = config.material.illumination;
const ATMOSPHERE_DEFAULT_FRAME = Math.round(
  (1 + viewSunDirectionToPreparedLightDirection(sun.referenceViewDirection)[2]) / 2 *
    (ATMOSPHERE_ILLUMINATION.frameCount - 1));

/** What the scene records about the disc law and the atmosphere; nothing here is read at runtime. */
function atmosphereProfile(model: Awaited<ReturnType<typeof readAtmosphereModel>>) {
  return { ...model.profile, source: model.atmosphereSource, limb: { models: model.law.paths, referenceColor: model.reference, referenceSource: model.referenceSource } };
}

/**
 * One atmosphere frame: the disc lit by the measured law, with the model atmosphere composited over and around it (the
 * frame main drew). The plane spans the atmosphere's top; at a flattening of 0.3% the disc is drawn as a sphere, and its
 * colour fades out where the mesh may not reach.
 */
function prepareAtmosphereMaterialFrame({ size, frame = ATMOSPHERE_DEFAULT_FRAME, model }: {size: number; frame?: number; model: Awaited<ReturnType<typeof readAtmosphereModel>>}) {
  const z = -1 + 2 * frame / (ATMOSPHERE_ILLUMINATION.frameCount - 1);
  if (!Number.isInteger(frame) || Math.abs(z) > 1) throw new RangeError(`Invalid Earth atmosphere frame ${frame}.`);
  const light = [Math.sqrt(Math.max(0, 1 - z * z)), 0, z], view = [0, 0, 1], radius = size * config.material.discRadius / model.outerRadiusRatio;
  const data = Buffer.alloc(size * size * 4), centre = size / 2, samples = 2, floor = 0.5 / radius;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const dx = (x + (sx + 0.5) / samples - centre) / radius, dy = (y + (sy + 0.5) / samples - centre) / radius, r = Math.hypot(dx, dy);
      if (r > 1) continue;
      const { incidence, emission, phase } = scatteringAngles([dx, dy, Math.sqrt(Math.max(0, 1 - r * r))], light, view, floor);
      const [red, green, blue, alpha] = limbOverlay(limbFactors(model.law, incidence, emission, phase), model.reference), keep = silhouetteColourWeight(r, polarToEquatorial);
      const colour = [red * keep, green * keep, blue * keep];
      for (let channel = 0; channel < 3; channel++) sum[channel] += colour[channel] * alpha;
      sum[3] += alpha;
    }
    if (sum[3] <= 0) continue;
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.round(sum[channel] / sum[3]);
    data[offset + 3] = Math.round(sum[3] / (samples * samples) * 255);
  }
  const atmosphere = prepareAtmosphereFrame({ width: size, disc: { centerX: centre, centerY: centre, radiusX: radius, radiusY: radius },
    profile: model.profile, lightDirection: [light[0], light[1], light[2]] });
  compositePreparedAtmosphere(data, atmosphere.data);
  return { data, width: size, height: size };
}

return { readAtmosphereModel, atmosphereProfile, prepareAtmosphereMaterialFrame, MATERIAL_TILE_SIZE, MATERIAL_PRESENTATION_SIZE, MATERIAL_FRAMES_PER_SHARD, ATMOSPHERE_ILLUMINATION, ATMOSPHERE_DEFAULT_FRAME };
}
