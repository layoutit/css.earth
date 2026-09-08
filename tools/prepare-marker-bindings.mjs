import { PREPARED_NAVIGATION_MARKERS } from '../site/prepared-navigation-markers.mjs';

/** Atlas insertion changes both indices and strip width. Resolve semantic body
 * ids again when serializing a package; authored scenes may predate the atlas. */
export function prepareMarkerBindings(definition, markers = PREPARED_NAVIGATION_MARKERS) {
  const view = definition.heliocentricView;
  if (!view) return definition;
  const bind = (id, sprite, url) => {
    if (!sprite || !/^\/navigation\/planet-markers(?:@2x)?\.webp$/.test(sprite.url ?? url ?? '')) return sprite;
    const marker = markers[id];
    if (!marker) throw new Error(`Shared navigation marker is missing: ${id}.`);
    return { ...sprite, index: marker.index, count: marker.count };
  };
  const system = view.systemMarkers;
  return { ...definition, heliocentricView: { ...view,
    bodyMarker: bind(definition.id, view.bodyMarker),
    ...(system ? { systemMarkers: { ...system,
      sun: bind('sun', system.sun, system.url),
      bodies: Object.fromEntries(Object.entries(system.bodies).map(([id, sprite]) => [id, bind(id, sprite, system.url)])),
    } } : {}),
  } };
}
