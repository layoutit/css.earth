# Cloud inspection

Open the [connected LMC reconstruction](http://127.0.0.1:4331/?subject=lmc-clouds&tab=reconstruction). Its floating right panel has visible controls for:

- **Detected structures**: toggle individual extended components or use Solo. These are image-decomposition components, not identified physical nebulae.
- **Broad light**: include the compact candidates and diffuse remainder separately. Compact detections do not distinguish foreground stars from galaxy members.
- **Source signal**: the fraction of the original registered image's encoded display intensity assigned to each component, before density filtering or brightness adjustment. This is neither mass nor calibrated luminosity.
- **Brightness**: Overall dims the cloud. X/Y/Z balance sets attenuation for each prepared projection direction; the blend follows the effective projection weights as the camera rotates. 100% preserves native brightness. Reset brightness restores all four controls.
- **Show all / Hide all / Restore default**: inspect the full decomposition, hide the cloud, or restore the accepted extended-only image. Restore default changes selection; Reset brightness changes brightness.
- **Copy selection + brightness**: export the retained choices as JSON. Both are also saved locally per reconstruction.

Selection and brightness changes preserve the camera, prepared texture bank and retained DOM. Returning through Alignment or another subject restores the choices. Existing density and image-placement controls remain independent.

## Projected cloud cutoff

The floating left panel controls sparse material in the Reconstruction view:

- **Signal cutoff** selects faint regions from the original Earth-facing cloud projection, relative to one global maximum. Zero retains the original image.
- **Edge softness** widens the transition around that cutoff. It is relative to the cutoff, rather than another brightness adjustment.
- **Apply density filter** prepares new texture pixels locally, then replaces the whole bank after decoding. The previous view stays visible while preparation runs; camera and geometry are retained.
- **Show removed signal** displays the complementary rejected contribution. It immediately applies the visible settings.
- **Reset to original** restores the original textures. Density settings are independent of the right panel's structure selection and brightness controls.

The filter uses the registered reconstruction target before its light was distributed through depth. It maps each prepared texel onto the same calibrated Earth-facing sightline and applies the same selection throughout that ray. A thicker bulge therefore does not receive a lower cutoff merely because its light occupies more depth. The projection remains fixed to the object when the camera rotates. It is a display-signal selection, not a stellar-mass or gas-density measurement.

Filtering still approximates the selection at each slab's image plane because the prepared texture has integrated a finite depth interval. The local preparer attenuates optical opacity while retaining RGB values. Kept and removed optical weights complement each other; signal is not redistributed. The filter does not refit geometry, move the photograph, or modify the stellar-density source. Use edge softness to inspect the selection boundary.

All sampling and image processing run in the local Node preparation service, not the browser. Prepared variants and cached signal samples stay in the ignored local cache. Reopening a saved filter regenerates missing variants. Saved values from the earlier local-stellar-density experiment are not reused because the cutoff quantity changed.

## Viewing direction and stars

Oblique sightlines mix different photo columns, which can make the result brighter and less saturated. The source textures have similar saturation across all three banks. Brightness attenuation can reduce the extra light, but cannot restore the mixed colors; see [the measured color diagnosis](view-direction-color.md).

Bright catalog stars are an independent layer with a visible on/off switch and brightness control. Their sky positions come from the cited catalog; their individual depths remain modeled. The cloud's cutoff and brightness controls do not remove or dim these catalog points.

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
