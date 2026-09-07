// Numeric source intervals use the shell's existing segmented scale. Keep each
// original range label and color; equal-width segments require equal intervals.
export function prepareRangeLegend({title, units, ranges}) {
  const unique = new Map();
  for (const range of ranges) {
    if (!Number.isFinite(range.low) || !Number.isFinite(range.high) || range.high <= range.low ||
        !range.label || !/^rgb\((?:\d{1,3},){2}\d{1,3}\)$/u.test(range.color) ||
        range.color.match(/\d+/gu).some(value => +value > 255)) throw new Error('Invalid source legend interval.');
    const key = `${range.low}:${range.high}`, previous = unique.get(key);
    if (previous && (previous.label !== range.label || previous.color !== range.color)) throw new Error('Source legend interval is inconsistent.');
    unique.set(key, range);
  }
  const ordered = [...unique.values()].sort((a,b) => a.low - b.low);
  if (!ordered.length || ordered.length > 16) throw new Error('Source legend exceeds retained capacity.');
  const step = ordered[0].high - ordered[0].low;
  if (ordered.some((range, i) => range.high - range.low !== step || i > 0 && range.low !== ordered[i - 1].high)) {
    throw new Error('A segmented scale requires contiguous equal source intervals.');
  }
  return {kind: 'scale', title, meta: units,
    labels: [String(ordered[0].low), String(ordered.at(-1).high)],
    items: ordered.map(({label,color}) => ({label,color}))};
}
