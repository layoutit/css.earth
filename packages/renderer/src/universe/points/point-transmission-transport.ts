import type { PreparedPointTransmission } from '@cssearth/objects';
import { readPrepared } from '../../prepared-data-worker-client.js';
/** The registered reader runs in the data worker and transfers the prepared lookup buffers. */
export const loadPointTransmission=(url:string)=>readPrepared<PreparedPointTransmission>('point-transmission',url);
