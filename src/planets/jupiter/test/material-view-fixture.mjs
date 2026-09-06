import { PREPARED_JUPITER_LIGHTING } from "../runtime/preparedLighting.mjs";

// Exercise the source raster's light phase through the common view contract.
export function lightingView(view, frame) {
  const z = PREPARED_JUPITER_LIGHTING.presentations[frame].lightViewZ;
  return { ...view, sunViewDirection: [Math.sqrt(1 - z * z), 0, z] };
}
