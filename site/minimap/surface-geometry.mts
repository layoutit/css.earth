type SurfaceGeometry = typeof import('./surface-minimap-rectangle.mts');
let geometry: SurfaceGeometry | null = null, pending: Promise<SurfaceGeometry> | null = null;
// Cesium's picking math is not needed for the first frame, so it stays out of the startup bundle.
export const loadedSurfaceGeometry = () => geometry;
export const loadSurfaceGeometry = () => pending ??= import('./surface-minimap-rectangle.mts').then(module => geometry = module);
