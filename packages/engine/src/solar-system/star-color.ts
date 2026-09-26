/** A star's display colour: display-space sRGB bytes, not spectral radiance. */
export type StarRgb = readonly [number, number, number];
/** The existing catalogue presentation's Tanner Helland fit; RGB is display-space, not spectral radiance. */
export function temperatureColor(kelvin: number): StarRgb {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return [byte(t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592),
    byte(t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492),
    byte(t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307)];
}
export function catalogueColor(kelvin: number, colorIndexBv: number): StarRgb {
  if (Number.isFinite(kelvin)) return temperatureColor(kelvin);
  if (!Number.isFinite(colorIndexBv)) return [255, 255, 255];
  const bv = Math.min(4, Math.max(-.4, colorIndexBv));
  return temperatureColor(4600 * (1 / (.92*bv + 1.7) + 1 / (.92*bv + .62)));
}
