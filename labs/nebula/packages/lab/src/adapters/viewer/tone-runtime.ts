/** The host owns resource access policy; the viewer only transports prepared pixels. */
import { createToneResourceController as create } from '@cssearth/volume-viewer/scene/tone-resources';
export type { ToneResource } from '@cssearth/volume-viewer/scene/tone-resources';
export function createToneResourceController() { return create({ isAllowedUrl: url => url.startsWith('/@fs/') }); }
