export const SCIENTIFIC_CHART_ORDER = Object.freeze([
  "reflectance",
  "temperature-pressure",
  "photometric-phase",
]);

const CHART_RANK = new Map(
  SCIENTIFIC_CHART_ORDER.map((id, index) => [id, index]),
);

export function orderScientificCharts(charts) {
  if (!Array.isArray(charts)) {
    throw new TypeError("Scientific charts must be an array.");
  }
  return charts
    .map((chart, index) => ({ chart, index }))
    .sort((left, right) => {
      const leftRank = CHART_RANK.get(left.chart?.id) ?? Infinity;
      const rightRank = CHART_RANK.get(right.chart?.id) ?? Infinity;
      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ chart }) => chart);
}
