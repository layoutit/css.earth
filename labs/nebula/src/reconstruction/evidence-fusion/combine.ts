import { evidenceChannels, readEvidenceSettings, type CombinedEvidence, type EvidenceInputs, type EvidenceSettings } from './model.js';

/** Bounded display response, not a probability or cross-band photometric calibration. */
function response(signal: number, sensitivity: number, weight: number): number {
  return Math.min(1, weight * (1 - Math.exp(-Math.max(0, signal - 2 / sensitivity) * sensitivity / 5)));
}
export function combineEvidence(inputs: EvidenceInputs, requested: EvidenceSettings): CombinedEvidence {
  const settings = readEvidenceSettings(requested, inputs.sources.length), length = inputs.grid.width * inputs.grid.height;
  const channels = settings.channel === 'all' ? evidenceChannels : [settings.channel];
  const planes = inputs.sources.map(() => new Float32Array(length)), coverage = inputs.sources.map(() => new Uint8Array(length));
  const union = new Float32Array(length), agreement = new Float32Array(length), contributors = new Uint8Array(length);
  for (let p = 0; p < length; p++) {
    for (const channel of channels) {
      // Every pair compares the same morphology channel; broad and compact coincidences cannot manufacture agreement.
      for (let a = 0; a < inputs.sources.length; a++) {
        const source = inputs.sources[a], field = source.channels[channel];
        if (!field.coverage[p] || settings.weights[a] === 0) continue;
        coverage[a][p] = 1;
        const value = response(field.signal[p], settings.sensitivity, settings.weights[a]);
        planes[a][p] = Math.max(planes[a][p], value); union[p] = Math.max(union[p], value);
        for (let b = 0; b < a; b++) {
          const other = inputs.sources[b], otherField = other.channels[channel];
          if (!otherField.coverage[p] || settings.weights[b] === 0) continue;
          let compatible = 1;
          if (channel === 'ridges') {
            const dot = source.ridgeDirectionX[p] * other.ridgeDirectionX[p] + source.ridgeDirectionY[p] * other.ridgeDirectionY[p];
            // Axial agreement: parallel/antiparallel =1, orthogonal =0. Below45° compatibility tapers to zero.
            compatible = Math.max(0, 2 * dot * dot - 1);
          }
          agreement[p] = Math.max(agreement[p], Math.min(value, response(otherField.signal[p], settings.sensitivity, settings.weights[b])) * compatible);
        }
      }
    }
    for (let source = 0; source < planes.length; source++) if (planes[source][p] > 0) contributors[p]++;
  }
  return { width: inputs.grid.width, height: inputs.grid.height, settings, planes, coverage, union, agreement, contributors };
}
export function inspectEvidence(inputs: EvidenceInputs, result: CombinedEvidence, x: number, y: number) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= result.width || y >= result.height)
    throw new TypeError('Evidence inspection requires a pixel inside the prepared grid.');
  const p = y * result.width + x;
  return { x, y, union: result.union[p], agreement: result.agreement[p], contributors: result.contributors[p],
    sources: inputs.sources.map((source, i) => ({ id: source.id, label: source.label, observed: source.footprint[p] === 1,
      covered: result.coverage[i][p] === 1, value: result.coverage[i][p] ? result.planes[i][p] : null,
      channels: Object.fromEntries(evidenceChannels.map(channel => [channel, source.channels[channel].coverage[p] ? source.channels[channel].signal[p] : null])) })) };
}
