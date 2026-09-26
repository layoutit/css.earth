/** A scientific surface is interpreted before packing: numeric grids become colour ramps, categorical maps keep their
 * palette, photographs get their tonal presentation and missing coverage its grid. The interpretation lives with the
 * source decoders in tools; the raster lane only receives finished pixels and whether they must stay nearest-sampled. */
export interface InterpretedPlate { readonly data: Uint8Array; readonly size: number; readonly lossless: boolean; }
export interface InterpretedSurface {
    readonly data: Uint8Array; readonly channels: 1 | 2 | 3 | 4; readonly nearest: boolean;
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
