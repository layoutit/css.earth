import { isExtendedClassification, parseNavigationDistance } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';

const AU_M = 149597870700, PC_M = 3.085677581491367e16;
/** One tenth of a parsec, about 20,000 AU: the far edge of the Oort cloud. */
const PARSEC_THRESHOLD_M = PC_M / 10;
export function prepareSceneDistance(descriptor: unknown) {
  const frame = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.worldFrame : null;
  if (!isRecord(frame) || frame.referenceFrame !== 'sun-icrf' || typeof frame.epochJdTt !== 'number' ||
      !Array.isArray(frame.originM) || frame.originM.length !== 3 || !frame.originM.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new TypeError('Navigation distance requires a prepared Sun-centred world frame.');
  }
  const meters = Math.hypot(...frame.originM);
  // A galaxy, a cluster or a nebula, or a level that is a body too, sits where its catalogued distance puts it: that distance
  // has no epoch, and may be another subject's (a reflection nebula placed at its star cluster's).
  const catalog = isRecord(descriptor) && isRecord(descriptor.properties) ? descriptor.properties.catalog : null;
  const extended = isRecord(catalog) && typeof catalog.classification === 'string' && isExtendedClassification(catalog.classification);
  if (extended || (isRecord(descriptor) && isRecord(descriptor.properties) && descriptor.properties.overview !== undefined)) {
    const subject = isRecord(catalog) ? catalog.distanceSubject : undefined;
    return parseNavigationDistance({ ...(subject === undefined ? {} : { subject }), meters, value: meters / PC_M, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null });
  }
  // A body beyond the Solar System is read in parsecs; astronomical units stop meaning anything past the Oort cloud.
  const parsecs = meters >= PARSEC_THRESHOLD_M;
  return parseNavigationDistance({ meters, value: meters / (parsecs ? PC_M : AU_M), unit: parsecs ? 'pc' : 'AU', quantity: 'geometric', referencePoint: 'heliocentre', epochJdTt: frame.epochJdTt });
}
