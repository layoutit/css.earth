export interface PreparedAtmosphereDisc { centerX: number; centerY: number; radiusX: number; radiusY: number; }
interface AtmosphereLayerBase { scaleHeightKm: number; scatteringPerKm: readonly [number, number, number]; weight: number; }
export type PreparedAtmosphereLayer = AtmosphereLayerBase & ({phase: 'mie'; anisotropy: number} | {phase: 'isotropic' | 'rayleigh'; anisotropy?: number});
interface AtmosphereTransferBase { intensity: number; exposure: number; alphaScale: number; maximumAlpha: number; limbConcentration?: boolean; }
export type PreparedAtmosphereTransfer = AtmosphereTransferBase & ({mode: 'calibrated-color'; colorRgb: readonly [number, number, number]} | {mode: 'scattering-rgb'});
export interface PreparedAtmosphereProfile { radiusKm: number; heightKm: number; layers: readonly PreparedAtmosphereLayer[]; transfer: PreparedAtmosphereTransfer; }
export interface PreparedAtmosphereInput { width: number; height?: number; disc: PreparedAtmosphereDisc; profile: PreparedAtmosphereProfile | null; lightDirection: readonly [number, number, number]; integrationSamples?: number; }
// Preparation-only globe-view shell integration. No object identity or source
// parsing belongs here; packages supply geometry, density and transfer inputs.
export function prepareAtmosphereFrame({
  width, height = width, disc, profile, lightDirection, integrationSamples = 24,
}: PreparedAtmosphereInput) {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 ||
      !Number.isInteger(integrationSamples) || integrationSamples < 4 ||
      !disc || ![disc.centerX, disc.centerY, disc.radiusX, disc.radiusY].every(Number.isFinite) ||
      disc.radiusX <= 0 || disc.radiusY <= 0 || !Array.isArray(lightDirection) ||
      lightDirection.length !== 3 || !lightDirection.every(Number.isFinite) ||
      Math.abs(Math.hypot(...lightDirection) - 1) > 1e-8) {
    throw new TypeError("Invalid prepared atmosphere projection or direction.");
  }
  const data = Buffer.alloc(width * height * 4);
  // Absence is transparent, not a fabricated default atmosphere.
  if (profile === null) return { data, width, height };
  const { radiusKm, heightKm, layers, transfer } = profile;
  if (!(radiusKm > 0) || !(heightKm > 0) || !Number.isFinite(radiusKm + heightKm) ||
      !Array.isArray(layers) || !layers.length || !transfer ||
      !["calibrated-color", "scattering-rgb"].includes(transfer.mode) ||
      ![transfer.intensity, transfer.exposure, transfer.alphaScale, transfer.maximumAlpha].every(Number.isFinite) ||
      transfer.intensity < 0 || transfer.exposure < 0 || transfer.alphaScale < 0 ||
      transfer.maximumAlpha < 0 || transfer.maximumAlpha > 1) {
    throw new TypeError("Invalid prepared atmosphere profile.");
  }
  if (transfer.mode === "calibrated-color" && (!Array.isArray(transfer.colorRgb) ||
      transfer.colorRgb.length !== 3 || transfer.colorRgb.some(value => !Number.isInteger(value) || value < 0 || value > 255))) {
    throw new TypeError("Invalid calibrated atmosphere color.");
  }
  // Incoming sunlight travels opposite to point-to-Sun; outgoing light travels
  // toward the viewer. Forward scattering therefore peaks at a backlit limb.
  const cosine = -lightDirection[2];
  const terms = layers.map((layer: PreparedAtmosphereLayer) => {
    if (!(layer.scaleHeightKm > 0) || !Number.isFinite(layer.scaleHeightKm) ||
        !Array.isArray(layer.scatteringPerKm) || layer.scatteringPerKm.length !== 3 ||
        layer.scatteringPerKm.some((value: number) => !Number.isFinite(value) || value < 0) ||
        !["isotropic", "rayleigh", "mie"].includes(layer.phase) ||
        !(layer.weight >= 0) || !Number.isFinite(layer.weight) ||
        (layer.phase === "mie" && !(Number.isFinite(layer.anisotropy) && Math.abs(layer.anisotropy) < 1))) {
      throw new TypeError("Invalid prepared atmospheric density layer.");
    }
    const g = layer.phase === 'mie' ? layer.anisotropy : 0;
    const phase = layer.phase === "isotropic" ? 1 : layer.phase === "rayleigh"
      ? .75 * (1 + cosine * cosine)
      : (1 - g * g) / (1 + g * g - 2 * g * cosine) ** 1.5;
    return { height: layer.scaleHeightKm / radiusKm,
      coefficients: layer.scatteringPerKm.map((value: number) => value * radiusKm),
      phase: phase * layer.weight };
  });
  const outer = 1 + heightKm / radiusKm;
  const referenceColumn = Math.sqrt(Math.PI * terms[0].height / 2);
  const antialias = 1 / Math.min(disc.radiusX, disc.radiusY);
  const columns = new Float64Array(terms.length);
  const color = new Float64Array(3);
  for (let y = 0; y < height; y++) {
    const py = (y + .5 - disc.centerY) / disc.radiusY;
    for (let x = 0; x < width; x++) {
      const px = (x + .5 - disc.centerX) / disc.radiusX;
      const squaredRadius = px * px + py * py;
      if (squaredRadius >= outer * outer) continue;
      const far = Math.sqrt(outer * outer - squaredRadius);
      const near = squaredRadius < 1 ? Math.sqrt(1 - squaredRadius) : -far;
      const step = (far - near) / integrationSamples;
      const projectedSun = px * lightDirection[0] + py * lightDirection[1];
      columns.fill(0);
      for (let sample = 0; sample < integrationSamples; sample++) {
        const z = near + (sample + .5) * step;
        const squared = squaredRadius + z * z;
        const altitude = Math.max(0, Math.sqrt(squared) - 1);
        const clearance = projectedSun + z * lightDirection[2] + Math.sqrt(Math.max(0, squared - 1));
        const t = Math.max(0, Math.min(1, (clearance + antialias) / (2 * antialias)));
        const visibleStep = t * t * (3 - 2 * t) * step;
        for (let term = 0; term < terms.length; term++) {
          columns[term] += Math.exp(-altitude / terms[term].height) * visibleStep;
        }
      }
      color.fill(0);
      for (let term = 0; term < terms.length; term++) {
        for (let channel = 0; channel < 3; channel++) {
          const opticalDepth = columns[term] * terms[term].coefficients[channel];
          color[channel] += (transfer.mode === "calibrated-color" ? opticalDepth
            : 1 - Math.exp(-opticalDepth)) * terms[term].phase;
        }
      }
      for (let channel = 0; channel < 3; channel++) {
        color[channel] = 1 - Math.exp(-color[channel] * transfer.intensity * transfer.exposure);
      }
      const luminance = transfer.mode === "calibrated-color" ? color[0]
        : color[0] * .3 + color[1] * .59 + color[2] * .11;
      const limb = transfer.limbConcentration ? Math.min(1, columns[0] / referenceColumn) : 1;
      const alpha = Math.round(255 * Math.min(transfer.maximumAlpha, luminance * transfer.alphaScale * limb));
      if (!alpha) continue;
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = transfer.mode === "calibrated-color"
          ? transfer.colorRgb[channel] : Math.round(color[channel] * 255);
      }
      data[offset + 3] = alpha;
    }
  }
  return { data, width, height };
}

export function compositePreparedAtmosphere(base: Uint8Array, atmosphere: Uint8Array) {
  if (base.length !== atmosphere.length || base.length % 4 !== 0) {
    throw new TypeError("Prepared atmosphere composition dimensions differ.");
  }
  for (let offset = 0; offset < base.length; offset += 4) {
    const front = atmosphere[offset + 3] / 255;
    if (!front) continue;
    const back = base[offset + 3] / 255 * (1 - front);
    const alpha = front + back;
    for (let channel = 0; channel < 3; channel++) {
      base[offset + channel] = Math.round((atmosphere[offset + channel] * front + base[offset + channel] * back) / alpha);
    }
    base[offset + 3] = Math.round(alpha * 255);
  }
}
