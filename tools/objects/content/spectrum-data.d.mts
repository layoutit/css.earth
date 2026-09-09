import type { ChartAssetRecipe } from './charts';

export function readSpectrumData(
  sourceDirectory: string,
  chart: Extract<ChartAssetRecipe['charts'][number], { kind: 'spectrum' }>,
): Promise<{
  points: { wavelength: number; total: number }[];
  maximum: number;
  metadata: Record<string, unknown>;
}>;
