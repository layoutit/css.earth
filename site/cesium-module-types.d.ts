// Cesium publishes its API types at the package entry. Bind those upstream types
// to the preserved deep imports so browser bundles retain the numeric-only closure.
declare module '@cesium/engine/Source/Core/Cartesian3.js' { export { Cartesian3 as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/Cartesian4.js' { export { Cartesian4 as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/CullingVolume.js' { export { CullingVolume as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/Ellipsoid.js' { export { Ellipsoid as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/IntersectionTests.js' { export { IntersectionTests as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/Ray.js' { export { Ray as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Scene/Camera.js' { export { Camera as default } from '@cesium/engine'; }
declare module '@cesium/engine/Source/Core/Rectangle.js' { export { Rectangle as default } from '@cesium/engine'; }
