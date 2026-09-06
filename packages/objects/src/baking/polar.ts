import { clamp, mix, modulo, angularDistance } from "./math.js";
export function createPolarSprite(map: Uint8Array, width: number, height: number, tileSize: number, latitudeBands: number) {
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
