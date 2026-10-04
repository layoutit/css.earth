import { limbIntensity, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const PUBLISHED_LIMB_DARKENING_SCHEMA = 'cssearth-published-limb-darkening@1';

/** A paper's cited coefficients; physical evaluation and grid interpolation remain with bake. */
export type PublishedLimbCoefficient = { readonly value: number; readonly fixed: string }
  | { readonly value: number; readonly uncertainty: number; readonly cell: string };
export type PublishedLimbDarkening = {
  readonly schema: typeof PUBLISHED_LIMB_DARKENING_SCHEMA; readonly source: string; readonly band: string;
} & ({ readonly law: 'power'; readonly alpha: PublishedLimbCoefficient; readonly basis?: 'fit' | 'model-prior' }
  | { readonly law?: string; readonly u1: PublishedLimbCoefficient; readonly u2: PublishedLimbCoefficient; readonly basis?: 'transit-fit' | 'model-prior' });

export type LimbLaw =
  | { readonly law: 'quadratic'; readonly u1: number; readonly u2: number; readonly u1Bounds: readonly [number, number]; readonly u2Bounds: readonly [number, number]; readonly basis?: 'transit-fit' | 'model-prior' }
  | { readonly law: 'power'; readonly alpha: number; readonly alphaBounds: readonly [number, number]; readonly basis?: 'fit' | 'model-prior' };

/** A law must keep the limb between dark and the centre brightness. A spherical model's law may fall below zero before the edge: the
 * extended atmosphere is dark there, and the law is drawn held at zero (`darkEdge`); only spherical grids pass it. */
export function checkLimbLaw(law: LimbLaw | { readonly u1: number; readonly u2: number }, { darkEdge = false }: { darkEdge?: boolean } = {}): void {
  const edge = limbIntensity(0, law);
  if (!((edge >= 0 || darkEdge) && edge <= 1) || ('law' in law && law.law === 'power' && !(law.alpha >= 0)))
    throw new TypeError('The limb-darkening law must keep the limb between dark and the centre brightness.');
}

/** A power law transcribed from a paper (cssearth-published-limb-darkening@1 with `law: "power"`): alpha, its uncertainty or the
 * model it was fixed to, the band and the quoted cell. */
export function readPublishedPowerLaw(value: unknown): Extract<LimbLaw, { law: 'power' }> {
  const record = requireRecord(value, 'published limb darkening');
  if (record.schema !== PUBLISHED_LIMB_DARKENING_SCHEMA || record.law !== 'power') throw new TypeError('A published power law is a cssearth-published-limb-darkening@1 record with law "power".');
  requireString(record.source, 'source'); requireString(record.band, 'band');
  const alpha = requireRecord(record.alpha, 'alpha'), value2 = requireFiniteNumber(alpha.value, 'alpha.value');
  if (alpha.fixed !== undefined) { requireString(alpha.fixed, 'alpha.fixed'); return { law: 'power', alpha: value2, alphaBounds: [value2, value2], basis: 'model-prior' }; }
  const sigma = requireFiniteNumber(alpha.uncertainty, 'alpha.uncertainty'); requireString(alpha.cell, 'alpha.cell');
  const law = { law: 'power' as const, alpha: value2, alphaBounds: [value2 - sigma, value2 + sigma] as const, basis: 'fit' as const };
  checkLimbLaw(law);
  return law;
}

/** A transcription record (cssearth-published-limb-darkening@1): u1 and u2 with their one-sigma uncertainties, the band, the
 * source and the quoted cells. A coefficient the paper fixed to a model says so in `fixed`, and carries no uncertainty. */
export function readPublishedLimbDarkening(value: unknown): Extract<LimbLaw, { law: 'quadratic' }> {
  const record = requireRecord(value, 'published limb darkening');
  if (record.schema !== PUBLISHED_LIMB_DARKENING_SCHEMA) throw new TypeError('Published limb darkening must use cssearth-published-limb-darkening@1.');
  requireString(record.source, 'source'); requireString(record.band, 'band');
  if (record.basis !== undefined && record.basis !== 'transit-fit' && record.basis !== 'model-prior') throw new TypeError('Published limb-darkening basis must be transit-fit or model-prior.');
  const coefficient = (key: 'u1' | 'u2') => {
    const entry = requireRecord(record[key], key), value = requireFiniteNumber(entry.value, `${key}.value`);
    if (entry.fixed !== undefined) { requireString(entry.fixed, `${key}.fixed`); return { value, bounds: [value, value] as const }; }
    const sigma = requireFiniteNumber(entry.uncertainty, `${key}.uncertainty`); requireString(entry.cell, `${key}.cell`);
    return { value, bounds: [value - sigma, value + sigma] as const };
  };
  const u1 = coefficient('u1'), u2 = coefficient('u2');
  checkLimbLaw({ u1: u1.value, u2: u2.value });
  return { law: 'quadratic', u1: u1.value, u2: u2.value, u1Bounds: u1.bounds, u2Bounds: u2.bounds,
    ...(record.basis === undefined ? {} : { basis: record.basis }) };
}
