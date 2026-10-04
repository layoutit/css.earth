import { requireRecord, requireFiniteNumber } from '@cssearth/core';

export const DISPLAY_ORIENTATION_SCHEMA = 'cssearth-display-orientation@1';
export interface DisplayOrientation {
  readonly schema: typeof DISPLAY_ORIENTATION_SCHEMA;
  readonly rightAscensionDegrees: number;
  readonly declinationDegrees: number;
  readonly displayMeridianDegrees: number;
  readonly phase: 'arbitrary-display-phase';
  readonly qualification: string;
  readonly source?: string;
  readonly coordinateSystem?: string;
}

/** Observed poles historically share these field checks but additionally require a positive period.
 * Their schema routing and epoch-dependent evaluation remain with the caller. */
export function parseAuthoredOrientation(value: unknown, { observed = false }: { observed?: boolean } = {}) {
  const source = requireRecord(value, 'Rotation source');
  const rightAscension = requireFiniteNumber(source.rightAscensionDegrees), declination = requireFiniteNumber(source.declinationDegrees), meridian = requireFiniteNumber(source.displayMeridianDegrees);
  const periodHours = observed ? requireFiniteNumber(source.periodHours) : 0;
  if ((!observed && source.schema !== DISPLAY_ORIENTATION_SCHEMA) || source.phase !== 'arbitrary-display-phase' ||
      ![rightAscension, declination, meridian].every(Number.isFinite) ||
      (observed && (!Number.isFinite(periodHours) || periodHours <= 0)) ||
      (!observed && (typeof source.qualification !== 'string' || !source.qualification.trim())) ||
      Math.abs(declination) > 90) throw new TypeError('Invalid authored orientation source.');
  return { rightAscensionDegrees: rightAscension, declinationDegrees: declination, displayMeridianDegrees: meridian, periodHours };
}
