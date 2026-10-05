import { systemHostId } from './navigation/system-address.mts';

/** The body the site's front page (`/`) shows. Its own route stays `/<id>/`; the front page, search on it and history
 * entries that name `/` all resolve to it here. */
export const ROOT_OBJECT_ID = 'earth';

/** The id a same-site path names: the front page's object, or the one named by `/<id>/`. */
export function pageIdAtPath(pathname: string): string | undefined {
  return pathname === '/' ? ROOT_OBJECT_ID : /^\/([a-z0-9][a-z0-9_.+-]*)\/$/u.exec(pathname)?.[1];
}
/** The id of the object whose scene a same-site path shows: the object the path names, or, for a system, its host
 * (navigation/system-address.mts): a system shows its host's scene out to its members. */
export function objectIdAtPath(pathname: string): string | undefined {
  const id = pageIdAtPath(pathname);
  return systemHostId(id) ?? id;
}
