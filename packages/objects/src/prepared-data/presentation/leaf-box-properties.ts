/** CSS wire properties shared by prepared leaf-box producers and consumers. */
export const LEAF_BOX_PROPERTY = '--silhouette-step';
export const LEAF_BOX_FACTOR = '--leaf-box';
export const SURFACE_SEAM_OUTSET_PROPERTY = '--surface-seam-outset';
/** Image texels per CSS pixel of every raster leaf: the @2x convention, one backing pixel per texel at DPR 2. WebKit backs a
 * composited leaf at its box size times the device pixel ratio and ignores its transform, so a larger box costs memory and
 * adds no detail: Itokawa's 794 faces held 486 MB of layers on a DPR 3 iPhone at one texel per CSS pixel and 173 MB at two
 * (739 of 3.16 million screen pixels changed at rest), and each of Earth's caps 36 MB at raster scale 4 and 2.3 MB at 1. */
export const TEXELS_PER_CSS_PIXEL = 2;
