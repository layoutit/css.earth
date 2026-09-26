// The application registry's shared contracts: the object entry schema and catalogue decoding, the discovery, distance,
// arrival and prepared-focus parsers, the classification categories, the fact order, the destination-name normalisation
// preparation and search share, the context colour, and world-rotation validation. The host binds the registry to its
// scene loader (`site/objects.mts`); nothing here loads a scene or reads a file.
export { parseArrivalView } from './arrival-view.js';
export type { PreparedArrivalView } from './arrival-view.js';
export { composited, contextColour, contrastRatio, DEFAULT_CONTEXT_COLOUR, readableOnSky, relativeLuminance, SKY_BACKGROUND, TEXT_CONTRAST_MINIMUM } from './context-colour.js';
export { normalizeDestinationQuery, searchDestinations } from './destination-search.js';
export { orderFacts } from './fact-order.js';
export { distanceDescription, parseNavigationDistance } from './navigation-distance.js';
export type { NavigationDistance } from './navigation-distance.js';
export { catalogEntry } from './object-catalog.js';
export type { CatalogContext, CatalogEntry } from './object-catalog.js';
export { matchesObjectCategory, matchesObjectClassification } from './object-categories.js';
export { discoveryDescription, discoveryVisibility, isDiscoveryAnchor, parseObjectDiscovery } from './object-discovery.js';
export type { ObjectDiscovery } from './object-discovery.js';
export { defineObject, defineObjects, OBJECT_CLASSIFICATIONS } from './object-schema.js';
export type { ObjectClassification, ObjectDefinitionInput, ObjectEntry, ObjectPositionM, ObjectWorldFrame } from './object-schema.js';
export { definePreparedFocus, isSceneObject } from './prepared-focus-object.js';
export type { NavigableObject, PreparedFocusObject } from './prepared-focus-object.js';
export { validateWorldReflection, validateWorldRotation } from './world-rotation.js';
export type { WorldRotation } from './world-rotation.js';
