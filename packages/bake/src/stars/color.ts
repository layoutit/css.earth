import type { PointFieldRgb } from '@cssearth/objects';
import { temperatureColor } from '@cssearth/engine';
import type { StarsRecipe } from './types.ts';

export function palette(config: StarsRecipe['colors']): readonly PointFieldRgb[] {
  return Array.from({ length: config.count }, (_, i) => temperatureColor(config.minimumTemperatureK * (config.maximumTemperatureK / config.minimumTemperatureK) ** (i / (config.count - 1))));
}
export function nearestColor(rgb: PointFieldRgb, colors: readonly PointFieldRgb[]): number {
  let best = 0, error = Infinity;
  colors.forEach((color, index) => { const distance = (color[0]-rgb[0])**2 + (color[1]-rgb[1])**2 + (color[2]-rgb[2])**2; if (distance < error) { best = index; error = distance; } });
  return best;
}
