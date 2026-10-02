/** How an address names a system: the registry's rule (`@cssearth/objects` system-address.ts), with the route. */
import { systemObjectId } from '@cssearth/objects';
export { systemHostId, systemObjectId } from '@cssearth/objects';
/** A system's address. */
export const systemRoute = (hostId: string): string => `/${systemObjectId(hostId)}/`;
