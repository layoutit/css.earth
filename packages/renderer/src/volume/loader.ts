import { DENSITY_VOLUME_FORMAT, parseDensityVolumeObjectDescriptor, parsePreparedDensityVolumeText, type PreparedCssVolume } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';

/** Transport a prepared density object; never bake a missing runtime resource. */
export async function loadPreparedCssVolume(input: unknown, transport: PreparedCssTransport): Promise<PreparedCssVolume> {
  const descriptor = parseDensityVolumeObjectDescriptor(input);
  if (descriptor.prepared?.format !== DENSITY_VOLUME_FORMAT) throw new TypeError('A volume requires its prepared artifact.');
  const bytes = await transport.read(descriptor.prepared.url);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return parsePreparedDensityVolumeText(text, descriptor);
}
