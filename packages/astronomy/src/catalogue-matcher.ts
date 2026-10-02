/** Catalogue-edge coordinates in degrees, preserving the legacy matching arithmetic. */
export type RaDecDeg = readonly [raDeg: number, decDeg: number];

/** Multiplying the distance before comparison can change rounding at the boundary. */
export type CatalogueMatchComparison = 'degrees' | 'arcseconds';

function validatePositionDeg(raDeg: number, decDeg: number): void {
  // Non-finite numbers were accepted by every authoring copy and never matched.
  if (typeof raDeg !== 'number' || typeof decDeg !== 'number') {
    throw new TypeError('Catalogue RA and declination must be numbers in degrees.');
  }
}

/**
 * Index catalogue positions in radius-high declination bands, each cut into RA
 * cells at least one match radius wide on the sky, and query the neighbouring
 * bands and cells. RA wraps at 360 degrees in both the cells and the distance.
 * Degrees remain at this catalogue boundary to retain exact arithmetic order.
 */
export function createRaDecCatalogueMatcher(
  positionsDeg: readonly RaDecDeg[],
  matchArcsec: number,
  comparison: CatalogueMatchComparison = 'degrees',
): (raDeg: number, decDeg: number) => boolean {
  if (!Array.isArray(positionsDeg)) throw new TypeError('Catalogue positions must be an array.');
  if (typeof matchArcsec !== 'number' || !Number.isFinite(matchArcsec) || matchArcsec <= 0) {
    throw new TypeError('Catalogue match radius must be finite and positive in arcseconds.');
  }
  if (comparison !== 'degrees' && comparison !== 'arcseconds') {
    throw new TypeError('Catalogue match comparison must be degrees or arcseconds.');
  }
  const radiusDeg = matchArcsec / 3600;
  const cells = new Map<string, RaDecDeg[]>();
  const band = (decDeg: number): number => Math.floor(decDeg / radiusDeg);
  // A query looks one band up and down, so a band's cells must be wide enough
  // for the highest latitude of that three-band neighbourhood.
  const raCellCounts = new Map<number, number>();
  const raCellCount = (y: number): number => {
    let count = raCellCounts.get(y);
    if (count === undefined) {
      const highestDecDeg = Math.min(90, Math.max(Math.abs((y - 1) * radiusDeg), Math.abs((y + 2) * radiusDeg)));
      count = Math.max(1, Math.floor(360 * Math.cos(highestDecDeg * Math.PI / 180) / radiusDeg));
      raCellCounts.set(y, count);
    }
    return count;
  };
  const raCell = (raDeg: number, count: number): number =>
    Math.min(count - 1, Math.floor((raDeg % 360 + 360) % 360 / 360 * count));
  for (const positionDeg of positionsDeg) {
    if (!Array.isArray(positionDeg) || positionDeg.length !== 2) {
      throw new TypeError('Catalogue positions must be RA/declination pairs in degrees.');
    }
    const [raDeg, decDeg] = positionDeg;
    validatePositionDeg(raDeg, decDeg);
    const y = band(decDeg);
    const key = `${y},${raCell(raDeg, raCellCount(y))}`;
    const members = cells.get(key);
    if (members) members.push([raDeg, decDeg]);
    else cells.set(key, [[raDeg, decDeg]]);
  }
  return (raDeg, decDeg) => {
    validatePositionDeg(raDeg, decDeg);
    const y = band(decDeg);
    for (let dy = -1; dy <= 1; dy++) {
      const count = raCellCount(y + dy);
      const x = raCell(raDeg, count);
      // Bands at the poles have fewer than three cells; visit each once.
      for (let dx = count < 3 ? 0 : -1; dx <= (count < 3 ? count - 1 : 1); dx++) {
        const neighbour = count < 3 ? dx : (x + dx + count) % count;
        for (const [fieldRaDeg, fieldDecDeg] of cells.get(`${y + dy},${neighbour}`) ?? []) {
          let raDifferenceDeg = raDeg - fieldRaDeg;
          if (raDifferenceDeg > 180) raDifferenceDeg -= 360;
          else if (raDifferenceDeg < -180) raDifferenceDeg += 360;
          const distanceDeg = Math.hypot(raDifferenceDeg * Math.cos(decDeg * Math.PI / 180), decDeg - fieldDecDeg);
          if (comparison === 'arcseconds' ? 3600 * distanceDeg <= matchArcsec : distanceDeg <= radiusDeg) return true;
        }
      }
    }
    return false;
  };
}
