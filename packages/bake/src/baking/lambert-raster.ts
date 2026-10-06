import type { AuthoredSphereLaw } from '@cssearth/objects';
import { clamp, smoothstep } from "./math.js";
/** Where a lighting frame draws its sphere, in pixels: the frame is `size` across with its centre at (size - 1)/2 and the
 * lit disc has radius `radius`. */
export interface LightingFrameGeometry { size: number; radius: number }
/** One frame of an authored sphere law, black with the shading in alpha: the sphere lit from the +x side with the light's
 * view-space z `lightViewZ`, or flood-lit (the frame a body shows with shadows off) when it is null. */
export function lightingFrame({ size, radius }: LightingFrameGeometry, lightViewZ: number | null, law: AuthoredSphereLaw) {
    const pixels = new Uint8Array(size * size * 4);
    const flood = lightViewZ === null, z = flood ? 1 : lightViewZ;
    const light = [Math.sqrt(Math.max(0, 1 - z ** 2)), 0, z];
    const center = (size - 1) / 2;
    // The lit disc is the retained sphere silhouette. The projective surface overlap is intentionally larger than the
    // nominal radius, so a smaller lighting disc would leave an unlit bright rim.
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const nx = (x - center) / radius;
            const ny = (y - center) / radius;
            const radialSquared = nx * nx + ny * ny;
            if (radialSquared > 1)
                continue;
            const nz = Math.sqrt(1 - radialSquared);
            const direct = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]);
            const directIllumination = smoothstep(law.terminator[0], law.terminator[1], direct) * direct;
            const illumination = flood
                ? law.shadowlessFloodLimbFloor +
                    directIllumination * (1 - law.shadowlessFloodLimbFloor)
                : law.ambientIntensity + directIllumination;
            const alpha = Math.round(clamp(1 - illumination, 0, law.maximumAlpha) * 255);
            const offset = (y * size + x) * 4;
            pixels[offset + 3] = alpha;
        }
    }
    return pixels;
}
