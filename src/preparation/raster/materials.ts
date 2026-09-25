import { RASTER_DENSITY, type AtmosphereRecipe } from './config.js';
import { raster, assetPath } from './io.js';
import { limbFactors, limbOverlay, scatteringAngles, silhouetteColourWeight, srgbToLinear, linearToSrgb } from '../../../tools/photometry/limb.mts';
import { loadLimbProfile, haloRatio, type LimbProfile } from '../../../tools/photometry/halo.mts';
import type { PreparedLimb } from '../../renderers/css/preparation/materials/lighting.js';

/**
 * A body with an atmosphere, frame by frame: the disc lit by the body's published photometric models and, outside it,
 * the halo from its PSG limb profile when the recipe names one, lit where the tangent point faces the Sun
 * (tools/photometry). Three atlases share the frames:
 * - material: disc law and halo, drawn over the visible map;
 * - observation: the same, drawn over the false-colour lenses. The disc law of Venus and Mars is grey or nearly so
 *   (tools/photometry/limb.mts), so it does not tint their false colours;
 * - lighting: the disc law alone.
 * The last frame is the shadowless flood frame (light along the view).
 */
export async function prepareAtmosphere(recipe: AtmosphereRecipe, sourceDirectory: string, publicDirectory: string, limb: PreparedLimb) {
    const table = recipe.halo === undefined ? null : await loadLimbProfile(sourceDirectory, recipe.halo);
    const density = RASTER_DENSITY, tileSize = recipe.tileSize * density, width = tileSize * recipe.columns, height = tileSize * recipe.rows;
    const material = new Uint8Array(width * height * 4), observation = new Uint8Array(width * height * 4), lighting = new Uint8Array(width * height * 4);
    const edgeRadiusKm = table ? table.radiusKm + recipe.haloEdgeAltitudeKm! : 0;
    let outermost = 1;
    for (let frame = 0; frame < recipe.frameCount; frame++) {
        const flood = frame === recipe.frameCount - 1;
        const z = flood ? 1 : recipe.minimumLightViewZ + (recipe.maximumLightViewZ - recipe.minimumLightViewZ) * frame / (recipe.directionalFrameCount - 1);
        const light = flood ? [0, 0, 1] : [-Math.sqrt(Math.max(0, 1 - z * z)), 0, z];
        const frameX = frame % recipe.columns * tileSize, frameY = Math.floor(frame / recipe.columns) * tileSize;
        outermost = Math.max(outermost, writeFrame({ material, observation, lighting, width, tileSize, frameX, frameY, light, recipe, limb, table, edgeRadiusKm }));
    }
    await raster(material, width, height).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.materialOutput, density));
    await raster(observation, width, height).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.observationOutput, density));
    await raster(lighting, width, height).resize(width / 2, height / 2, { fit: 'fill', kernel: 'lanczos3' }).webp({ lossless: true, effort: 6 }).toFile(assetPath(publicDirectory, recipe.lightingOutput, density));
    return {
        limb: { model: 'published-photometric-models-relative-to-the-flood-lit-disc-centre', models: limb.law.paths, referenceColor: limb.reference, referenceSource: limb.referenceSource },
        halo: table ? { model: 'nasa-psg-full-phase-limb-profile-single-scattering-day-side', table: recipe.halo!, radiusKm: table.radiusKm, edgeAltitudeKm: recipe.haloEdgeAltitudeKm!, topAltitudeKm: table.altitudesKm[table.altitudesKm.length - 1], outerRadiusScale: Math.round(outermost * 1e6) / 1e6 } : null,
    };
}

interface FrameOptions {
    material: Uint8Array; observation: Uint8Array; lighting: Uint8Array; width: number; tileSize: number; frameX: number; frameY: number;
    light: readonly number[]; recipe: AtmosphereRecipe; limb: PreparedLimb; table: LimbProfile | null; edgeRadiusKm: number;
}

/** Writes one frame of the three atlases; returns the largest display radius, in body radii, that received halo light. */
function writeFrame({ material, observation, lighting, width, tileSize, frameX, frameY, light, recipe, limb, table, edgeRadiusKm }: FrameOptions) {
    const bodyRadius = recipe.bodyRadius * tileSize / recipe.logicalSize, samples = recipe.supersampling, count = samples * samples;
    const emissionFloor = 0.5 / bodyRadius, view = [0, 0, 1], referenceLinear = limb.reference.map(srgbToLinear);
    let outermost = 1;
    for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
        const sums = [new Float64Array(4), new Float64Array(4), new Float64Array(4)];
        const add = (target: Float64Array, [r, g, b, a]: readonly number[]) => { target[0] += r * a; target[1] += g * a; target[2] += b * a; target[3] += a; };
        for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
            const screenX = (x + (sx + 0.5) / samples - tileSize / 2) / bodyRadius, screenY = (y + (sy + 0.5) / samples - tileSize / 2) / bodyRadius;
            const radius = Math.hypot(screenX, screenY);
            if (radius <= recipe.coverageScale) {
                let materialX = screenX / recipe.contentScale, materialY = screenY / recipe.contentScale;
                const materialRadius = Math.hypot(materialX, materialY);
                if (materialRadius > 1) { materialX /= materialRadius; materialY /= materialRadius; }
                const normal = [materialX, materialY, Math.sqrt(Math.max(0, 1 - Math.min(1, materialRadius) ** 2))];
                const { incidence, emission, phase } = scatteringAngles(normal, light, view, emissionFloor);
                const [r, g, b, a] = limbOverlay(limbFactors(limb.law, incidence, emission, phase), limb.reference);
                // Where the mesh may not reach, the overlay only darkens, so no colour outlines the planet.
                const keep = silhouetteColourWeight(radius, limb.polarToEquatorial), disc = [r * keep, g * keep, b * keep, a];
                add(sums[0], disc); add(sums[1], disc); add(sums[2], disc);
                continue;
            }
            // The tangent point's outward direction lies in the image plane; it is sunlit when that direction faces the light.
            if (!table || (screenX * light[0] + screenY * light[1]) / radius < 0) continue;
            const ratio = haloRatio(table, recipe.haloEdgeAltitudeKm! + (radius - 1) * edgeRadiusKm);
            const desired = ratio.map((value, channel) => Math.max(0, Math.min(255, linearToSrgb(Math.min(1, referenceLinear[channel] * value)))));
            const alpha = Math.max(...desired) / 255;
            if (alpha <= 0) continue;
            if (alpha * 255 >= 0.5) outermost = Math.max(outermost, radius);
            const halo = [desired[0] / alpha, desired[1] / alpha, desired[2] / alpha, alpha];
            add(sums[0], halo); add(sums[1], halo);
        }
        const offset = ((frameY + y) * width + frameX + x) * 4;
        [material, observation, lighting].forEach((atlas, index) => {
            const sum = sums[index];
            if (sum[3] <= 0) return;
            for (let channel = 0; channel < 3; channel++) atlas[offset + channel] = Math.round(sum[channel] / sum[3]);
            atlas[offset + 3] = Math.round(sum[3] / count * 255);
        });
    }
    return outermost;
}
