// Pure prepared-data helpers shared by Node preparation and the browser renderer.
export * from './prepared-data/prepared-ellipsoid-projection.js';
export { applyPreparedProjectiveLayout, scalePreparedBackgroundAddresses, scalePreparedPixelLengths } from './prepared-data/projective-layout.js';
export type { PreparedProjectiveStyle, PreparedProjectiveLayout, PreparedProjectiveTextureLeaf } from './prepared-data/projective-layout.js';
