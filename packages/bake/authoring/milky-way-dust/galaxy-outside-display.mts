/** Frozen once from b30's native face: 3 / percentile99.5(sumRGB).
 * render8_gpu.py uses asinh(stretch=6), gamma=.9. Unlike its independently
 * normalized side PNG, every far stack uses this same face scale.
 * Source: runs/b30-native-scatterFaceSide/fit-crisp.json, scale=1;
 * measured by the original composite/camera functions in the tuner reference.
 * Input is camera-transferred emission BEFORE fitted interior logExposure.
 */
export const GALAXY_OUTSIDE_DISPLAY_SCALE = 0.044094241663168915;
