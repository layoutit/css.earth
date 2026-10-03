import { normalize, clamp, smoothstep, angularDistance } from "./math.js";
export interface CutawayAngles {
    centerLongitudeDegrees: number;
    widthDegrees: number;
}
export interface InteriorPalette {
    metallicCore: readonly number[];
    combinedMantleCrust: readonly number[];
    layerContact: readonly number[];
}
export interface InteriorStructure {
    metallicCoreRadiusFraction: number;
    presentation: {
        palette: InteriorPalette;
        cutaway: CutawayAngles;
    };
}
export interface InteriorRasterConfig {
    palette: InteriorPalette;
    worldLightDirection: readonly number[];
    ambientIntensity: number;
    coreNoiseSeed: number;
}
export function interiorLayer(width: number, height: number, config: InteriorRasterConfig) {
    const pixels = new Uint8Array(width * height * 4);
    const base = config.palette.metallicCore;
    const light = normalize(config.worldLightDirection);
    for (let y = 0; y < height; y += 1) {
        const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
        for (let x = 0; x < width; x += 1) {
            const longitude = (x + 0.5) / width * Math.PI * 2;
            const normal = [
                Math.cos(latitude) * Math.cos(longitude),
                Math.cos(latitude) * Math.sin(longitude),
                Math.sin(latitude),
            ];
            const direct = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
            const illumination = 0.72 + direct * 0.28;
            const broad = Math.sin(latitude * 7 + Math.sin(longitude * 3) * 0.55) * 5;
            const grain = multiScaleNoise(x, y, config.coreNoiseSeed) * 15;
            const offset = (y * width + x) * 4;
            pixels[offset] = Math.round(clamp((base[0] + broad + grain) * illumination, 0, 255));
            pixels[offset + 1] = Math.round(clamp((base[1] + broad * 0.7 + grain * 0.65) * illumination, 0, 255));
            pixels[offset + 2] = Math.round(clamp((base[2] + broad * 0.45 + grain * 0.4) * illumination, 0, 255));
            pixels[offset + 3] = 255;
        }
    }
    return pixels;
}
export function interiorCorePoleAtlas(tileSize: number, cutaway: CutawayAngles, config: InteriorRasterConfig) {
    const width = tileSize * 2;
    const pixels = new Uint8Array(width * tileSize * 4);
    const base = config.palette.metallicCore;
    const light = normalize(config.worldLightDirection);
    for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
        for (let y = 0; y < tileSize; y += 1) {
            const py = (y + 0.5) / tileSize * 2 - 1;
            for (let x = 0; x < tileSize; x += 1) {
                const px = (x + 0.5) / tileSize * 2 - 1;
                const radius = Math.hypot(px, py);
                if (radius > 1)
                    continue;
                if (angularDistance(Math.atan2(py, px) * 180 / Math.PI, cutaway.centerLongitudeDegrees) <= cutaway.widthDegrees / 2)
                    continue;
                const pz = Math.sqrt(Math.max(0, 1 - radius * radius)) *
                    (poleIndex === 0 ? 1 : -1);
                const direct = Math.max(0, px * light[0] + py * light[1] + pz * light[2]);
                const illumination = 0.68 + direct * 0.32;
                const grain = multiScaleNoise(x, y, poleIndex + 101) * 11;
                const offset = (y * width + poleIndex * tileSize + x) * 4;
                pixels[offset] = Math.round(clamp(base[0] * illumination + grain, 0, 255));
                pixels[offset + 1] = Math.round(clamp(base[1] * illumination + grain * 0.72, 0, 255));
                pixels[offset + 2] = Math.round(clamp(base[2] * illumination + grain * 0.45, 0, 255));
                pixels[offset + 3] = 255;
            }
        }
    }
    return pixels;
}
export function interiorSection(width: number, height: number, source: InteriorStructure, config: InteriorRasterConfig) {
    if (width % 2 !== 0) {
        throw new Error("interior section atlas width must be even.");
    }
    const pixels = new Uint8Array(width * height * 4);
    const coreRadius = source.metallicCoreRadiusFraction;
    const faceWidth = width / 2;
    const faceLongitudes = [
        source.presentation.cutaway.centerLongitudeDegrees -
            source.presentation.cutaway.widthDegrees / 2,
        source.presentation.cutaway.centerLongitudeDegrees +
            source.presentation.cutaway.widthDegrees / 2,
    ];
    const objectLight = normalize(config.worldLightDirection);
    const edge = 2.5 / Math.min(faceWidth, height);
    for (let faceIndex = 0; faceIndex < 2; faceIndex += 1) {
        const longitude = faceLongitudes[faceIndex] * Math.PI / 180;
        const faceNormal = [-Math.sin(longitude), Math.cos(longitude), 0];
        const faceExposure = Math.abs(faceNormal[0] * objectLight[0] + faceNormal[1] * objectLight[1]);
        const faceLight = 0.72 + faceExposure * 0.22;
        for (let y = 0; y < height; y += 1) {
            const vertical = (y + 0.5) / height * 2 - 1;
            for (let x = 0; x < faceWidth; x += 1) {
                const radialAxis = (x + 0.5) / faceWidth;
                const radial = Math.hypot(radialAxis, vertical);
                if (radial > 1 + edge)
                    continue;
                const core = radial <= coreRadius;
                const base = core
                    ? source.presentation.palette.metallicCore
                    : source.presentation.palette.combinedMantleCrust;
                const grain = multiScaleNoise(x, y, width + height + faceIndex * 97) * (core ? 11 : 7);
                const contact = 1 - 0.24 * Math.exp(-Math.pow(Math.abs(radial - coreRadius) / 0.012, 2));
                const outerRim = 0.72 + 0.28 * smoothstep(0, 0.055, 1 - radial);
                const depth = Math.sqrt(Math.max(0, 1 - radial * radial));
                const lighting = faceLight *
                    (0.8 + 0.2 * depth) *
                    (1 + smoothstep(0.82, 1, radial) * 0.06) *
                    outerRim * contact;
                const offset = (y * width + faceIndex * faceWidth + x) * 4;
                pixels[offset] = Math.round(clamp((base[0] + grain) * lighting, 0, 255));
                pixels[offset + 1] = Math.round(clamp((base[1] + grain * 0.65) * lighting, 0, 255));
                pixels[offset + 2] = Math.round(clamp((base[2] + grain * 0.4) * lighting, 0, 255));
                pixels[offset + 3] = Math.round((1 - smoothstep(1 - edge, 1 + edge, radial)) * 255);
            }
        }
    }
    return pixels;
}
function preparedNoise(x: number, y: number, size: number) {
    const value = Math.sin((x * 12.9898 + y * 78.233 + size * 0.001) * 43758.5453);
    return value - Math.floor(value);
}
function multiScaleNoise(x: number, y: number, size: number) {
    return (preparedNoise(x, y, size) - 0.5) * 0.56 +
        (preparedNoise(Math.floor(x / 4), Math.floor(y / 4), size + 17) - 0.5) *
            0.31 +
        (preparedNoise(Math.floor(x / 13), Math.floor(y / 13), size + 43) - 0.5) *
            0.13;
}
export function shadeInteriorOuter(source: Uint8Array, dimensions: {
    width: number;
    height: number;
}, config: InteriorRasterConfig) {
    const output = new Uint8Array(source.length);
    const light = normalize(config.worldLightDirection);
    for (let y = 0; y < dimensions.height; y += 1) {
        const latitude = -Math.PI / 2 + (y + 0.5) / dimensions.height * Math.PI;
        for (let x = 0; x < dimensions.width; x += 1) {
            const longitude = (x + 0.5) / dimensions.width * Math.PI * 2;
            const normal = [
                Math.cos(latitude) * Math.cos(longitude),
                Math.cos(latitude) * Math.sin(longitude),
                Math.sin(latitude),
            ];
            const direct = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);
            const illumination = config.ambientIntensity +
                smoothstep(0, 0.1, direct) * direct;
            const offset = (y * dimensions.width + x) * 4;
            output[offset] = Math.round(source[offset] * illumination);
            output[offset + 1] = Math.round(source[offset + 1] * illumination);
            output[offset + 2] = Math.round(source[offset + 2] * illumination);
            output[offset + 3] = source[offset + 3];
        }
    }
    return output;
}
