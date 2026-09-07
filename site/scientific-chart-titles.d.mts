export interface ScientificChartTitle {
  readonly label: string;
  readonly src?: string;
  readonly width?: number;
  readonly height?: number;
}

export const SCIENTIFIC_CHART_TITLES: Readonly<Record<string, ScientificChartTitle>>;
