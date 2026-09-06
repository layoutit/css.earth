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
export function parseAtmosphereSource(source: string) {
    const rayleigh = requiredSection(source, /Rayleigh\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*-- Default/u, "Rayleigh");
    const mie = requiredSection(source, /Mie\s*=\s*\{([\s\S]*?)\n\s*\},\n\s*Debug/u, "Mie");
    const model = Object.freeze({
        atmosphereHeightKm: difference(source, "AtmosphereHeight"),
        planetRadiusKm: scalar(source, "PlanetRadius"),
        averageGroundReflectance: scalar(source, "PlanetAverageGroundReflectance"),
        groundRadianceEmission: scalar(source, "GroundRadianceEmission"),
        sunIntensity: scalar(source, "SunIntensity"),
        rayleigh: Object.freeze({
            wavelengthsNm: Object.freeze(vector(rayleigh, "Wavelengths")),
            scatteringPerKm: Object.freeze(vector(rayleigh, "Scattering")),
            scaleHeightKm: scalar(rayleigh, "H_R"),
        }),
        mie: Object.freeze({
            scatteringPerKm: Object.freeze(vector(mie, "Scattering")),
            extinctionPerKm: Object.freeze(expressionVector(mie, "Extinction")),
            scaleHeightKm: scalar(mie, "H_M"),
            phaseG: scalar(mie, "G"),
        }),
    });
    for (const [label, values] of [
        ["Rayleigh wavelengths", model.rayleigh.wavelengthsNm],
        ["Rayleigh scattering", model.rayleigh.scatteringPerKm],
        ["Mie scattering", model.mie.scatteringPerKm],
        ["Mie extinction", model.mie.extinctionPerKm],
    ] as const) {
        if (values.length !== 3 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
            throw new TypeError(`${label} must contain three positive values.`);
        }
    }
    if (model.atmosphereHeightKm <= 0 || model.planetRadiusKm <= 0 ||
        model.rayleigh.scaleHeightKm <= 0 || model.mie.scaleHeightKm <= 0 ||
        model.mie.phaseG < -1 || model.mie.phaseG > 1) {
        throw new TypeError("OpenSpace atmosphere parameters are invalid.");
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
function requiredSection(source: string, pattern: RegExp, label: string) {
    const match = source.match(pattern);
    if (!match)
        throw new TypeError(`OpenSpace ${label} section is missing.`);
    return match[1];
}
function scalar(source: string, key: string) {
    const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, "mu"));
    if (!match)
        throw new TypeError(`OpenSpace ${key} is missing.`);
    return Number(match[1]);
}
function difference(source: string, key: string) {
    const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)`, "mu"));
    if (!match)
        throw new TypeError(`OpenSpace ${key} difference is missing.`);
    return Number(match[1]) - Number(match[2]);
}
function vector(source: string, key: string) {
    const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*\\{([^}]+)\\}`, "mu"));
    if (!match)
        throw new TypeError(`OpenSpace ${key} vector is missing.`);
    return match[1].split(",").map((value) => Number(value.trim()));
}
function expressionVector(source: string, key: string) {
    const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*\\{([^}]+)\\}`, "mu"));
    if (!match)
        throw new TypeError(`OpenSpace ${key} vector is missing.`);
    return match[1].split(",").map((expression) => {
        const division = expression.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/u);
        if (!division)
            throw new TypeError(`OpenSpace ${key} expression is invalid.`);
        return Number(division[1]) / Number(division[2]);
    });
}
function mean(values: readonly number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function mix(start: number, end: number, amount: number) {
    return start + (end - start) * amount;
}
