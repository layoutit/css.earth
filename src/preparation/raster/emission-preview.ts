import type { InterpretedPlate } from './science.js';

/** Show the prepared limb layer over a uniform emissive photosphere in picker and card previews. */
export function composeLimbPreview(plate: InterpretedPlate, base: Uint8Array): Uint8Array {
    if (base.length < 3 || plate.data.length !== plate.size * plate.size * 4)
        throw new TypeError('Invalid photosphere or limb plate for preview.');
    const size = plate.size, radius = size / 2, output = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = (x + .5 - radius) / radius, dy = (y + .5 - radius) / radius;
        if (dx * dx + dy * dy >= 1) continue;
        const index = 4 * (y * size + x), alpha = plate.data[index + 3]! / 255;
        for (let channel = 0; channel < 3; channel++)
            output[index + channel] = Math.round(base[channel]! * (1 - alpha) + plate.data[index + channel]! * alpha);
        output[index + 3] = 255;
    }
    return output;
}
