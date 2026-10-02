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
 * Index catalogue positions in radius-wide cells and query their 3x3 neighbours.
 * This deliberately retains the unwrapped RA cells and distance of issue #1151.
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
  const cell = (raDeg: number, decDeg: number): readonly [number, number] => [
    Math.floor(decDeg / radiusDeg),
    Math.floor(raDeg * Math.cos(decDeg * Math.PI / 180) / radiusDeg),
  ];
  for (const positionDeg of positionsDeg) {
    if (!Array.isArray(positionDeg) || positionDeg.length !== 2) {
      throw new TypeError('Catalogue positions must be RA/declination pairs in degrees.');
    }
    const [raDeg, decDeg] = positionDeg;
    validatePositionDeg(raDeg, decDeg);
    const key = cell(raDeg, decDeg).join(',');
    cells.set(key, [...cells.get(key) ?? [], [raDeg, decDeg]]);
  }
  return (raDeg, decDeg) => {
    validatePositionDeg(raDeg, decDeg);
    const [y, x] = cell(raDeg, decDeg);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const [fieldRaDeg, fieldDecDeg] of cells.get(`${y + dy},${x + dx}`) ?? []) {
        const distanceDeg = Math.hypot((raDeg - fieldRaDeg) * Math.cos(decDeg * Math.PI / 180), decDeg - fieldDecDeg);
        if (comparison === 'arcseconds' ? 3600 * distanceDeg <= matchArcsec : distanceDeg <= radiusDeg) return true;
      }
    }
    return false;
  };
}
