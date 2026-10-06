/** A scientific surface is interpreted before packing: numeric grids become color ramps, categorical maps keep their
 * palette, photographs get their tonal presentation and missing coverage its grid. The interpretation lives with the
 * source decoders in tools; the raster lane only receives finished pixels and whether they must stay nearest-sampled. */
export interface InterpretedPlate { readonly data: Uint8Array; readonly size: number; readonly lossless: boolean; }
/** A limb plate drawn `strength` times as strong: the light its alpha lets through, raised to that power. The plate's
 * color is kept (a limb plate is black); only how much it darkens changes. */
export function strongerLimb(plate: InterpretedPlate, strength: number): InterpretedPlate {
    if (!(strength > 0)) throw new RangeError('A limb plate\'s strength must be over 0.');
    return strength === 1 ? plate : { ...plate, data: plate.data.map((value, index) => index % 4 === 3 ? Math.round(255 * (1 - (1 - value / 255) ** strength)) : value) };
}
export interface InterpretedSurface {
    readonly data: Uint8Array; readonly channels: 1 | 2 | 3 | 4; readonly nearest: boolean;
    /** One byte per pixel, set where the interpretation painted the missing-coverage grid (no value in the source). */
    readonly missing?: Uint8Array;
    /** Decoder-owned interpretation evidence, retained with the prepared surface. */
    readonly report?: Readonly<Record<string, unknown>>;
    /** Optional direct source sampler for the polar sprite only. The packed latitude bands stay exactly as prepared. */
    readonly nativePhotograph?: {
        readonly sample: (longitudeDegrees: number, latitudeDegrees: number, color: number[]) => boolean;
    };
    /** Emissive bodies: the stationary off-limb context and the limb plate at this density. */
    readonly plates?: { readonly offLimb: InterpretedPlate; readonly limb: InterpretedPlate };
}
export interface ObservationInterpretation {
    (surface: { readonly id: string; readonly source: string; readonly science: Record<string, unknown>; readonly nativeSourcePoles?: boolean }, width: number, height: number, density: number): Promise<InterpretedSurface>;
}
/** Fill the cells an interpretation left empty with another prepared surface's pixels scaled by `brightness`. */
export function applyUnderlay(pixels: Uint8Array, missing: Uint8Array, underlay: Uint8Array, id: string,
    { brightness, grayscale = false, bits = 8 }: { brightness: number; grayscale?: boolean; bits?: number }) {
    if (pixels.length !== underlay.length || missing.length * 4 !== pixels.length)
        throw new RangeError(`${id}: underlay has ${underlay.length / 4} pixels, the surface ${pixels.length / 4} and its mask ${missing.length}.`);
    const keep = (0xff << (8 - bits)) & 0xff;
    for (let pixel = 0; pixel < missing.length; pixel++) {
        if (!missing[pixel]) continue;
        const offset = pixel * 4;
        const luma = grayscale ? 0.2126 * underlay[offset]! + 0.7152 * underlay[offset + 1]! + 0.0722 * underlay[offset + 2]! : 0;
        for (let channel = 0; channel < 3; channel++)
            pixels[offset + channel] = Math.round((grayscale ? luma : underlay[offset + channel]!) * brightness) & keep;
        pixels[offset + 3] = 255;
    }
    return pixels;
}
/** Expand interpreted pixels to the RGBA layout the packer and polar sampler read. */
export function withAlpha(interpreted: InterpretedSurface, width: number, height: number): Uint8Array {
    const { data, channels } = interpreted;
    if (data.length !== width * height * channels) throw new RangeError('Interpreted surface dimensions drifted.');
    if (channels === 4) return data;
    const output = new Uint8Array(width * height * 4);
    for (let pixel = 0; pixel < width * height; pixel++) {
        const source = pixel * channels, target = pixel * 4;
        if (channels === 3) { output[target] = data[source]!; output[target + 1] = data[source + 1]!; output[target + 2] = data[source + 2]!; output[target + 3] = 255; }
        else { const value = data[source]!; output[target] = value; output[target + 1] = value; output[target + 2] = value; output[target + 3] = channels === 2 ? data[source + 1]! : 255; }
    }
    return output;
}
