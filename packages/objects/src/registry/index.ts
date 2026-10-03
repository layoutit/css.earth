// The application registry's shared contracts: the object entry schema and catalogue decoding, the discovery, distance,
// arrival and zoom parsers, the classification categories, the fact order, the destination-name normalisation
// preparation and search share, the context color, and world-rotation validation. The host binds the registry to its
// scene loader (`site/objects.mts`); nothing here loads a scene or reads a file.
export { parseArrivalView, parseArrivalBillboard } from './arrival-view.js';
export type { PreparedArrivalView, PreparedArrivalBillboard } from './arrival-view.js';
export { composited, contextColor, contrastRatio, DEFAULT_CONTEXT_COLOR, NEUTRAL_CATALOGUE_COLOR, NEUTRAL_CATALOGUE_RGB, readableOnSky, relativeLuminance, SKY_BACKGROUND, TEXT_CONTRAST_MINIMUM } from './context-color.js';
export { normalizeDestinationQuery, searchDestinations } from './destination-search.js';
export { orderFacts } from './fact-order.js';
export { mapLabel } from './map-label.js';
export { distanceDescription, parseNavigationDistance } from './navigation-distance.js';
export type { NavigationDistance } from './navigation-distance.js';
export { catalogEntry, catalogueObject } from './object-catalog.js';
export type { CatalogContext, CatalogEntry } from './object-catalog.js';
export { matchesObjectCategory, matchesObjectClassification } from './object-categories.js';
export { discoveryDescription, discoveryVisibility, isDiscoveryAnchor, offTheMap, parseObjectDiscovery } from './object-discovery.js';
export type { ObjectDiscovery } from './object-discovery.js';
export { defineObject, defineObjects, EXTENDED_CLASSIFICATIONS, isExtendedClassification, isPlacedClassification, OBJECT_CLASSIFICATIONS, PLACED_CLASSIFICATIONS } from './object-schema.js';
export type { ObjectClassification, ObjectDefinitionInput, ObjectEntry, ObjectPositionM, ObjectWorldFrame } from './object-schema.js';
export { destinationSearchNames, objectSystem } from './navigable-object.js';
export { checkObjectTree, OBJECT_TREE_ROOT, objectAncestors, objectChildren } from './object-tree.js';
export type { TreeNode } from './object-tree.js';
export { systemHostId, systemObjectId, systemViewFile } from './system-address.js';
export type { NavigableObject, ObjectSystem, WorldBody } from './navigable-object.js';
export { objectZoom } from './object-zoom.js';
export type { ObjectZoom, ZoomDistance, ZoomFrame } from './object-zoom.js';
export { validateWorldReflection, validateWorldRotation } from './world-rotation.js';
export type { WorldRotation } from './world-rotation.js';
