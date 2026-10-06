/** Every kind of map a spec may list, by the spec's key: a new kind is a line here. It stands apart from route.mts, which
 * each kind's own route imports, so no kind and the shared route import one another. */
import { runSurfaceMaps, type RouteContext, type SurfaceMapResult } from './route.mts';

export const MAP_ROUTES: Readonly<Record<string, { readonly name: string; readonly run: (spec: string, context: RouteContext) => Promise<SurfaceMapResult[]> }>> = {
  // Magnetic maps reduced from archived polarised spectra (magnetic/maps.mts).
  magneticMaps: { name: 'magnetic maps', run: async (spec, context) => runSurfaceMaps((await import('../magnetic/maps.mts')).MAGNETIC_ROUTE, spec, context) },
  // Brightness maps made from the TESS and K2 missions' light curves of a star (brightness/brightness.mts).
  brightnessMaps: { name: 'brightness maps', run: async (spec, context) => runSurfaceMaps((await import('../brightness/brightness.mts')).BRIGHTNESS_ROUTE, spec, context) },
};
