// Presentation adjustment of owned RGB bytes, applied during preparation before
// cloud compositing. Endpoints stay fixed; this is not radiometric calibration.
export function applyDisplayGamma(data, gamma = 1) {
  if (!Number.isFinite(gamma) || gamma < 1 || gamma > 2) {
    throw new TypeError('Display gamma must be a finite number between 1 and 2.');
  }
  if (gamma === 1) return data;
  const curve = Uint8Array.from({ length: 256 }, (_, value) =>
    Math.round(255 * (value / 255) ** (1 / gamma)));
  for (let i = 0; i < data.length; i++) data[i] = curve[data[i]];
  return data;
}
