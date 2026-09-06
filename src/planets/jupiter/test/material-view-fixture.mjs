import { runtimeDefinition } from "../runtime/definition.mjs";
import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";

// Convert a source raster's camera-light direction into the common view frame.
// The prepared orthonormal registration is inverted by its transpose.
export function lightingView(view, frame) {
  const source = PREPARED_JUPITER_LIGHTING.presentations[frame].cameraLightDirection;
  const basis = runtimeDefinition.materials[0].frame.lightBasis;
  return { ...view, sunViewDirection: [0, 1, 2].map(column =>
    source.reduce((sum, value, row) => sum + basis[row * 3 + column] * value, 0)) };
}
