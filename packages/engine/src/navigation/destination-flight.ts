export interface RotationMatrix3Components { m11: number; m12: number; m13: number; m21: number; m22: number; m23: number; m31: number; m32: number; m33: number; }
export interface DestinationFlightPlan { startZoom: number; targetZoom: number; overviewZoom: number; angularDistance: number; }
// Camera interpolation only. Destinations and scene geometry remain prepared.
const smooth = (t: number) => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const zoomBetween = (a: number, b: number, t: number) => a * (b / a) ** smooth(t);


export function sampleDestinationFlight({ startZoom, targetZoom, overviewZoom, angularDistance }: DestinationFlightPlan, progress: number) {
  if (![startZoom, targetZoom, overviewZoom].every(value => Number.isFinite(value) && value > 0) ||
      !Number.isFinite(angularDistance) || !Number.isFinite(progress)) throw new TypeError("Invalid destination flight.");
  const t = Math.max(0, Math.min(1, progress));
  const distant = angularDistance > 12;
  const endpointZoom = Math.min(startZoom, targetZoom);
  // Only a journey between two close surface views needs any extra pullback.
  // A quadratic curve in log zoom limits that pullback to 2× at equal endpoints.
  const pullback = endpointZoom > overviewZoom * 8 ? 4 ** smooth((angularDistance - 12) / 78) : 1;
  const controlZoom = endpointZoom / pullback;
  const u = smooth(t);
  const rotation = !distant ? u : startZoom <= targetZoom
    ? smooth(t / .7) : smooth(t ** 1.5);
  const zoom = !distant ? zoomBetween(startZoom, targetZoom, t)
    : Math.exp((1 - u) ** 2 * Math.log(startZoom) +
      2 * u * (1 - u) * Math.log(controlZoom) + u ** 2 * Math.log(targetZoom));
  return { rotation, zoom: t === 0 ? startZoom : t === 1 ? targetZoom : zoom };
}

// Extract the shortest rotation, including the numerically delicate 180° case.
// Numeric column-major rotation components; native matrix owners adapt structurally.
export function rotationAxisAngle(m: RotationMatrix3Components): { axis: [number, number, number]; degrees: number } {
  const trace = m.m11 + m.m22 + m.m33;
  let x, y, z, w;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    w = s / 4; x = (m.m23 - m.m32) / s; y = (m.m31 - m.m13) / s; z = (m.m12 - m.m21) / s;
  } else if (m.m11 > m.m22 && m.m11 > m.m33) {
    const s = Math.sqrt(1 + m.m11 - m.m22 - m.m33) * 2;
    w = (m.m23 - m.m32) / s; x = s / 4; y = (m.m21 + m.m12) / s; z = (m.m31 + m.m13) / s;
  } else if (m.m22 > m.m33) {
    const s = Math.sqrt(1 + m.m22 - m.m11 - m.m33) * 2;
    w = (m.m31 - m.m13) / s; x = (m.m21 + m.m12) / s; y = s / 4; z = (m.m32 + m.m23) / s;
  } else {
    const s = Math.sqrt(1 + m.m33 - m.m11 - m.m22) * 2;
    w = (m.m12 - m.m21) / s; x = (m.m31 + m.m13) / s; y = (m.m32 + m.m23) / s; z = s / 4;
  }
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const length = Math.hypot(x, y, z);
  if (length < 1e-12) return { axis: [1, 0, 0], degrees: 0 };
  return { axis: [x / length, y / length, z / length], degrees: 2 * Math.atan2(length, w) * 180 / Math.PI };
}
