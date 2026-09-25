import type { DensityVolumeFrame } from '../contracts/volume-frame.ts';
export const METERS_PER_KPC = 3.085677581491367e19;
/** Convert a heliocentric ICRS measurement, never a projected image footprint. */
export function cataloguePosition(raDeg: number, decDeg: number, distanceKpc: number, frame: DensityVolumeFrame): [
    number,
    number,
    number
] {
    if (![raDeg, decDeg, distanceKpc].every(Number.isFinite) || raDeg < 0 || raDeg >= 360 ||
        Math.abs(decDeg) > 90 || distanceKpc <= 0 || frame.referenceFrame !== 'sun-icrf' ||
        !(frame.metersPerUnit > 0) || !Number.isFinite(frame.metersPerUnit) ||
        !frame.originM.every(Number.isFinite) || frame.originM.length !== 3 ||
        frame.localToReferenceXyzw.length !== 4 || !frame.localToReferenceXyzw.every(Number.isFinite) ||
        Math.abs(Math.hypot(...frame.localToReferenceXyzw) - 1) > 1e-6) {
        throw new TypeError('Catalogue positions require finite ICRS coordinates, positive distance and a unit physical frame.');
    }
    const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
    const d = distanceKpc * METERS_PER_KPC;
    const p = [d * Math.cos(dec) * Math.cos(ra), d * Math.cos(dec) * Math.sin(ra), d * Math.sin(dec)]
        .map((value, axis) => (value - frame.originM[axis]!) / frame.metersPerUnit);
    const [qx, qy, qz, w] = frame.localToReferenceXyzw;
    const x = -qx, y = -qy, z = -qz;
    const tx = 2 * (y * p[2]! - z * p[1]!), ty = 2 * (z * p[0]! - x * p[2]!), tz = 2 * (x * p[1]! - y * p[0]!);
    return [p[0]! + w * tx + y * tz - z * ty, p[1]! + w * ty + z * tx - x * tz,
        p[2]! + w * tz + x * ty - y * tx];
}
