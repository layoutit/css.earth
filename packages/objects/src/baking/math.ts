export function clamp(value: number, minimum: number, maximum: number): number { return Math.max(minimum, Math.min(maximum, value)); }
export function mix(start: number, end: number, amount: number): number { return start + (end - start) * amount; }
export function smoothstep(start: number, end: number, value: number): number { const amount = clamp((value - start) / (end - start), 0, 1); return amount * amount * (3 - 2 * amount); }
export const smoothStep = smoothstep;
export function modulo(value: number, divisor: number): number { return (value % divisor + divisor) % divisor; }
export function mean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
export function normalize(vector: readonly number[]): number[] { const length = Math.hypot(...vector) || 1; return vector.map((value) => value / length); }
export function dot(left: readonly number[], right: readonly number[]): number { return left.reduce((sum, value, index) => sum + value * right[index], 0); }
export function angularDistance(left: number, right: number): number { return Math.abs(((left - right + 540) % 360) - 180); }
