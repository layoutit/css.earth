// `@cssearth/bake/navigation` (Node only): what navigation preparation reads and draws. The prepared focus objects and
// scene distances the catalogue and search destinations are built from, and the marker recipes whose source bytes are
// validated and rendered into navigation marker sprites, and the navigation preparation that writes the marker atlases, action
// markers and prepared marker presentation. It imports `raster`, `delivery`, `sources` and `astronomy`, and `objects/raster` when
// a marker is drawn from a science raster.
export * from './marker-recipe.ts';
export * from './navigation-destinations.ts';
export * from './prepare-navigation.ts';
