/** A system is an object with an address of its own: a host with the bodies that orbit it (`src/objects/<id>/object.json`
 * `properties.system`). Its id is its host's with `-system`; the Sun's system is the Solar System. The rule is here, once:
 * an address is read and written, and a system's holder file named, without a table of every system. */
const SUFFIX = '-system';
/** The world's own star, whose system has a name of its own. */
const SOLAR_HOST = 'sun', SOLAR_SYSTEM = 'solar-system';

/** The id of the system whose host is `hostId`. */
export const systemObjectId = (hostId: string): string => hostId === SOLAR_HOST ? SOLAR_SYSTEM : `${hostId}${SUFFIX}`;
/** The host of the system `id` names, or null when `id` is not a system's. */
export const systemHostId = (id: string | undefined): string | null =>
  id === SOLAR_SYSTEM ? SOLAR_HOST : id !== undefined && id.endsWith(SUFFIX) && id.length > SUFFIX.length ? id.slice(0, -SUFFIX.length) : null;

/** Where a system view lives in the package of the system its host is inside, relative to that package's `prepared/`. */
export const systemViewFile = (hostId: string): string => `views/${hostId}.json`;
