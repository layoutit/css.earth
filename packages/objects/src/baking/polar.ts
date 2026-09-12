import { clamp, mix, modulo, angularDistance } from "./math.js";
/** A source-backed cylindrical photograph sampled in its declared body frame. */
export interface NativePolarSampler {
    sample(longitudeDegrees: number, latitudeDegrees: number, color: number[]): boolean;
}
export interface PolarSpriteOptions {
    sampling?: 'bilinear' | 'nearest';
    /** Optional direct photographic path. It is preparation-only and leaves the retained texture layout unchanged. */
    nativePhotograph?: NativePolarSampler;
    /** Applied only after a direct photograph reports no valid source contributor for an output texel. */
    missingColor?: (longitudeDegrees: number, latitudeDegrees: number, pixelDegrees: number) => readonly number[];
}
/** Numeric and categorical maps keep one source cell per sprite pixel: no supersampling, no bilinear mix, no pole blend. */
function createNearestPolarSprite(map: Uint8Array, width: number, height: number, tileSize: number, latitudeBands: number) {
    const output = new Uint8Array(tileSize * tileSize * 2 * 4);
    const boundaryLatitude = Math.PI / 2 - Math.PI / latitudeBands;
    for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
        const north = poleIndex === 0;
        for (let y = 0; y < tileSize; y += 1) {
            for (let x = 0; x < tileSize; x += 1) {
                const unitX = (x + 0.5) / tileSize * 2 - 1, unitY = (y + 0.5) / tileSize * 2 - 1;
                const radius = Math.hypot(unitX, unitY);
                if (radius > 1) continue;
                const longitude = modulo(Math.atan2(unitY, unitX), Math.PI * 2);
                const latitudeMagnitude = Math.acos(Math.min(1, radius * Math.cos(boundaryLatitude)));
                const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
                const sourceX = modulo(Math.floor(longitude / (Math.PI * 2) * width), width);
                const sourceY = clamp(Math.floor((Math.PI / 2 - latitude) / Math.PI * height), 0, height - 1);
                const sourceOffset = (sourceY * width + sourceX) * 4, targetOffset = (y * tileSize * 2 + poleIndex * tileSize + x) * 4;
                output.set(map.subarray(sourceOffset, sourceOffset + 4), targetOffset);
            }
        }
    }
    return output;
}
/** Prepare a polar sprite directly from a source-backed photographic sampler. No density-map intermediate is read. */
export function createNativePhotographPolarSprite(tileSize: number, latitudeBands: number, nativePhotograph: NativePolarSampler,
    missingColor: NonNullable<PolarSpriteOptions['missingColor']>) {
    const output = new Uint8Array(tileSize * tileSize * 2 * 4);
    const sampleCount = 4;
    const boundaryLatitude = Math.PI / 2 - Math.PI / latitudeBands;
    const pixelDegrees = 180 / tileSize;
    const color = [0, 0, 0, 255];
    const direct = [0, 0, 0, 255];
    const average = [0, 0, 0, 0];
    const poleBlendRadius = 2 / tileSize;
    for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
        const north = poleIndex === 0;
        for (let y = 0; y < tileSize; y += 1) {
            for (let x = 0; x < tileSize; x += 1) {
                const targetOffset = (y * tileSize * 2 + poleIndex * tileSize + x) * 4;
                const premultiplied = [0, 0, 0];
                let alpha = 0;
                let valid = true;
                let centerLongitudeX = 0, centerLongitudeY = 0, centerLatitude = 0, coveredSamples = 0;
                for (let sampleY = 0; sampleY < 2; sampleY += 1) {
                    for (let sampleX = 0; sampleX < 2; sampleX += 1) {
                        const unitX = (x + (sampleX + 0.5) / 2) / tileSize * 2 - 1;
                        const unitY = (y + (sampleY + 0.5) / 2) / tileSize * 2 - 1;
                        const radius = Math.hypot(unitX, unitY);
                        if (radius > 1) continue;
                        const longitude = modulo(Math.atan2(unitY, unitX), Math.PI * 2);
                        const latitudeMagnitude = Math.acos(Math.min(1, radius * Math.cos(boundaryLatitude)));
                        const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
                        coveredSamples++;
                        centerLongitudeX += Math.cos(longitude);
                        centerLongitudeY += Math.sin(longitude);
                        centerLatitude += latitude * 180 / Math.PI;
                        direct[3] = 255;
                        if (!nativePhotograph.sample(longitude * 180 / Math.PI, latitude * 180 / Math.PI, direct)) { valid = false; continue; }
                        if (radius < poleBlendRadius) {
                            average.fill(0);
                            for (let longitudeIndex = 0; longitudeIndex < 32; longitudeIndex += 1) {
                                color[3] = 255;
                                if (!nativePhotograph.sample((longitudeIndex + 0.5) / 32 * 360, latitude * 180 / Math.PI, color)) {
                                    valid = false;
                                    break;
                                }
                                for (let channel = 0; channel < 4; channel += 1) average[channel] += color[channel] / 32;
                            }
                            const directAmount = radius / poleBlendRadius;
                            for (let channel = 0; channel < 4; channel += 1) color[channel] = directAmount * direct[channel] + (1 - directAmount) * average[channel];
                        }
                        else for (let channel = 0; channel < 4; channel += 1) color[channel] = direct[channel];
                        const sampleAlpha = color[3] / 255;
                        alpha += sampleAlpha;
                        for (let channel = 0; channel < 3; channel += 1) premultiplied[channel] += color[channel] * sampleAlpha;
                    }
                }
                if (coveredSamples === 0) continue;
                const centerLongitude = modulo(Math.atan2(centerLongitudeY, centerLongitudeX), Math.PI * 2) * 180 / Math.PI;
                centerLatitude /= coveredSamples;
                const resolved = valid && alpha > 0
                    ? premultiplied.map(value => value / alpha)
                    : valid ? [0, 0, 0] : missingColor(centerLongitude, centerLatitude, pixelDegrees);
                for (let channel = 0; channel < 3; channel += 1) output[targetOffset + channel] = Math.round(resolved[channel] ?? 0);
                output[targetOffset + 3] = valid ? Math.round(alpha / sampleCount * 255) : Math.round(coveredSamples / sampleCount * 255);
            }
        }
    }
    return output;
}
export function createPolarSprite(map: Uint8Array, width: number, height: number, tileSize: number, latitudeBands: number,
    { sampling = 'bilinear', nativePhotograph, missingColor }: PolarSpriteOptions = {}) {
    if (nativePhotograph) {
        if (sampling === 'nearest') throw new TypeError('Native photographic polar sampling cannot replace nearest-sampled data.');
        if (!missingColor) throw new TypeError('Native photographic polar sampling needs an output-resolution missing-coverage color.');
        return createNativePhotographPolarSprite(tileSize, latitudeBands, nativePhotograph, missingColor);
    }
    if (sampling === 'nearest') return createNearestPolarSprite(map, width, height, tileSize, latitudeBands);
    const output = new Uint8Array(tileSize * tileSize * 2 * 4);
    const sampleCount = 4;
    const boundaryLatitude = Math.PI / 2 - Math.PI / latitudeBands;
    for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
        const north = poleIndex === 0;
        for (let y = 0; y < tileSize; y += 1) {
            for (let x = 0; x < tileSize; x += 1) {
                const targetOffset = (y * tileSize * 2 + poleIndex * tileSize + x) * 4;
                const premultiplied = [0, 0, 0];
                let alpha = 0;
                for (let sampleY = 0; sampleY < 2; sampleY += 1) {
                    for (let sampleX = 0; sampleX < 2; sampleX += 1) {
                        const unitX = (x + (sampleX + 0.5) / 2) / tileSize * 2 - 1;
                        const unitY = (y + (sampleY + 0.5) / 2) / tileSize * 2 - 1;
                        const radius = Math.hypot(unitX, unitY);
                        if (radius > 1)
                            continue;
                        const longitude = modulo(Math.atan2(unitY, unitX), Math.PI * 2);
                        const latitudeMagnitude = Math.acos(Math.min(1, radius * Math.cos(boundaryLatitude)));
                        const latitude = north ? latitudeMagnitude : -latitudeMagnitude;
                        const sourceX = longitude / (Math.PI * 2) * width - 0.5;
                        const sourceY = (Math.PI / 2 - latitude) / Math.PI * height - 0.5;
                        const sampled = samplePolarMap(map, width, height, sourceX, sourceY, radius, tileSize);
                        const sampleAlpha = sampled[3] / 255;
                        alpha += sampleAlpha;
                        for (let channel = 0; channel < 3; channel += 1) {
                            premultiplied[channel] += sampled[channel] * sampleAlpha;
                        }
                    }
                }
                if (alpha === 0)
                    continue;
                for (let channel = 0; channel < 3; channel += 1) {
                    output[targetOffset + channel] = Math.round(premultiplied[channel] / alpha);
                }
                output[targetOffset + 3] = Math.round(alpha / sampleCount * 255);
            }
        }
    }
    return output;
}
function samplePolarMap(map: Uint8Array, width: number, height: number, sourceX: number, sourceY: number, radius: number, tileSize: number) {
    const direct = sampleWrappedBilinearRgba(map, width, height, sourceX, sourceY);
    const poleBlendRadius = 2 / tileSize;
    if (radius >= poleBlendRadius)
        return direct;
    const average = [0, 0, 0, 0];
    for (let longitudeIndex = 0; longitudeIndex < 32; longitudeIndex += 1) {
        const sample = sampleWrappedBilinearRgba(map, width, height, (longitudeIndex + 0.5) / 32 * width - 0.5, sourceY);
        for (let channel = 0; channel < 4; channel += 1)
            average[channel] += sample[channel];
    }
    const directAmount = radius / poleBlendRadius;
    return average.map((sum, channel) => directAmount * direct[channel] + (1 - directAmount) * sum / 32);
}
function sampleWrappedBilinearRgba(map: Uint8Array, width: number, height: number, sourceX: number, sourceY: number) {
    const x0 = Math.floor(sourceX);
    const y = clamp(sourceY, 0, height - 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(height - 1, y0 + 1);
    const x1 = x0 + 1;
    const xAmount = sourceX - x0;
    const yAmount = y - y0;
    return [0, 1, 2, 3].map((channel) => {
        const top = mix(map[(y0 * width + modulo(x0, width)) * 4 + channel], map[(y0 * width + modulo(x1, width)) * 4 + channel], xAmount);
        const bottom = mix(map[(y1 * width + modulo(x0, width)) * 4 + channel], map[(y1 * width + modulo(x1, width)) * 4 + channel], xAmount);
        return mix(top, bottom, yAmount);
    });
}
export function polarTile(source: Uint8Array, tileSize: number, north: boolean, dimensions: {
    width: number;
    height: number;
    latitudeBands: number;
}, cutaway: {
    centerLongitudeDegrees: number;
    widthDegrees: number;
} | null = null) {
    const tile = new Uint8Array(tileSize * tileSize * 4);
    const center = (tileSize - 1) / 2;
    const capLatitudeSpan = Math.PI / dimensions.latitudeBands;
    for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
            const dx = (x - center) / center;
            const dy = (y - center) / center;
            const radius = Math.hypot(dx, dy);
            const targetOffset = (y * tileSize + x) * 4;
            if (radius > 1)
                continue;
            const longitude = Math.atan2(dx, north ? -dy : dy);
            if (cutaway && angularDistance(Math.atan2(dy, dx) * 180 / Math.PI, cutaway.centerLongitudeDegrees) <= cutaway.widthDegrees / 2)
                continue;
            const latitude = (north ? 1 : -1) *
                (Math.PI / 2 - radius * capLatitudeSpan);
            const sourceX = Math.round(((longitude / (Math.PI * 2) + 1) % 1) * (dimensions.width - 1));
            const sourceY = Math.round((0.5 - latitude / Math.PI) * (dimensions.height - 1));
            const sourceOffset = (sourceY * dimensions.width + sourceX) * 4;
            tile.set(source.subarray(sourceOffset, sourceOffset + 4), targetOffset);
        }
    }
    return tile;
}
export function orientLatitudeBands(source: Uint8Array, bandCount: number, width: number, height: number) {
    const bandHeight = height / bandCount;
    if (!Number.isInteger(bandHeight)) {
        throw new Error("latitude texture does not match its prepared grid.");
    }
    const output = new Uint8Array(source.length);
    const rowBytes = width * 4;
    for (let band = 0; band < bandCount; band += 1) {
        const bandStart = band * bandHeight;
        for (let row = 0; row < bandHeight; row += 1) {
            const sourceRow = bandStart + row;
            const outputRow = bandStart + bandHeight - 1 - row;
            output.set(source.subarray(sourceRow * rowBytes, (sourceRow + 1) * rowBytes), outputRow * rowBytes);
        }
    }
    return output;
}
