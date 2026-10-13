import { renderMeasuredSpectrum } from '@cssearth/bake/objects/charts';

/** The numeric CSV already exported by plotProduct; gaps stay gaps, without interpolation. */
export function spectrumChart(csv: string, unit: string): string {
  const lines = csv.trimEnd().split(/\r?\n/u);
  if (lines.shift() !== 'wavelength_um,value,standard_deviation') throw new TypeError('HTML spectrum requires the exported wavelength CSV.');
  const number = (value: string | undefined): number | null => {
    if (value === '') return null;
    if (value === undefined || !Number.isFinite(Number(value))) throw new TypeError('Invalid exported spectrum sample.');
    return Number(value);
  };
  const rows = lines.map(line => {
    const fields = line.split(',');
    if (fields.length !== 3) throw new TypeError('Invalid exported spectrum row.');
    const [wave,value,sigma] = fields.map(number);
    if (wave === null || wave <= 0 || sigma !== null && sigma < 0 || value === null && sigma !== null) throw new TypeError('Invalid spectrum coordinates or uncertainty.');
    return { wave, value, sigma };
  });
  return renderMeasuredSpectrum({ id: 'spectrum', title: 'Spectrum', description: 'Wavelength versus value', metadata: {},
    samples: rows.map(row => ({ x: row.wave, y: row.value, sigma: row.sigma })), xLabel: 'Wavelength (µm)', yLabel: `Value (${unit})` });
}
