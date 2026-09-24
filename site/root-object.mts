/** The body the site's front page (`/`) shows. Its own route stays `/<id>/`; the front page, search on it and history
 * entries that name `/` all resolve to it here. */
export const ROOT_OBJECT_ID = 'earth';

/** The id of the body a same-site path shows: the front page's, or the one named by `/<id>/`. */
export function objectIdAtPath(pathname: string): string | undefined {
  return pathname === '/' ? ROOT_OBJECT_ID : /^\/([a-z][a-z0-9-]*)\/$/u.exec(pathname)?.[1];
}
