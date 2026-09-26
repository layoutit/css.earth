/** A compatibility re-export of the shared MAST boundary used by older JWST routes.
 * Astroquery owns MAST queries and complete-file downloads. cssEarth owns byte validation and the reducers, whose inline
 * Python runs through `toolchainPython` in `@cssearth/telescope/node`. */
export { MAST_CACHE, exists, mastDownloadUrl, mastFile, mastRequest, mastService, type MastFile } from '@cssearth/telescope/node';
