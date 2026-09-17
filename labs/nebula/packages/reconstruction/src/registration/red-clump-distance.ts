export interface RedClumpCalibration {
    referenceDistanceKpc: number;
    referenceMagnitude: number;
    extinctionPerReddening: number;
}
export function validateRedClumpCalibration(value: unknown): RedClumpCalibration {
    if (!value || typeof value !== 'object') throw Error('Missing red-clump calibration');
    const finite = (key: string): number => {
        const number: unknown = Reflect.get(value, key);
        if (typeof number !== 'number' || !Number.isFinite(number)) throw Error(`Invalid calibration ${key}`);
        return number;
    };
    const referenceDistanceKpc = finite('referenceDistanceKpc');
    const referenceMagnitude = finite('referenceMagnitude');
    const extinctionPerReddening = finite('extinctionPerReddening');
    if (referenceDistanceKpc <= 0 || extinctionPerReddening < 0) throw Error('Invalid calibration range');
    return { referenceDistanceKpc, referenceMagnitude, extinctionPerReddening };
}
export function redClumpDistanceKpc(ksMag: number, reddening: number, calibration: RedClumpCalibration): number {
    const { referenceDistanceKpc, referenceMagnitude, extinctionPerReddening } = validateRedClumpCalibration(calibration);
    if (!Number.isFinite(ksMag) || !Number.isFinite(reddening) || ksMag < 0 || ksMag > 40) throw Error('Invalid photometry');
    return referenceDistanceKpc * 10 ** ((ksMag - extinctionPerReddening * Math.max(0, reddening) - referenceMagnitude) / 5);
}
export function unambiguousMatch(best: number, second: number): boolean {
    return Number.isFinite(best) && best >= 0 && best <= 0.5 && (second === Infinity || (Number.isFinite(second) && second - best >= 0.05));
}
