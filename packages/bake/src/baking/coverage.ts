import { clamp, smoothstep } from "./math.js";
export function completeEnhancedCoverage(enhanced: Uint8Array, normal: Uint8Array, topography: Uint8Array, dimensions: {
    width: number;
    height: number;
}, references: readonly string[]) {
    const rgba = new Uint8Array(enhanced);
    const rowStats = Array.from({ length: dimensions.height }, () => ({
        red: 0,
        green: 0,
        blue: 0,
        detail: 0,
        count: 0,
    }));
    const reliableRow = new Int32Array(dimensions.height);
    const previousValidColumns = new Int32Array(dimensions.width);
    const nextValidColumns = new Int32Array(dimensions.width);
    let filledPixelCount = 0;
    for (let y = 0; y < dimensions.height; y += 1) {
        const stats = rowStats[y];
        for (let x = 0; x < dimensions.width; x += 1) {
            const offset = (y * dimensions.width + x) * 4;
            if (isNeutralNoData(enhanced, offset))
                continue;
            stats.red += enhanced[offset];
            stats.green += enhanced[offset + 1];
            stats.blue += enhanced[offset + 2];
            stats.detail += coverageDetail(normal, topography, offset);
            stats.count += 1;
        }
    }
    const reliableRows = rowStats.flatMap((stats, row) => stats.count >= dimensions.width / 2 ? [row] : []);
    if (reliableRows.length === 0) {
        throw new Error("enhanced source has no reliable latitude row.");
    }
    let reliableIndex = 0;
    for (let y = 0; y < dimensions.height; y += 1) {
        while (reliableIndex + 1 < reliableRows.length &&
            Math.abs(reliableRows[reliableIndex + 1] - y) <=
                Math.abs(reliableRows[reliableIndex] - y)) {
            reliableIndex += 1;
        }
        reliableRow[y] = reliableRows[reliableIndex];
    }
    for (let y = 0; y < dimensions.height; y += 1) {
        let lastValidColumn = -1;
        for (let x = 0; x < dimensions.width; x += 1) {
            const offset = (y * dimensions.width + x) * 4;
            if (!isNeutralNoData(enhanced, offset))
                lastValidColumn = x;
            previousValidColumns[x] = lastValidColumn;
        }
        lastValidColumn = -1;
        for (let x = dimensions.width - 1; x >= 0; x -= 1) {
            const offset = (y * dimensions.width + x) * 4;
            if (!isNeutralNoData(enhanced, offset))
                lastValidColumn = x;
            nextValidColumns[x] = lastValidColumn;
        }
        const row = rowStats[reliableRow[y]];
        const meanColor = [row.red, row.green, row.blue].map((value) => value / row.count);
        const meanDetail = row.detail / row.count;
        const localWeight = rowStats[y].count >= dimensions.width / 2 ? 0.35 : 0;
        for (let x = 0; x < dimensions.width; x += 1) {
            const targetOffset = (y * dimensions.width + x) * 4;
            if (!isNeutralNoData(enhanced, targetOffset))
                continue;
            const targetDetail = coverageDetail(normal, topography, targetOffset);
            const referenceColumn = nearestValidColumn(x, previousValidColumns[x], nextValidColumns[x]);
            let referenceColor = meanColor;
            let referenceDetail = meanDetail;
            if (localWeight > 0 && referenceColumn >= 0) {
                const referenceOffset = (y * dimensions.width + referenceColumn) * 4;
                referenceColor = meanColor.map((value, channel) => value * (1 - localWeight) +
                    enhanced[referenceOffset + channel] * localWeight);
                referenceDetail = meanDetail * (1 - localWeight) +
                    coverageDetail(normal, topography, referenceOffset) * localWeight;
            }
            const scale = clamp(targetDetail / Math.max(1, referenceDetail), 0.45, 2.2);
            for (let channel = 0; channel < 3; channel += 1) {
                rgba[targetOffset + channel] = Math.round(clamp(referenceColor[channel] * scale, 0, 255));
            }
            const maximum = Math.max(rgba[targetOffset], rgba[targetOffset + 1], rgba[targetOffset + 2]);
            if (maximum < 24) {
                const lift = 24 / Math.max(1, maximum);
                for (let channel = 0; channel < 3; channel += 1) {
                    rgba[targetOffset + channel] = Math.round(clamp(rgba[targetOffset + channel] * lift, 0, 255));
                }
            }
            rgba[targetOffset + 3] = 255;
            filledPixelCount += 1;
        }
    }
    return Object.freeze({
        rgba,
        metadata: Object.freeze({
            model: "prepared-latitude-coherent-enhanced-chroma-with-local-bdr-or-topography-detail",
            polarModel: "prepared-annulus-mean-enhanced-tint-with-bdr-detail",
            noDataRule: "neutral source pixels with maximum channel at most 18 and channel spread at most 6",
            filledPixelCount,
            filledFraction: Number((filledPixelCount /
                (dimensions.width * dimensions.height)).toFixed(8)),
            referenceSources: Object.freeze(references),
            directEnhancedColorClaim: false,
            runtimeCompletion: false,
        }),
    });
}
function nearestValidColumn(target: number, previous: number, next: number) {
    if (previous < 0)
        return next;
    if (next < 0)
        return previous;
    return target - previous <= next - target ? previous : next;
}
function coverageDetail(normal: Uint8Array, topography: Uint8Array, offset: number) {
    const source = isNeutralNoData(normal, offset) ? topography : normal;
    return source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
        source[offset + 2] * 0.0722;
}
function isNeutralNoData(source: Uint8Array, offset: number) {
    const maximum = Math.max(source[offset], source[offset + 1], source[offset + 2]);
    const minimum = Math.min(source[offset], source[offset + 1], source[offset + 2]);
    return maximum <= 18 && maximum - minimum <= 6;
}
export function completeEnhancedPolarTile(enhanced: Uint8Array, fallback: Uint8Array, tileSize: number) {
    const output = new Uint8Array(enhanced);
    const center = (tileSize - 1) / 2;
    let enhancedRed = 0;
    let enhancedGreen = 0;
    let enhancedBlue = 0;
    let fallbackLuminance = 0;
    let sampleCount = 0;
    for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
            const radius = Math.hypot((x - center) / center, (y - center) / center);
            if (radius < 0.68 || radius > 0.86)
                continue;
            const offset = (y * tileSize + x) * 4;
            if (enhanced[offset + 3] === 0 || fallback[offset + 3] === 0)
                continue;
            enhancedRed += enhanced[offset];
            enhancedGreen += enhanced[offset + 1];
            enhancedBlue += enhanced[offset + 2];
            fallbackLuminance += pixelLuminance(fallback, offset);
            sampleCount += 1;
        }
    }
    if (sampleCount === 0) {
        throw new Error("enhanced polar coverage has no reference annulus.");
    }
    const meanEnhanced = [
        enhancedRed / sampleCount,
        enhancedGreen / sampleCount,
        enhancedBlue / sampleCount,
    ];
    const meanEnhancedLuminance = meanEnhanced[0] * 0.2126 +
        meanEnhanced[1] * 0.7152 + meanEnhanced[2] * 0.0722;
    const meanFallbackLuminance = fallbackLuminance / sampleCount;
    const luminanceScale = meanEnhancedLuminance /
        Math.max(1, meanFallbackLuminance);
    const tint = meanEnhanced.map((channel) => channel / Math.max(1, meanEnhancedLuminance));
    for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
            const radius = Math.hypot((x - center) / center, (y - center) / center);
            if (radius > 0.7)
                continue;
            const offset = (y * tileSize + x) * 4;
            if (fallback[offset + 3] === 0)
                continue;
            const targetLuminance = Math.max(22, pixelLuminance(fallback, offset) * luminanceScale);
            const prepared = tint.map((channel) => Math.round(clamp(channel * targetLuminance, 0, 255)));
            const enhancedWeight = smoothstep(0.42, 0.7, radius);
            for (let channel = 0; channel < 3; channel += 1) {
                output[offset + channel] = Math.round(prepared[channel] * (1 - enhancedWeight) +
                    enhanced[offset + channel] * enhancedWeight);
            }
            output[offset + 3] = fallback[offset + 3];
        }
    }
    return output;
}
function pixelLuminance(source: Uint8Array, offset: number) {
    return source[offset] * 0.2126 + source[offset + 1] * 0.7152 +
        source[offset + 2] * 0.0722;
}
