export interface Statistics {
  readonly samples: number; readonly both: number; readonly identical: number;
  readonly onlyFirst: number; readonly onlySecond: number; readonly identicalShare: number | null;
  readonly medianLevel: number; readonly medianAbsoluteDifferenceOverMedian: number | null;
  readonly aboveMedian: { readonly samples: number; readonly correlation: number | null;
    readonly relativeDifference: { readonly median: number; readonly p99: number; readonly largest: number } | null };
}

const quantile = (sorted: Float32Array | Float64Array, q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? Number.NaN;

/** Two equal-length sample runs compared: counts, bit-identity, and how far the rest are apart. Walked twice, so a caller
 * that streams reads its samples twice and holds only what it is reading. */
export async function sampleStatistics(walk: (visit: (first: number, second: number) => void) => Promise<void> | void, count: number, precision: Float32ArrayConstructor | Float64ArrayConstructor = Float64Array): Promise<Statistics> {
  const levels = new precision(count), differences = new precision(count);
  let both = 0, identical = 0, onlyFirst = 0, onlySecond = 0;
  await walk((first, second) => {
    const a = Number.isFinite(first), b = Number.isFinite(second);
    if (a && b) { if (first === second) identical++; levels[both] = Math.abs(second); differences[both] = Math.abs(first - second); both++; }
    else if (a) onlyFirst++; else if (b) onlySecond++;
  });
  const median = quantile(levels.subarray(0, both).slice().sort(), 0.5);
  const medianDifference = quantile(differences.subarray(0, both).slice().sort(), 0.5);
  let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, n = 0;
  const relative = differences;
  await walk((first, second) => {
    if (!Number.isFinite(first) || !Number.isFinite(second) || Math.abs(second) <= median) return;
    sa += first; sb += second; saa += first * first; sbb += second * second; sab += first * second;
    relative[n++] = Math.abs(first - second) / Math.abs(second);
  });
  const sorted = relative.subarray(0, n).slice().sort();
  return { samples: count, both, identical, onlyFirst, onlySecond, identicalShare: both ? identical / both : null,
    medianLevel: median, medianAbsoluteDifferenceOverMedian: median ? medianDifference / median : null,
    aboveMedian: { samples: n, correlation: n > 1 ? (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)) : null,
      relativeDifference: n ? { median: quantile(sorted, 0.5), p99: quantile(sorted, 0.99), largest: quantile(sorted, 1) } : null } };
}
