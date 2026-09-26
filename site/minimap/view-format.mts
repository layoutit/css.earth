
const units: readonly (readonly [number, string])[] = [[299792458 * 31557600, 'ly'], [149597870700, 'AU'], [1000, 'km'], [1, 'm']];

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const distanceUnit = (meters: number): readonly [number, string] => units.find(([size]) => meters >= size) ?? units[units.length - 1];


export function formatViewDate(epochJdTt: number) {
  if (!Number.isFinite(epochJdTt)) return '—';
  // Format the prepared TT calendar date without applying the browser's local timezone.
  const calendar = new Date((epochJdTt - 2440587.5) * 86400000).toISOString();
  return `${calendar.slice(0, 16).replace('T', ' ')} TT`;
}


export function formatViewDistance(meters: number) {
  const [size, unit] = distanceUnit(meters);
  return `${(unit === 'km' ? wholeNumber : number).format(meters / size)} ${unit}`;
}


export function formatViewCoordinate(degrees: number, positive: string, negative: string) {
  const hundredths = Math.round(Math.abs(degrees) * 360000);
  const d = Math.floor(hundredths / 360000), m = Math.floor(hundredths / 6000) % 60;
  const s = ((hundredths % 6000) / 100).toFixed(2).padStart(5, '0');
  return `${d}°${String(m).padStart(2, '0')}′${s}″ ${degrees < 0 ? negative : positive}`;
}


export function viewScale(metersPerPixel: number, maxWidth = 80) {
  if (!(metersPerPixel > 0) || !Number.isFinite(metersPerPixel)) return null;
  const [unitSize, unit] = distanceUnit(metersPerPixel * maxWidth);
  const maximum = metersPerPixel * maxWidth / unitSize;
  const power = 10 ** Math.floor(Math.log10(maximum));
  const value = ([5, 2, 1].find(step => step * power <= maximum) ?? 1) * power;
  const measurePixels = value * unitSize / metersPerPixel;
  const labelNumber = value >= 1e6 ? compactNumber : number;
  return { label: `${labelNumber.format(value)} ${unit}`, pixels: maxWidth, measurePixels };
}
