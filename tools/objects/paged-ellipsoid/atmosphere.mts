import type {SourceManifest} from '../../../src/platform/source-manifest.mts';
import type {PreparedDirectionalSunPlan} from '../../../src/platform/directional-sun-contract.mts';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {viewSunDirectionToPreparedLightDirection} from '../../../src/platform/directional-sun-coordinate.mts';
import {limbFactors, limbOverlay, loadLimbLaw, linearToSrgb, parseLimbBlock, scatteringAngles, silhouetteColourWeight, srgbToLinear, type Channels, type LimbBlock} from '../../photometry/limb.mts';
import {haloRatio, loadLimbProfile} from '../../photometry/halo.mts';
import {applyDisplayGamma} from './display-tone.mts';

export interface AtmosphereConfiguration {
  material: {tileSize: number; presentationSize: number; framesPerShard: number; discRadius: number;
    illumination: {frameCount: number; minimumLightViewZ: number; maximumLightViewZ: number; baseLightAzimuthDegrees: number}};
  /** The PSG limb profile the halo is read from (tools/photometry/halo.mts). */
  atmosphere: {halo: string};
  /** The published models the disc is lit with; `reference` names the default map, shown through `referenceDisplayGamma`. */
  limb: LimbBlock & {referenceDisplayGamma: number};
}

/**
 * Earth's lighting and halo inputs: the published limb law with the overlay's reference colour, and the PSG limb
 * profile. The atmosphere bank's image holds both, the lit disc and the halo around it, so one image shows the planet;
 * the lighting bank (assets.mts) holds the disc alone and shows only with the atmosphere turned off.
 */
export function createAtmospherePreparation({ config, sourceDirectory, sourceManifest, sun, polarToEquatorial }: {config: AtmosphereConfiguration; sourceDirectory: string; sourceManifest: SourceManifest; sun: Pick<PreparedDirectionalSunPlan, "referenceViewDirection">; polarToEquatorial: number}) {
const MATERIAL_TILE_SIZE = config.material.tileSize;
const MATERIAL_PRESENTATION_SIZE = config.material.presentationSize;
const MATERIAL_FRAMES_PER_SHARD = config.material.framesPerShard;

async function readAtmosphereModel() {
  const limb = parseLimbBlock({ models: config.limb.models, reference: config.limb.reference }, 'paged ellipsoid limb');
  for (const path of [config.atmosphere.halo, ...limb.models, limb.reference!])
    if (!sourceManifest.inputs.some(input => input.path === path) && !sourceManifest.documents?.some(document => document.path === path))
      throw new Error(`Earth atmosphere: ${path} is not declared in source/manifest.json.`);
  const [law, profile, reference] = await Promise.all([
    loadLimbLaw(sourceDirectory, limb.models),
    loadLimbProfile(sourceDirectory, config.atmosphere.halo),
    displayedMeanColour(resolve(sourceDirectory, limb.reference!), config.limb.referenceDisplayGamma),
  ]);
  const topAltitudeKm = profile.altitudesKm[profile.altitudesKm.length - 1];
  return Object.freeze({
    schema: 'cssearth-limb-and-halo@1', halo: config.atmosphere.halo, profile, law, reference, referenceSource: `${limb.reference} (display gamma ${config.limb.referenceDisplayGamma})`,
    planetRadiusKm: profile.radiusKm, atmosphereHeightKm: topAltitudeKm, outerRadiusRatio: (profile.radiusKm + topAltitudeKm) / profile.radiusKm,
  });
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

/** What the scene records about the halo; nothing here is read at runtime. */
function atmosphereProfile(model: Awaited<ReturnType<typeof readAtmosphereModel>>) {
  return { model: 'nasa-psg-full-phase-limb-profile-single-scattering-day-side', table: model.halo, radiusKm: model.planetRadiusKm,
    topAltitudeKm: model.atmosphereHeightKm, referenceColor: model.reference };
}

/**
 * One atmosphere frame: the disc lit by the published law and, outside it, the PSG profile at the tangent altitude
 * scaled by the disc's reference colour where the tangent point faces the Sun. The plane spans the profile's top
 * altitude; at a flattening of 0.3% the disc is drawn as a sphere, and its colour fades out where the mesh may not reach.
 */
function prepareAtmosphereMaterialFrame({ size, frame = ATMOSPHERE_DEFAULT_FRAME, model }: {size: number; frame?: number; model: Awaited<ReturnType<typeof readAtmosphereModel>>}) {
  const z = -1 + 2 * frame / (ATMOSPHERE_ILLUMINATION.frameCount - 1);
  if (!Number.isInteger(frame) || Math.abs(z) > 1) throw new RangeError(`Invalid Earth atmosphere frame ${frame}.`);
  const light = [Math.sqrt(Math.max(0, 1 - z * z)), 0, z], view = [0, 0, 1], radius = size * config.material.discRadius / model.outerRadiusRatio;
  const data = Buffer.alloc(size * size * 4), centre = size / 2, samples = 2, referenceLinear = model.reference.map(srgbToLinear), floor = 0.5 / radius;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0, 0];
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const dx = (x + (sx + 0.5) / samples - centre) / radius, dy = (y + (sy + 0.5) / samples - centre) / radius, r = Math.hypot(dx, dy);
      let colour: number[], alpha: number;
      if (r <= 1) {
        const { incidence, emission, phase } = scatteringAngles([dx, dy, Math.sqrt(Math.max(0, 1 - r * r))], light, view, floor);
        const [red, green, blue, a] = limbOverlay(limbFactors(model.law, incidence, emission, phase), model.reference), keep = silhouetteColourWeight(r, polarToEquatorial);
        colour = [red * keep, green * keep, blue * keep]; alpha = a;
      } else {
        if ((dx * light[0] + dy * light[1]) / r < 0) continue;
        const desired = haloRatio(model.profile, (r - 1) * model.planetRadiusKm).map((value, channel) => Math.min(255, linearToSrgb(Math.min(1, referenceLinear[channel] * value))));
        alpha = Math.max(...desired) / 255;
        if (alpha <= 0) continue;
        colour = desired.map(value => value / alpha);
      }
      for (let channel = 0; channel < 3; channel++) sum[channel] += colour[channel] * alpha;
      sum[3] += alpha;
    }
    if (sum[3] <= 0) continue;
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 3; channel++) data[offset + channel] = Math.round(sum[channel] / sum[3]);
    data[offset + 3] = Math.round(sum[3] / (samples * samples) * 255);
  }
  return { data, width: size, height: size };
}

return { readAtmosphereModel, atmosphereProfile, prepareAtmosphereMaterialFrame, MATERIAL_TILE_SIZE, MATERIAL_PRESENTATION_SIZE, MATERIAL_FRAMES_PER_SHARD, ATMOSPHERE_ILLUMINATION, ATMOSPHERE_DEFAULT_FRAME };
}
