# Photograph-constrained LMC reconstruction

> Research record. This describes the recorded experiment, not the current app. Retired tabs and Orion models are no longer available. Use the [current workflow](../workflows.md) for processing and [current reconstruction](../reconstruction.md) for the active method.

This laboratory experiment keeps the photograph's calibrated angular placement and uses the stellar simulation as a depth prior. It is a visual reconstruction, not a measurement of gas geometry. The native SMASH image is the first input; the algorithms contain no LMC-specific branches.

- [Cloud reconstruction](http://127.0.0.1:4331/?subject=lmc-clouds&tab=reconstruction) and [broad-depth cloud control](http://127.0.0.1:4331/?subject=lmc-clouds-broad&tab=reconstruction) use the same extended-light target and observer. Compact candidates and the diffuse remainder are excluded from this pair and remain available as [compact](../../models/lmc/clouds-observation/source/compact.png) and [diffuse](../../models/lmc/clouds-observation/source/diffuse.png) preparation panels.
- [Full-photo diagnostic](http://127.0.0.1:4331/?subject=lmc-filled&tab=reconstruction) retains the earlier diffuse-plus-extended target. Its rectangular photographic background and side-view aliasing failed the visual gate; it is preserved as evidence, not presented as an accepted cloud.

## Evidence and method

- **Position and scale:** the publisher's ICRS TAN WCS maps native pixels onto Earth-view rays. Rays expand in physical X/Y with distance. The full neutral density grid is sampled along those rays, including its entire Z extent. The previous manual 300% photograph fit is not used.
- **Source processing:** the native image is filtered before rectification to avoid aliasing small stars. Uncovered corners stay empty. Source, compact-candidate, extended, diffuse, and selected-target images remain available for comparison at the same sky scale.
- **Filled structures:** successive nonnegative morphology components plus their residual reconstruct the source intensity. Opening by reconstruction restores connected source contours after erosion; ordinary disk opening was rejected because it stamped circular terraces into the separated light. This is an independent implementation of the operation described by [Vincent (1993)](https://doi.org/10.1109/83.217222).
- **Depth:** connected extended regions receive finite, smooth volume profiles whose thickness follows their footprint. A continuous depth field and bounded local offsets use the stellar prior. Fine image structure stays with its surrounding cloud. The broad control distributes the same target through the full stellar depth profile.
- **Color:** selected component contributions retain source RGB proportions. Their ray integrals are normalized before the display-to-optical conversion. Checks integrate the physical Earth rays back to the declared photographic target.
- **Delivery:** fixed XYZ slice banks are baked offline and displayed by the existing retained PolyCSS renderer. No image processing or geometry generation is added to browser runtime.

Finite cloud bounds are computed after the complete field is assigned. The bake trims only space proven to contain no emission, preserving the full input density and the registered image footprint. This tightens physical slab spacing instead of widening a cloud to conceal undersampling. The cloud experiment uses 1024px lossless masters and derives 512px delivery textures from them.

[Image-based deprojection in M33 modelling](https://doi.org/10.1093/mnras/stz1441) motivates using an observed image with explicit depth assumptions. This experiment does not implement that paper's radiative transfer or infer dust extinction. The stellar prior comes from the [Garver et al. simulation](https://doi.org/10.5061/dryad.1vhhmgr82), whose approximate observer placement and limitations are recorded in the existing density provenance.

## Acceptance and stopping conditions

1. Source-component accounting must close; excluded compact and diffuse light must remain inspectable in separate saved panels.
2. The physical Earth projection must preserve the selected target's color and registered positions within the recorded integration and texture errors.
3. Front, oblique, and edge views must show finite connected structures without repeated silhouettes across the galaxy depth. Numerical projection agreement alone is insufficient.
4. The real CSS bake must load, rotate, and switch between paired controls with retained leaves and the same camera.

The limit is three fix/review rounds and two final cleanup rounds. A persistent morphology failure is recorded as a rejected candidate, rather than hidden with exposure changes or promoted into the website.

## Recorded outcome

**The reusable pipeline is implemented; this SMASH candidate is rejected for production morphology.** The three-round experiment stops here. The photographed edge remains visible and some oblique views still resemble a thick sheet, with sampling streaks. Finer baking and a prior-derived inclination did not resolve those structural limitations.

Inspect the frozen [front](../../models/lmc/clouds/review/front.png), [oblique](../../models/lmc/clouds/review/y-plus-60.png), and [edge](../../models/lmc/clouds/review/edge-y.png) captures. The [assessment](../../models/lmc/clouds/review/assessment.json) separates established registration/projection properties from unverified gas geometry.

The extended target retains 68.0% of the decomposition's display signal, not a measured gas-light fraction. Its finite and broad-depth controls each use 416 prepared textures, totaling 2.41 MB and 2.01 MB. Maximum tested observer-ray channel error before texture encoding is below 0.00009 for both. These numerical checks do not override the failed visual gate.

The next source comparison is the wider calibrated VISTA mosaic, preserving its explicit infrared colors. Its source coverage may improve the boundary problem; changing the photograph alone does not determine missing depth.

## Known limits

The photo footprint is smaller than the full simulation. Its illuminated top edge is real missing image coverage: subtracting a constant black level does not remove that boundary. No color is invented outside the photograph. Compact-candidate subtraction can also remove intrinsic knots; it does not identify foreground stars. Decomposition uses Rec.709 coefficients on encoded sRGB values, not linear radiance. The RGB image is a display composite, and all unknown depth/thickness choices remain explicit in the recipe.

The controls deliberately preserve these limitations for inspection. Their prepared banks are research artifacts, not an accepted production galaxy.

## Rebuild

```sh
pnpm install --frozen-lockfile
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts prepare-filled labs/nebula/models/lmc/clouds.json
pnpm lab:nebula
```

The pinned native image downloads into the ignored source cache if absent. Preparation requires the checked-in neutral density inputs and their matching receipts. The recipe, source hashes, decomposition accounting, depth assumptions, and projection results accompany the prepared objects.
