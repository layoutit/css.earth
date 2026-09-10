/** Shared marker addresses are body-owned; catalogue growth cannot move them. */
export function prepareMarkerBindings(definition) {
  const view = definition.heliocentricView;
  if (!view) return definition;
  const shared = url => /^\/navigation\/(?:planet-markers|body-[a-z][a-z0-9-]*|[a-z][a-z0-9-]*-marker)(?:@2x)?\.webp$/.test(url ?? '');
  const bind = (id, sprite, url) => {
    const address = sprite?.url ?? url;
    if (!sprite || !shared(address)) return sprite;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid navigation marker identity.');
    return { ...sprite, url: `/navigation/body-${id}${address.includes('@2x') ? '@2x' : ''}.webp`, index: 0, count: 1 };
  };
  const system = view.systemMarkers;
  return { ...definition, heliocentricView: { ...view,
    bodyMarker: bind(definition.id, view.bodyMarker),
    ...(system ? { systemMarkers: { ...system,
      ...(shared(system.url) ? { url: '/navigation/body-sun.webp' } : {}),
      sun: bind('sun', system.sun, system.url),
      bodies: Object.fromEntries(Object.entries(system.bodies).map(([id, sprite]) => [id, bind(id, sprite, system.url)])),
    } } : {}),
  } };
}
