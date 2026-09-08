# Cloud inspection

Open the [connected LMC reconstruction](http://127.0.0.1:4331/?subject=lmc-clouds&tab=reconstruction). Its floating right panel has visible controls for:

- **Detected structures**: toggle individual extended components or use Solo. These are image-decomposition components, not identified physical nebulae.
- **Broad light**: include the compact candidates and diffuse remainder separately. Compact detections do not distinguish foreground stars from galaxy members.
- **Source signal**: the fraction of the original registered image's encoded display intensity assigned to each component. This is neither mass nor calibrated luminosity.
- **Brightness**: Overall dims the complete image. X/Y/Z balance sets attenuation for each prepared projection direction; the blend follows the effective projection weights as the camera rotates. 100% preserves native brightness. Reset brightness restores all four controls.
- **Show all / Hide all / Restore default**: inspect the full decomposition, empty the scene, or restore the accepted extended-only image. Restore default changes selection; Reset brightness changes brightness.
- **Copy selection + brightness**: export the retained choices as JSON. Both are also saved locally per reconstruction.

Selection and brightness changes preserve the camera, prepared texture bank and retained DOM. Returning through Alignment or another subject restores the choices. Existing density and image-placement controls remain independent.

## Preparation and interpretation

The exact original reconstruction remains in the prepared bank and is shown for the default selection. Each detected contribution is additionally baked in its own conservative support bounds, using the original reference's fixed depth plane, family placement and thickness. Selecting pieces never refits that geometry or reassigns their depth.

Extended optical contributions partition the reference field pointwise. Compact and diffuse inspection channels use separate source-channel calibration on that same fixed plane. Independently encoded translucent pieces approximate filtered combinations: source-over composition, quantization and individual sampling grids can differ from a freshly baked combined selection. Restore default shows the original prepared leaves, avoiding this approximation entirely.

Brightness correction applies once after the three projection banks are composited. Their opacities are cumulative source-over values; the lab recovers each bank's effective weight before blending the attenuation controls. It leaves the bank weights, textures and individual leaf alpha unchanged. This is display calibration, not a correction to astrophysical photometry, and it does not guarantee constant luminance at every orientation.

To rebuild the contribution bank from the pinned source recipe, from a clean checkout:

```sh
pnpm install --frozen-lockfile
node --experimental-strip-types labs/nebula/src/run.ts prepare-parts labs/nebula/models/lmc-clouds.json
pnpm lab:nebula
```

The preparer retrieves the pinned original photograph if it is absent. It uses the checked-in frame, stellar-prior source and exact reference bank. Lossless intermediate slices stay in the ignored local cache; the inspection catalogue, descriptor and delivery bank are committed beside the reference object.
