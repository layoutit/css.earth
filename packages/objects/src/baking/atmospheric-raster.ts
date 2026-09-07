import type { AtmosphereSource, AtmosphereMaterial } from "./atmosphere.js";
import { dot, mean, smoothStep } from "./math.js";
export interface AtmosphericRasterConfig {
    logicalSize: number;
    bodyRadius: number;
    supersampling: number;
    coverageScale: number;
    contentScale: number;
    sunwardShadowRelease: readonly number[];
    terminator: readonly number[];
}
export interface MaterialFrameOptions {
    material: Uint8Array;
    observation: Uint8Array;
    lighting: Uint8Array;
    atlasWidth: number;
    tileSize: number;
    frameX: number;
    frameY: number;
    lightDirection: readonly number[];
    shadowReleaseMaximum: number;
    source: AtmosphereSource;
    model: AtmosphereMaterial;
    config: AtmosphericRasterConfig;
}
export function prepareMaterialFrame({ material, observation, lighting, atlasWidth, tileSize, frameX, frameY, lightDirection, shadowReleaseMaximum, source, model, config, }: MaterialFrameOptions) {
    const logicalScale = tileSize / config.logicalSize;
    const bodyRadius = config.bodyRadius * logicalScale;
    const sampleCount = config.supersampling ** 2;
    for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
            const combinedPremultiplied = [0, 0, 0];
            const observationPremultiplied = [0, 0, 0];
            const lightingPremultiplied = [0, 0, 0];
            let combinedAlpha = 0;
            let observationAlpha = 0;
            let lightingAlpha = 0;
            for (let sampleY = 0; sampleY < config.supersampling; sampleY += 1) {
                for (let sampleX = 0; sampleX < config.supersampling; sampleX += 1) {
                    const screenX = (x + (sampleX + 0.5) / config.supersampling - tileSize / 2) / bodyRadius;
                    const screenY = (y + (sampleY + 0.5) / config.supersampling - tileSize / 2) / bodyRadius;
                    const sample = prepareMaterialSample(screenX, screenY, lightDirection, shadowReleaseMaximum, source, model, config);
                    combinedAlpha += sample.combined[3];
                    observationAlpha += sample.observation[3];
                    lightingAlpha += sample.lighting[3];
                    for (let channel = 0; channel < 3; channel += 1) {
                        combinedPremultiplied[channel] +=
                            sample.combined[channel] * sample.combined[3];
                        observationPremultiplied[channel] +=
                            sample.observation[channel] * sample.observation[3];
                        lightingPremultiplied[channel] +=
                            sample.lighting[channel] * sample.lighting[3];
                    }
                }
            }
            writeAveragedPixel(material, ((frameY + y) * atlasWidth + frameX + x) * 4, combinedPremultiplied, combinedAlpha, sampleCount);
            writeAveragedPixel(observation, ((frameY + y) * atlasWidth + frameX + x) * 4, observationPremultiplied, observationAlpha, sampleCount);
            writeAveragedPixel(lighting, ((frameY + y) * atlasWidth + frameX + x) * 4, lightingPremultiplied, lightingAlpha, sampleCount);
        }
    }
}
export function prepareMaterialSample(screenX: number, screenY: number, lightDirection: readonly number[], shadowReleaseMaximum: number, source: AtmosphereSource, model: AtmosphereMaterial, config: AtmosphericRasterConfig) {
    const displayRadius = Math.hypot(screenX, screenY);
    if (displayRadius > model.outerRadiusScale) {
        return {
            combined: [0, 0, 0, 0],
            observation: [0, 0, 0, 0],
            lighting: [0, 0, 0, 0],
        };
    }
    const sunResponse = source.sunIntensity / (1 + source.sunIntensity);
    let atmosphereAlpha;
    let lightingAlpha = 0;
    let normal;
    if (displayRadius <= config.coverageScale) {
        let materialX = screenX / config.contentScale;
        let materialY = screenY / config.contentScale;
        const materialRadius = Math.hypot(materialX, materialY);
        if (materialRadius > 1) {
            materialX /= materialRadius;
            materialY /= materialRadius;
        }
        const clampedRadius = Math.min(1, materialRadius);
        const viewAlignment = Math.sqrt(Math.max(0, 1 - clampedRadius * clampedRadius));
        normal = [materialX, materialY, viewAlignment];
        const rawLightAlignment = dot(normal, lightDirection);
        const diffuse = Math.max(0, rawLightAlignment) * smoothStep(config.terminator[0], config.terminator[1], rawLightAlignment);
        const ambient = Math.sqrt(source.averageGroundReflectance);
        lightingAlpha = 1 - (ambient + (1 - ambient) * diffuse);
        const sunward = model.nightFloor +
            (1 - model.nightFloor) * Math.sqrt(Math.max(0, rawLightAlignment));
        atmosphereAlpha = Math.pow(1 - viewAlignment, model.limbExponent) * model.maximumAlpha * sunward * sunResponse;
    }
    else {
        const tangent = displayRadius === 0
            ? [0, 0, 0]
            : [screenX / displayRadius, screenY / displayRadius, 0];
        normal = tangent;
        const lightAlignment = Math.max(0, dot(normal, lightDirection));
        const sunward = model.nightFloor +
            (1 - model.nightFloor) * Math.sqrt(lightAlignment);
        const altitudeKm = (displayRadius - 1) * source.planetRadiusKm;
        const rayleighColumn = source.rayleigh.scatteringPerKm.map((coefficient) => coefficient * Math.sqrt(2 * Math.PI * (source.planetRadiusKm + altitudeKm) *
            source.rayleigh.scaleHeightKm) * Math.exp(-altitudeKm / source.rayleigh.scaleHeightKm));
        const mieColumn = source.mie.extinctionPerKm.map((coefficient) => coefficient * Math.sqrt(2 * Math.PI * (source.planetRadiusKm + altitudeKm) *
            source.mie.scaleHeightKm) * Math.exp(-altitudeKm / source.mie.scaleHeightKm));
        const lineOfSightOpacity = mean(rayleighColumn.map((value, channel) => 1 - Math.exp(-(value + mieColumn[channel]))));
        const altitudeFade = 1 - smoothStep(model.fadeStartAltitudeKm, source.atmosphereHeightKm, altitudeKm);
        atmosphereAlpha = lineOfSightOpacity * sunward * sunResponse * altitudeFade;
    }
    if (displayRadius <= config.coverageScale) {
        const sunwardShadowRelease = shadowReleaseMaximum * smoothStep(config.sunwardShadowRelease[0], config.sunwardShadowRelease[1], lightDirection[2]);
        lightingAlpha *= 1 - sunwardShadowRelease;
    }
    const combinedAlpha = 1 - (1 - lightingAlpha) * (1 - atmosphereAlpha);
    const atmosphereShare = combinedAlpha === 0 ? 0 : atmosphereAlpha / combinedAlpha;
    const observationAtmosphereAlpha = displayRadius > 1 ? atmosphereAlpha : 0;
    const observationAlpha = 1 -
        (1 - lightingAlpha) * (1 - observationAtmosphereAlpha);
    const observationAtmosphereShare = observationAlpha === 0
        ? 0
        : observationAtmosphereAlpha / observationAlpha;
    return {
        combined: [
            model.color[0] * atmosphereShare,
            model.color[1] * atmosphereShare,
            model.color[2] * atmosphereShare,
            combinedAlpha,
        ],
        observation: [
            model.color[0] * observationAtmosphereShare,
            model.color[1] * observationAtmosphereShare,
            model.color[2] * observationAtmosphereShare,
            observationAlpha,
        ],
        lighting: [0, 0, 0, lightingAlpha],
    };
}
function writeAveragedPixel(output: Uint8Array, offset: number, premultiplied: readonly number[], alpha: number, sampleCount: number) {
    if (alpha === 0)
        return;
    for (let channel = 0; channel < 3; channel += 1) {
        output[offset + channel] = Math.round(premultiplied[channel] / alpha);
    }
    output[offset + 3] = Math.round(alpha / sampleCount * 255);
}
