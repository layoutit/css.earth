/**
 * A catalogue point bank's dots darkened, and optionally sized, by each object's absolute magnitude
 * (packages/bake/cli/prepare-catalogue-points.mts `appearance.toneBy` and `appearance.sizeBy`).
 */

/** Each dot's tone from its absolute magnitude, in `steps` from full at `brightMagnitude` to `faintTone` at `faintMagnitude`. */
export interface CatalogueToneBy { readonly brightMagnitude: number; readonly faintMagnitude: number; readonly faintTone: number;
  readonly steps: number; readonly band: string; readonly basis: string }
/**
 * Each dot's radius from its rank by the same magnitude among the dots at about its distance: the bank splits into `shells`
 * of equal count by distance from the Sun, and within its shell a dot takes the first tier (brightest first) whose
 * `brightestShare` its rank falls within, or `radiusPx` below every tier or without a magnitude. A survey reaches only
 * luminous objects far away, so ranking over the whole bank would make the far dots the large ones; within shells every
 * depth has the same mix of sizes.
 */
export interface CatalogueSizeBy { readonly shells: number; readonly tiers: readonly { readonly brightestShare: number; readonly radiusPx: number }[];
  readonly radiusPx: number; readonly basis: string }

/** Refuses a tone that is not a band, rising magnitudes, a faint tone in (0, 1), 2 to 16 steps and a basis. */
export function checkCatalogueToneBy(toneBy: CatalogueToneBy, where: string): void {
  if (typeof toneBy.band !== 'string' || !(toneBy.faintMagnitude > toneBy.brightMagnitude) || !(toneBy.faintTone > 0 && toneBy.faintTone < 1)
    || !Number.isInteger(toneBy.steps) || toneBy.steps < 2 || toneBy.steps > 16 || typeof toneBy.basis !== 'string' || !toneBy.basis) {
    throw new TypeError(`${where} needs a magnitude column and its band, faint > bright magnitudes, a faint tone in (0, 1), 2 to 16 steps and a basis.`);
  }
}

/** Refuses sizes without a tone to read magnitudes from, a shell count below one, or tiers that are not brightest first
 * (rising shares in (0, 1), falling radii above the faintest). */
export function checkCatalogueSizeBy(sizeBy: CatalogueSizeBy, toneBy: CatalogueToneBy | undefined, where: string): void {
  if (!toneBy || !Number.isInteger(sizeBy.shells) || sizeBy.shells < 1 || !Array.isArray(sizeBy.tiers) || !sizeBy.tiers.length || !(sizeBy.radiusPx > 0)
    || typeof sizeBy.basis !== 'string' || !sizeBy.basis
    || !sizeBy.tiers.every((tier, index, all) => tier.brightestShare > (all[index - 1]?.brightestShare ?? 0) && tier.brightestShare < 1
      && tier.radiusPx > (all[index + 1]?.radiusPx ?? sizeBy.radiusPx))) {
    throw new TypeError(`${where} needs toneBy's magnitudes, a whole number of shells, tiers brightest first (rising brightestShare in (0, 1), falling radiusPx above the faintest radiusPx) and a basis, got ${JSON.stringify(sizeBy)}.`);
  }
}

/** Each dot's size tier (an index into `sizeBy.tiers`, or its length for the faintest) by its magnitude's rank in its distance shell. */
function sizeTiers(sizeBy: CatalogueSizeBy, magnitudes: readonly (number | null)[], distances: readonly number[]): number[] {
  if (distances.length !== magnitudes.length || !distances.every(Number.isFinite)) throw new RangeError(`Sizing needs a finite distance for each of ${magnitudes.length} dots.`);
  const tiers = magnitudes.map(() => sizeBy.tiers.length), byDistance = magnitudes.map((_, index) => index).sort((a, b) => distances[a]! - distances[b]! || a - b);
  for (let shell = 0; shell < sizeBy.shells; shell++) {
    const members = byDistance.slice(Math.floor(shell * byDistance.length / sizeBy.shells), Math.floor((shell + 1) * byDistance.length / sizeBy.shells));
    const ranked = members.filter(index => Number.isFinite(magnitudes[index])).sort((a, b) => magnitudes[a]! - magnitudes[b]! || a - b);
    // A dot's share is the part of its shell brighter than it, dots without a magnitude counted among the faint.
    ranked.forEach((index, rank) => {
      const found = sizeBy.tiers.findIndex(tier => rank / members.length < tier.brightestShare);
      tiers[index] = found < 0 ? sizeBy.tiers.length : found;
    });
  }
  return tiers;
}

/**
 * Pairs each dot's base color with its tone (and size): a palette entry is a (color, tone) or (color, tone, size)
 * combination, in order of first use. The color stays the base color; `paletteTone` says how dark and `paletteRadiusPx`
 * how large. A dot without a magnitude takes the faintest tone and size.
 */
export function toneCataloguePalette({ basePalette, baseIndices, magnitudes, distances, toneBy, sizeBy }: { readonly basePalette: readonly string[];
  readonly baseIndices: readonly number[]; readonly magnitudes: readonly (number | null)[]; readonly distances?: readonly number[];
  readonly toneBy: CatalogueToneBy; readonly sizeBy?: CatalogueSizeBy }) {
  const step = (magnitude: number | null) => magnitude === null || !Number.isFinite(magnitude) ? toneBy.steps - 1
    : Math.round(Math.max(0, Math.min(1, (magnitude - toneBy.brightMagnitude) / (toneBy.faintMagnitude - toneBy.brightMagnitude))) * (toneBy.steps - 1));
  const tiers = sizeBy ? sizeTiers(sizeBy, magnitudes, distances ?? []) : null;
  const combos = new Map<string, number>(), palette: string[] = [], paletteTone: number[] = [], paletteRadiusPx: number[] = [];
  const indices = baseIndices.map((base, index) => {
    const magnitude = magnitudes[index] ?? null, toneStep = step(magnitude), sizeTier = tiers?.[index] ?? 0, key = `${base},${toneStep},${sizeTier}`;
    if (!combos.has(key)) {
      const color = basePalette[base];
      if (color === undefined) throw new RangeError(`Dot ${index} names base color ${base} of a ${basePalette.length}-color palette.`);
      combos.set(key, palette.length); palette.push(color);
      paletteTone.push(Number((1 - toneStep / (toneBy.steps - 1) * (1 - toneBy.faintTone)).toFixed(4)));
      if (sizeBy) paletteRadiusPx.push(sizeBy.tiers[sizeTier]?.radiusPx ?? sizeBy.radiusPx);
    }
    return combos.get(key)!;
  });
  return { palette, paletteTone, ...(sizeBy ? { paletteRadiusPx } : {}), indices };
}
