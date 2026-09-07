import type { Rgb, StarsRecipe } from './types.js';
/** The existing catalogue presentation's Tanner Helland fit; RGB is display-space, not spectral radiance. */
export function temperatureColor(kelvin: number): Rgb {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return [byte(t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592),
    byte(t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492),
    byte(t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)];
}
export function catalogueColor(kelvin: number, colorIndexBv: number): Rgb {
  if (Number.isFinite(kelvin)) return temperatureColor(kelvin);
  if (!Number.isFinite(colorIndexBv)) return [255, 255, 255];
  const bv = Math.min(4, Math.max(-.4, colorIndexBv));
  return temperatureColor(4600 * (1 / (.92*bv + 1.7) + 1 / (.92*bv + .62)));
}
export function palette(config: StarsRecipe['colors']): readonly Rgb[] {
  return Array.from({ length: config.count }, (_, i) => temperatureColor(config.minimumTemperatureK * (config.maximumTemperatureK / config.minimumTemperatureK) ** (i / (config.count - 1))));
}
export function nearestColor(rgb: Rgb, colors: readonly Rgb[]): number {
  let best = 0, error = Infinity;
  colors.forEach((color, index) => { const distance = (color[0]-rgb[0])**2 + (color[1]-rgb[1])**2 + (color[2]-rgb[2])**2; if (distance < error) { best = index; error = distance; } });
  return best;
}
