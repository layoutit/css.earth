/** Extract a published *hypothetical* spot layout onto a stationary stellar limb plate.
 * The figure constrains an illustrative pattern, not the actual surface of the star. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';

export interface SpotFigureModel {
  readonly source: string;
  readonly figure: string;
  readonly figureUrl: string;
  readonly panel: { readonly x: number; readonly y: number; readonly size: number };
  readonly darkThresholdRgb: readonly [number, number, number];
  readonly transitGuideRows: readonly [number, number];
  readonly spotToPhotosphereTessIntensityRatio: number;
  readonly reportedMeanCoveringFraction: number;
  readonly reportedPhotosphereTemperatureK: number;
  readonly reportedSpotTemperatureK: number;
}

export function parseSpotFigureModel(value: unknown): SpotFigureModel {
  const record = requireRecord(value, 'spot figure model');
  if (record.schema !== 'cssearth-stellar-spot-figure@1') throw new TypeError('Expected cssearth-stellar-spot-figure@1.');
  const panel = requireRecord(record.panel, 'spot figure panel');
  const darkThresholdRgb = requireArray(record.darkThresholdRgb, 'dark RGB threshold').map((v, i) => requireFiniteNumber(v, `dark threshold ${i}`));
  const transitGuideRows = requireArray(record.transitGuideRows, 'transit guide rows').map((v, i) => requireFiniteNumber(v, `guide row ${i}`));
  const result = {
    source: requireString(record.source, 'spot source'),
    figure: requireString(record.figure, 'spot figure'),
    figureUrl: requireString(record.figureUrl, 'figure URL'),
    panel: { x: requireFiniteNumber(panel.x, 'panel x'), y: requireFiniteNumber(panel.y, 'panel y'), size: requireFiniteNumber(panel.size, 'panel size') },
    darkThresholdRgb, transitGuideRows,
    spotToPhotosphereTessIntensityRatio: requireFiniteNumber(record.spotToPhotosphereTessIntensityRatio, 'TESS spot intensity ratio'),
    reportedMeanCoveringFraction: requireFiniteNumber(record.reportedMeanCoveringFraction, 'reported covering fraction'),
    reportedPhotosphereTemperatureK: requireFiniteNumber(record.reportedPhotosphereTemperatureK, 'photosphere temperature'),
    reportedSpotTemperatureK: requireFiniteNumber(record.reportedSpotTemperatureK, 'spot temperature')
  };
  if (!Number.isInteger(result.panel.x) || !Number.isInteger(result.panel.y) || !Number.isInteger(result.panel.size) || result.panel.size < 64 ||
      darkThresholdRgb.length !== 3 || darkThresholdRgb.some(x => !Number.isInteger(x) || x < 0 || x > 255) ||
      transitGuideRows.length !== 2 || transitGuideRows.some(x => !Number.isInteger(x) || x < 0 || x >= result.panel.size) ||
      result.spotToPhotosphereTessIntensityRatio <= 0 || result.spotToPhotosphereTessIntensityRatio >= 1 ||
      result.reportedMeanCoveringFraction <= 0 || result.reportedMeanCoveringFraction >= 1 ||
      result.reportedPhotosphereTemperatureK <= result.reportedSpotTemperatureK || result.reportedSpotTemperatureK <= 0)
    throw new TypeError('Invalid spot figure model.');
  return { ...result, darkThresholdRgb: darkThresholdRgb as [number, number, number], transitGuideRows: transitGuideRows as [number, number] };
}

export interface SpotFigurePixels { readonly data: Uint8Array; readonly width: number; readonly height: number; readonly channels: number }

export function addSpotFigureToLimbPlate(plate: { data: Uint8Array; size: number; lossless: boolean }, image: SpotFigurePixels, model: SpotFigureModel) {
  const { data, size } = plate, { panel } = model;
  if (data.length !== size * size * 4) throw new TypeError('The limb plate must be square RGBA.');
  if (image.channels !== 3 || image.data.length !== image.width * image.height * 3 ||
      panel.x < 0 || panel.y < 0 || panel.x + panel.size > image.width || panel.y + panel.size > image.height)
    throw new TypeError('The spot figure must contain the recorded RGB panel.');
  const threshold = model.darkThresholdRgb;
  const dark = (x: number, y: number) => {
    const px = panel.x + Math.max(0, Math.min(panel.size - 1, Math.floor(x)));
    const py = panel.y + Math.max(0, Math.min(panel.size - 1, Math.floor(y)));
    const i = 3 * (py * image.width + px);
    return image.data[i]! < threshold[0] && image.data[i + 1]! < threshold[1] && image.data[i + 2]! < threshold[2];
  };
  // The paper overlays two dotted white transit guides. Sample adjacent rows
  // only at those guides so the illustration's dark regions remain continuous.
  const spot = (x: number, y: number) => {
    for (const row of model.transitGuideRows) if (Math.abs(y - row) <= 3)
      return dark(x, row - 5) || dark(x, row + 5);
    return dark(x, y);
  };
  const output = new Uint8Array(data), radius = size / 2;
  let spotSamples = 0, discSamples = 0;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let covered = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const x = (px + (sx + 0.5) / 2 - radius) / radius;
      const y = (py + (sy + 0.5) / 2 - radius) / radius;
      if (x * x + y * y >= 1) continue;
      discSamples++;
      if (spot((1 + x) * panel.size / 2, (1 + y) * panel.size / 2)) { covered++; spotSamples++; }
    }
    if (!covered) continue;
    const index = 4 * (py * size + px) + 3, base = data[index]!;
    output[index] = Math.round(base + (255 - base) * (1 - model.spotToPhotosphereTessIntensityRatio) * covered / 4);
  }
  return { plate: { data: output, size, lossless: plate.lossless }, projectedSpotFraction: spotSamples / discSamples };
}
