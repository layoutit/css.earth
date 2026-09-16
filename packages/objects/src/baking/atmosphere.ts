export interface AtmosphereSource {
    atmosphereHeightKm: number;
    planetRadiusKm: number;
    averageGroundReflectance: number;
    groundRadianceEmission: number;
    sunIntensity: number;
    rayleigh: {
        wavelengthsNm: readonly number[];
        scatteringPerKm: readonly number[];
        scaleHeightKm: number;
    };
    mie: {
        scatteringPerKm: readonly number[];
        extinctionPerKm: readonly number[];
        scaleHeightKm: number;
        phaseG: number;
    };
}
export type AtmosphereMaterial = ReturnType<typeof deriveAtmosphereMaterial>;
/** Reads an authored `cssearth-atmosphere-model@1` record: the two-layer single-scattering parameters a body's preparers consume. */
export function readAtmosphereModel(value: unknown): AtmosphereSource {
    const record = (v: unknown, label: string): Record<string, unknown> => {
        if (!v || typeof v !== "object" || Array.isArray(v)) throw new TypeError(`Atmosphere model ${label} must be an object.`);
        return v as Record<string, unknown>;
    };
    const finite = (v: unknown, label: string): number => {
        if (typeof v !== "number" || !Number.isFinite(v)) throw new TypeError(`Atmosphere model ${label} must be a finite number.`);
        return v;
    };
    const triple = (v: unknown, label: string): readonly number[] => {
        if (!Array.isArray(v) || v.length !== 3 || v.some((x) => typeof x !== "number" || !Number.isFinite(x) || x <= 0))
            throw new TypeError(`Atmosphere model ${label} must contain three positive values.`);
        return Object.freeze([v[0], v[1], v[2]]);
    };
    const root = record(value, "record");
    if (root.schema !== "cssearth-atmosphere-model@1") throw new TypeError("Atmosphere model schema is not cssearth-atmosphere-model@1.");
    const rayleigh = record(root.rayleigh, "rayleigh"), mie = record(root.mie, "mie");
    const model = Object.freeze({
        atmosphereHeightKm: finite(root.atmosphereHeightKm, "atmosphereHeightKm"),
        planetRadiusKm: finite(root.planetRadiusKm, "planetRadiusKm"),
        averageGroundReflectance: finite(root.averageGroundReflectance, "averageGroundReflectance"),
        groundRadianceEmission: finite(root.groundRadianceEmission, "groundRadianceEmission"),
        sunIntensity: finite(root.sunIntensity, "sunIntensity"),
        rayleigh: Object.freeze({
            wavelengthsNm: triple(rayleigh.wavelengthsNm, "rayleigh.wavelengthsNm"),
            scatteringPerKm: triple(rayleigh.scatteringPerKm, "rayleigh.scatteringPerKm"),
            scaleHeightKm: finite(rayleigh.scaleHeightKm, "rayleigh.scaleHeightKm"),
        }),
        mie: Object.freeze({
            scatteringPerKm: triple(mie.scatteringPerKm, "mie.scatteringPerKm"),
            extinctionPerKm: triple(mie.extinctionPerKm, "mie.extinctionPerKm"),
            scaleHeightKm: finite(mie.scaleHeightKm, "mie.scaleHeightKm"),
            phaseG: finite(mie.phaseG, "mie.phaseG"),
        }),
    });
    if (model.atmosphereHeightKm <= 0 || model.planetRadiusKm <= 0 ||
        model.rayleigh.scaleHeightKm <= 0 || model.mie.scaleHeightKm <= 0 ||
        model.mie.phaseG < -1 || model.mie.phaseG > 1) {
        throw new TypeError("Atmosphere model parameters are invalid.");
    }
    return model;
}
export function deriveAtmosphereMaterial(source: AtmosphereSource) {
    const rayleighOpticalDepth = source.rayleigh.scatteringPerKm.map((coefficient) => coefficient * source.rayleigh.scaleHeightKm);
    const mieScatteringOpticalDepth = source.mie.scatteringPerKm.map((coefficient) => coefficient * source.mie.scaleHeightKm);
    const mieExtinctionOpticalDepth = source.mie.extinctionPerKm.map((coefficient) => coefficient * source.mie.scaleHeightKm);
    const scatteringOpticalDepth = rayleighOpticalDepth.map((value, channel) => value + mieScatteringOpticalDepth[channel]);
    const extinctionOpticalDepth = rayleighOpticalDepth.map((value, channel) => value + mieExtinctionOpticalDepth[channel]);
    const visibleResponse = scatteringOpticalDepth.map((value) => 1 - Math.exp(-value));
    const maximumResponse = Math.max(...visibleResponse);
    const emissionWhitening = source.groundRadianceEmission * 0.5;
    const color = visibleResponse.map((value) => Math.round(255 * mix(value / maximumResponse, 1, emissionWhitening)));
    return Object.freeze({
        outerRadiusScale: 1 + source.atmosphereHeightKm / source.planetRadiusKm,
        color: Object.freeze(color),
        maximumAlpha: mean(visibleResponse),
        limbExponent: 1 + source.rayleigh.scaleHeightKm /
            (source.rayleigh.scaleHeightKm + source.mie.scaleHeightKm),
        nightFloor: 0.1 + source.groundRadianceEmission * 0.15,
        fadeStartAltitudeKm: source.atmosphereHeightKm - source.rayleigh.scaleHeightKm,
        rayleighOpticalDepth: Object.freeze(rayleighOpticalDepth),
        mieScatteringOpticalDepth: Object.freeze(mieScatteringOpticalDepth),
        mieExtinctionOpticalDepth: Object.freeze(mieExtinctionOpticalDepth),
        extinctionOpticalDepth: Object.freeze(extinctionOpticalDepth),
    });
}
function mean(values: readonly number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function mix(start: number, end: number, amount: number) {
    return start + (end - start) * amount;
}
