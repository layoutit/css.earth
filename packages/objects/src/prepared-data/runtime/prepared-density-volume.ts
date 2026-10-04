import type { DensityVolumeObjectDescriptor } from '../../density-volume.js';
import { DENSITY_VOLUME_FORMAT } from '../../volume/delivery/volume-schemas.js';
import { readPreparedObject } from '../../preparation.js';
import { validatePreparedCssVolume } from '../../volume/delivery/css-volume-validation.js';
import type { PreparedCssVolume } from '../../volume/delivery/css-volume-types.js';

/** Parse the prepared envelope and require the authored identity and physical frame. Transport stays with callers. */
export function parsePreparedDensityVolume(value: unknown, descriptor: DensityVolumeObjectDescriptor): PreparedCssVolume {
  if (descriptor.prepared?.format !== DENSITY_VOLUME_FORMAT) throw new TypeError('A volume requires its prepared artifact.');
  const payload = readPreparedObject(value, descriptor, validatePreparedCssVolume).data;
  if (payload.id !== descriptor.id || JSON.stringify(payload.frame) !== JSON.stringify(descriptor.volume)) {
    throw new TypeError('Prepared volume frame does not match its authored descriptor.');
  }
  return payload;
}

/** JSON text admission; callers own byte decoding and transport. */
export function parsePreparedDensityVolumeText(text: string, descriptor: DensityVolumeObjectDescriptor): PreparedCssVolume {
  return parsePreparedDensityVolume(JSON.parse(text), descriptor);
}
