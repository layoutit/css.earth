/** Legend labels of a palette lens are derived, not typed: the display stretch runs from the report's low to high cast value,
 * so the labels are that span as a fraction of the brightest displayed point, at its low end, midpoint and top (two decimals).
 * Write mode refreshes them in the object's content record; check mode refuses labels that no longer match the report. */
import { isRecord } from '../sources/source-values.mts';

export interface LegendLabelChange { readonly lensId: string; readonly authored: readonly string[] | null; readonly derived: readonly string[] }

/** The stretch a surface's report states, from the density-1 interpretation (every density shares one stretch). */
function reportStretch(surface: unknown): { low: number; high: number } | null {
  if (!isRecord(surface) || !isRecord(surface.interpretation)) return null;
  const first = Object.keys(surface.interpretation).sort()[0];
  const display = first === undefined ? null : (surface.interpretation as Record<string, unknown>)[first];
  const stretch = isRecord(display) && isRecord(display.display) ? display.display : null;
  if (!stretch || typeof stretch.low !== 'number' || typeof stretch.high !== 'number' || !(stretch.high > stretch.low) || !(stretch.low > 0)) return null;
  return { low: stretch.low, high: stretch.high };
}

export function derivedLegendLabels(low: number, high: number): string[] {
  const floor = low / high;
  return [floor.toFixed(2), ((1 + floor) / 2).toFixed(2), '1.00'];
}

/** Compare every palette legend in a content record with the prepared raster report; return the lenses whose labels differ. */
export function legendLabelChanges(content: unknown, raster: unknown): LegendLabelChange[] {
  if (!isRecord(content) || !isRecord(content.lenses) || !Array.isArray(content.lenses.controls) || !isRecord(raster) || !isRecord(raster.surfaces)) return [];
  const changes: LegendLabelChange[] = [];
  for (const control of content.lenses.controls) {
    if (!isRecord(control) || typeof control.id !== 'string' || !isRecord(control.legend) || !isRecord(control.legend.recipe) || !Array.isArray(control.legend.recipe.palette)) continue;
    const stretch = reportStretch((raster.surfaces as Record<string, unknown>)[control.id]);
    if (!stretch) continue;
    const derived = derivedLegendLabels(stretch.low, stretch.high);
    const authored = Array.isArray(control.legend.labels) ? control.legend.labels.map(String) : null;
    const recipeLabels = Array.isArray(control.legend.recipe.labels) ? control.legend.recipe.labels.map(String) : null;
    if (JSON.stringify(authored) !== JSON.stringify(derived) || JSON.stringify(recipeLabels) !== JSON.stringify(derived)) changes.push({ lensId: control.id, authored, derived });
  }
  return changes;
}

/** The content record with derived labels written into both the legend and its recipe. */
export function withDerivedLegendLabels(content: Record<string, unknown>, changes: readonly LegendLabelChange[]) {
  const byLens = new Map(changes.map(change => [change.lensId, change.derived]));
  const lenses = content.lenses as { controls: Record<string, unknown>[] };
  return { ...content, lenses: { ...lenses, controls: lenses.controls.map(control => {
    const derived = byLens.get(String(control.id));
    if (!derived) return control;
    const legend = control.legend as Record<string, unknown>;
    return { ...control, legend: { ...legend, labels: [...derived], recipe: { ...(legend.recipe as Record<string, unknown>), labels: [...derived] } } };
  }) } };
}
