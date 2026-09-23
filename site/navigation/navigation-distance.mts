import { parseDistanceSubject } from '../../packages/catalog/src/spatial-relations.ts';
import type { DistanceSubject } from '../../packages/catalog/src/spatial-relations.ts';
import { record } from '../browser-types.mts';

/** Display and sort values are prepared together; catalogue epochs are not measurement epochs. */
export interface NavigationDistance {
  readonly meters: number;
  readonly value: number;
  readonly unit: 'AU' | 'pc';
  readonly quantity: 'geometric' | 'catalogue' | 'comoving';
  readonly referencePoint: 'heliocentre' | 'observer';
  readonly epochJdTt: number | null;
  readonly subject?: DistanceSubject;
}

export function parseNavigationDistance(input: unknown): NavigationDistance {
  if (!record(input) || Object.keys(input).some(key => !['meters', 'value', 'unit', 'quantity', 'referencePoint', 'epochJdTt', 'subject'].includes(key)) ||
      typeof input.meters !== 'number' || !Number.isFinite(input.meters) || input.meters < 0 ||
      typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value < 0 ||
      (input.unit !== 'AU' && input.unit !== 'pc') || (input.quantity !== 'geometric' && input.quantity !== 'catalogue' && input.quantity !== 'comoving') ||
      (input.referencePoint !== 'heliocentre' && input.referencePoint !== 'observer') ||
      !(input.epochJdTt === null || typeof input.epochJdTt === 'number' && Number.isFinite(input.epochJdTt)) ||
      // A geometric distance is heliocentric at its epoch, in AU inside the Solar System and in parsecs for a placed star.
      (input.quantity === 'geometric' ? input.referencePoint !== 'heliocentre' || input.epochJdTt === null || (input.unit === 'pc' ? input.meters < 3.085677581491367e15 : input.unit !== 'AU')
        : input.referencePoint !== 'observer' || input.epochJdTt !== null || input.unit !== 'pc')) {
    throw new TypeError('Invalid prepared navigation distance.');
  }
  const expectedMeters = input.value * (input.unit === 'AU' ? 149597870700 : 3.085677581491367e16);
  if (!Number.isFinite(expectedMeters) || Math.abs(input.meters - expectedMeters) > Math.max(1, expectedMeters) * 1e-12) {
    throw new TypeError('Prepared navigation distance has inconsistent display and sort values.');
  }
  const subject = input.subject === undefined ? undefined : parseDistanceSubject(input.subject);
  if (subject && input.quantity !== 'catalogue') throw new TypeError('Only catalogue distances can adopt another subject.');
  return Object.freeze({ ...(subject ? { subject } : {}), meters: input.meters, value: input.value, unit: input.unit, quantity: input.quantity,
    referencePoint: input.referencePoint, epochJdTt: input.epochJdTt });
}

export function distanceDescription(distance: NavigationDistance): string {
  if (distance.subject) return `Distance to ${distance.subject.name}, adopted for this scene. ${distance.subject.reason}`;
  return distance.quantity === 'geometric' ? `Distance from the Sun at JD ${distance.epochJdTt} TT${distance.unit === 'pc' ? ', from the catalogue parallax carried by proper motion' : ''}`
    : distance.quantity === 'comoving' ? 'Observer distance: redshift-derived comoving distance'
      : 'Observer distance adopted from the catalogue; measurement epoch is source-specific';
}
