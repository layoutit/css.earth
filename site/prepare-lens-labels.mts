// Shared UI vocabulary. Packages select names from their source meaning;
// runtime IDs such as "normal" or "surface" do not determine that meaning.
export const LENS_LABELS = Object.freeze({
  visibleColor: "Visible color",
  monochrome: "Monochrome",
  enhancedColor: "Enhanced color",
  elevation: "Elevation",
  thermalInfrared: "Thermal infrared",
  crossSection: "Cross section",
  ultraviolet: "Ultraviolet",
  methane: "Methane",
  nearInfrared: "Near infrared",
});

// Preparation only: preserve IDs, assets, legends, and source descriptions.
// New concepts can keep a package-owned label without extending a fixed enum.
export function prepareLensLabels<T extends { id: string; label: string }, L extends { controls: readonly T[] }>(lenses: L, labels: Readonly<Record<string, string>>) {
  return {
    ...lenses,
    controls: lenses.controls.map(lens => {
      const label = labels[lens.id] ?? lens.label;
      return { ...lens, label };
    }),
  };
}
