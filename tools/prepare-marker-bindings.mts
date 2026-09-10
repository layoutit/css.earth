interface MarkerSprite { url?: string; index: number; count: number; size: number; }
interface MarkerView { bodyMarker?: MarkerSprite; systemMarkers?: {url: string; sun: MarkerSprite; bodies: Record<string, MarkerSprite>} | null; }
/** Shared marker addresses are body-owned; catalogue growth cannot move them. */
export function prepareMarkerBindings<T extends {id: string; heliocentricView?: MarkerView | null}>(definition: T) {
  const view = definition.heliocentricView;
  if (!view) return definition;
  const shared = (url?: string) => /^\/navigation\/(?:planet-markers|body-[a-z][a-z0-9-]*)(?:@2x)?\.webp$/.test(url ?? '');
  const bind = <S extends MarkerSprite | undefined,>(id: string, sprite: S, url?: string) => {
    const address = sprite?.url ?? url;
    if (!sprite || !shared(address)) return sprite;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Invalid navigation marker identity.');
    return { ...sprite, url: `/navigation/body-${id}${address?.includes('@2x') ? '@2x' : ''}.webp`, index: 0, count: 1 };
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
