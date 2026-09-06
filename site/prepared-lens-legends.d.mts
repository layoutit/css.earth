export interface PreparedLensLegend {
  readonly kind: "scale" | "categories";
  readonly title: string;
  readonly meta?: string;
  readonly src?: string;
  readonly colors?: readonly string[];
  readonly labels?: readonly string[];
  readonly items?: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    readonly color: string;
  }>;
  readonly sourceUrl?: string;
}

export function prepareLensScaleLegend(input: {
  title: string;
  palette: readonly (readonly number[])[];
  labels?: readonly string[];
  meta?: string;
  sourceUrl?: string;
}): PreparedLensLegend;

export function prepareLensCategoryLegend(input: {
  title: string;
  items: ReadonlyArray<{
    readonly label: string;
    readonly description: string;
    readonly color: string | readonly number[];
  }>;
  meta?: string;
  sourceUrl?: string;
}): PreparedLensLegend;
