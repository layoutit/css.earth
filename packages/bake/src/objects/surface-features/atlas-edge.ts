/** Where a prepared equirectangular map's left edge sits in east longitude, measured against its georeferenced source.
 * `sample` reads the source at a true east longitude and latitude (a native photograph sampler); `image` is a greyscale copy
 * of the prepared map whose left edge is unknown. Each candidate edge reads the map at (longitude − edge) and correlates it
 * with the source; the edge with the highest correlation is where the map actually starts. */
export interface AtlasEdgeMeasurement {
  readonly edgeDeg: number;
  readonly correlation: number;
  /** Correlation when the map is read from `expectedDeg`. */
  readonly expectedCorrelation: number;
  readonly samples: number;
}

export function measureAtlasLeftEdge(sample: (longitudeDeg: number, latitudeDeg: number) => number | null,
  image: { readonly data: ArrayLike<number>; readonly width: number; readonly height: number }, expectedDeg: number,
  { stepDeg = 2, latitudeLimitDeg = 60, gridDeg = 1.5 } = {}): AtlasEdgeMeasurement {
  const { data, width, height } = image;
  if (data.length !== width * height || width < 2 || height < 2) throw new TypeError(`Atlas edge image must be ${width} × ${height} greyscale.`);
  const source: number[] = [], rows: number[] = [], longitudes: number[] = [];
  for (let latitude = -latitudeLimitDeg; latitude <= latitudeLimitDeg; latitude += gridDeg) {
    for (let longitude = gridDeg / 2; longitude < 360; longitude += gridDeg) {
      const value = sample(longitude, latitude);
      if (value === null || !Number.isFinite(value)) continue;
      source.push(value); longitudes.push(longitude); rows.push(Math.min(height - 1, Math.floor((90 - latitude) / 180 * height)) * width);
    }
  }
  const correlationAt = (edge: number) => {
    const n = source.length; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      const column = Math.floor(((((longitudes[i]! - edge) % 360) + 360) % 360) / 360 * width) % width;
      const x = source[i]!, y = data[rows[i]! + column]!;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
    const covariance = sxy - sx * sy / n, spread = Math.sqrt((sxx - sx * sx / n) * (syy - sy * sy / n));
    return spread > 0 ? covariance / spread : 0;
  };
  let best = { edgeDeg: 0, correlation: -Infinity };
  for (let edge = 0; edge < 360; edge += stepDeg) {
    const correlation = correlationAt(edge);
    if (correlation > best.correlation) best = { edgeDeg: edge, correlation };
  }
  return Object.freeze({ ...best, expectedCorrelation: correlationAt(expectedDeg), samples: source.length });
}

/** The circular distance between two longitudes, in degrees (0–180). */
export function longitudeDistanceDeg(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
}
