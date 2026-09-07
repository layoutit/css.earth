import { clamp, smoothstep } from "./math.js";
export interface LambertRasterConfig {
    minimumLightViewZ: number;
    maximumLightViewZ: number;
    frameCount: number;
    shadowlessFloodLimbFloor: number;
    ambientIntensity: number;
    radiusScale: number;
    terminator: readonly number[];
    maximumAlpha: number;
}
export function lightingFrame(size: number, frameIndex: number, config: LambertRasterConfig) {
    const pixels = new Uint8Array(size * size * 4);
    const lightViewZ = config.minimumLightViewZ +
        (config.maximumLightViewZ - config.minimumLightViewZ) *
            frameIndex / (config.frameCount - 1);
    const light = [Math.sqrt(Math.max(0, 1 - lightViewZ ** 2)), 0, lightViewZ];
    const center = (size - 1) / 2;
    // Extend the prepared material to the retained sphere silhouette. The
    // projective surface overlap is intentionally larger than the nominal
    // radius, so a smaller lighting disc would leave an unlit bright rim.
    const radius = size * config.radiusScale;
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const nx = (x - center) / radius;
            const ny = (y - center) / radius;
            const radialSquared = nx * nx + ny * ny;
            if (radialSquared > 1)
                continue;
            const nz = Math.sqrt(1 - radialSquared);
            const direct = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
            const directIllumination = smoothstep(config.terminator[0], config.terminator[1], direct) * direct;
            const illumination = frameIndex === config.frameCount - 1
                ? config.shadowlessFloodLimbFloor +
                    directIllumination * (1 - config.shadowlessFloodLimbFloor)
                : config.ambientIntensity + directIllumination;
            const alpha = Math.round(clamp(1 - illumination, 0, config.maximumAlpha) * 255);
            const offset = (y * size + x) * 4;
            pixels[offset + 3] = alpha;
        }
    }
    return pixels;
}
