// `@cssearth/bake/objects/scene` (Node only): the physical world frame and the authored presentation bases, system transforms
// and surface placements world navigation is solved in, and the synchronous and hosted rotation elements authored bodies turn by.
export * from './world-navigation.ts';
export * from './authored-rotation.ts';
// The ecliptic presentation frame, the default camera, the Sun's reference view direction and the astrometric sky registration
// derived from it, from the prepared solar geometry the host passes in (`SolarGeometry`).
export type { SolarGeometry } from './solar-geometry.ts';
export { loadSolarGeometry } from './load-solar-geometry.ts';
export * from './solar-presentation-frame.ts';
export * from './default-camera.ts';
export * from './prepare-sun-view-direction.ts';
export * from './galactic-frame.ts';
export * from './astrometric-sky-registration.ts';
export * from './solar-system-scene.ts';
export * from './focused-camera.ts';
export * from './world-navigation-sources.ts';
export * from './world-navigation-materials.ts';
export * from './camera-source.ts';
// The seams and projection block every generated sphere is written with.
export * from './sphere-projection.ts';
export * from './recipe-identifiers.ts';
