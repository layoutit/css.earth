// Compact preparation-time fit of slow longitude libration. Frequencies and
// amplitudes come from the source samples; no body-specific resonance is assumed.
export function fitLibration(days, values, line, count = 3) {
  const middle = (days[0] + days.at(-1)) / 2, span = days.at(-1) - days[0];
  const times = days.map(d => d - middle);
  const residual = values.map((v, i) => v - line.intercept - line.slope * days[i]);
  const frequencies = [];
  function solve(rates) {
    const columns = [times.map(() => 1), times.map(t => t / span)];
    for (const w of rates) columns.push(times.map(t => Math.cos(w * t)), times.map(t => Math.sin(w * t)));
    const n = columns.length;
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const matrix = columns.map(a => [...columns.map(b => dot(a, b)), dot(a, residual)]);
    for (let k = 0; k < n; k++) {
      let pivot = k;
      for (let j = k + 1; j < n; j++) if (Math.abs(matrix[j][k]) > Math.abs(matrix[pivot][k])) pivot = j;
      [matrix[k], matrix[pivot]] = [matrix[pivot], matrix[k]];
      const scale = matrix[k][k];
      if (Math.abs(scale) < 1e-10) return { error: Infinity };
      for (let j = k; j <= n; j++) matrix[k][j] /= scale;
      for (let i = 0; i < n; i++) if (i !== k) {
        const factor = matrix[i][k];
        for (let j = k; j <= n; j++) matrix[i][j] -= factor * matrix[k][j];
      }
    }
    const coefficients = matrix.map(row => row[n]);
    const error = residual.reduce((sum, v, i) => sum + (v - columns.reduce((s, col, k) => s + col[i] * coefficients[k], 0)) ** 2, 0);
    return { error, coefficients };
  }
  const step = 2 * Math.PI / span / 6, low = 2 * Math.PI / span, high = 2 * Math.PI / 40;
  function refine(index, guess) {
    const phi = (Math.sqrt(5) - 1) / 2;
    let lo = Math.max(low, guess - step), hi = Math.min(high, guess + step);
    const error = w => solve(frequencies.map((v, i) => i === index ? w : v)).error;
    let a = hi - phi * (hi - lo), b = lo + phi * (hi - lo);
    for (let j = 0; j < 30; j++) {
      if (error(a) < error(b)) { hi = b; b = a; a = hi - phi * (hi - lo); }
      else { lo = a; a = b; b = lo + phi * (hi - lo); }
    }
    frequencies[index] = (lo + hi) / 2;
  }
  for (let k = 0; k < count; k++) {
    let best = low, error = Infinity;
    for (let w = low; w <= high; w += step) {
      const fit = solve([...frequencies, w]);
      if (fit.error < error) { error = fit.error; best = w; }
    }
    frequencies.push(best);
    for (let pass = 0; pass < 4; pass++) for (let i = 0; i <= k; i++) refine(i, frequencies[i]);
  }
  const { coefficients: c } = solve(frequencies);
  return {
    intercept: line.intercept + c[0] - c[1] * middle / span,
    slope: line.slope + c[1] / span,
    harmonics: frequencies.map((rateRadPerDay, i) => ({ rateRadPerDay,
      cosineRad: c[2 + i * 2], sineRad: c[3 + i * 2], epochJdTt: 2451545 + middle })),
  };
}
