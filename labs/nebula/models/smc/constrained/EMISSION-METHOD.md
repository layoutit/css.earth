# Simulation-guided SMC emission experiment

This is a new inferred-emission model. It does not repaint the unchanged stellar-density volume. The original simulation, VMC comparison and previous material-only trials remain independent references.

## Roles of the inputs

| Input | Constrains | Does not establish |
| --- | --- | --- |
| Registered, star-removed Horálek optical image | Projected relative emission and component colour | Absolute luminosity, gas mass or depth |
| Observation-conditioned Garver stellar simulation | Conditional locations along the line of sight | Measured gas/dust structures |
| Authored finite-component settings | Local thickness and bounded approximation detail | Additional observations |

The image registration and full source pins are inherited from the inspected reconstruction baseline. Star removal is reused, never repeated. The recipe records an explicit exclusion around the separate bright foreground cluster on the left of the registered image; that light is not modeled as SMC emission. This hand-authored mask is distinct from the image footprint and does not erase the source bytes. Its relative star-match registration is distinct from validation of the simulation's geometry.

## Method

1. Fit the covered optical image with positive multiscale finite emission components. Keep the residual, including faint light the bounded basis cannot explain.
2. Sample the simulation along each component's observer rays. Place supported components at local density modes, splitting their projected weight by prior basin mass when more than one mode is retained.
3. Bound component thickness by local feature size and the prior mode width. Unsupported image features retain an explicitly authored finite depth and are counted separately.
4. Assign one footprint-integrated chromaticity to each finite 3D component. Mix colours by local emission. Do not sample the same image coordinate through the complete depth of the galaxy.
5. Bake the resulting emission into XYZ stacks. The neutral and coloured versions of this new field share alpha; they do not claim to preserve the original stellar-density alpha.

The fit operates in angular tangent coordinates. The bake maps physical positions through the same perspective observer transform, including the depth-dependent transverse scale. Arcseconds-to-kiloparsecs conversion also converts emission per unit path length. Empty image margins are not a cloud shape.

## Bounded acceptance

Try at most three fit/bake iterations. Inspect the actual shared viewer from Earth, obliquely, and at both exact 90-degree side axes. Compare the original-image overlay at the same observer pose. Check rotation brightness and bank handoffs separately from front-image fit.

Reject photographic extrusion, repeated silhouettes, disconnected coloured beads, loss of important front structures, or substantial whitening. A successful numerical fit is not visual acceptance, and visual acceptance is not recovery of the real three-dimensional SMC.

The existing VMC comparison preferred a simple ellipsoid over the conditioned simulation. Consequently the simulation remains a conditional spatial prior, not a scientifically validated SMC gas model. This experiment must not be promoted to the application without its own recorded inspection.

## Previous rejected approaches

- The projection-only baseline repeated image material along the stellar volume's depth.
- Fixed-density finite-region colouring avoided that exact repetition but failed to reproduce the observed structures satisfactorily.
- The present experiment changes finite emission support explicitly, addressing the spatial model rather than concealing the mismatch with colour or opacity controls.

## Executed prototype, 2026-09-16

The active recipe is `emission.json`; `emission-two-modes.json` preserves the initial depth-splitting hypothesis. The lab command `simulation-guided-reconstruction <recipe-path>` reuses the pinned, completed native-starless reconstruction named by `baselineId`. It verifies that baseline's artifact manifest and source/grid pins before fitting. This is a local research replay with that prerequisite, not a cold-install application delivery recipe.

Final local result: `961b7c737eab6ec54565fc0c03b3acde3ebf3aa739c592ffc6b4d093f7e3675a`.

- 478 finite components; strongest conditional depth mode per feature. Thickness remains authored and bounded by feature size and local prior width.
- 384-pixel preview, 94/75/128 XYZ slabs, four samples per slab. All 297 material textures preserve the corresponding newly fitted neutral alpha exactly.
- Target uses relative RGB peak consistently with peak-normalized component colour. Quantile background removal and display stretch are authored, recorded settings; they are not photometric calibration.
- Front, oblique and both exact side axes were inspected. The two-mode trial visibly duplicated the main cloud and was rejected. The dominant-mode trial removes that duplicate; fine structure remains soft and separate features may select different depth modes.
- The actual shared renderer's bank-transition checks passed: Y/Z brightness disagreement 3.045%, normalized image disagreement 3.323%; X/Z brightness disagreement 2.886%, normalized image disagreement 3.029%. Limits were unchanged at 5% and 4% respectively. These two camera checks do not prove stability at every possible angle.
- Those captures tested `ec5c4da0c14076af3d41a8fdf870a9c75084c8f8b59760b7a8bb8d820405ee75`. Final packaging changes provenance only; all 297 geometries and texture hashes were verified identical. The final route loads without browser errors. Local captures and the machine report are under ignored `output/smc-vmc/`.
- Strict package/test typechecks and targeted numerical tests passed. The full lab run exposed one stale SMC catalogue expectation, corrected and rechecked, plus an unrelated isolated delivery fixture unable to resolve `@cssearth/volume-bake/package.json`. That delivery fixture remains open; no all-suite pass is claimed.

The result remains **reviewable research, not qualified application material**. It preserves the full original prior separately. Next work should test spatially coherent mode selection and finer finite emission supports against the image residual, while preserving front/back ambiguity rather than manufacturing depth evidence.

## Two-scale envelope, 2026-09-17

**Why.** The dominant-mode prototype placed every fitted structure on one depth plane with feature-sized thickness. From Earth it matched the image; from the side it was a thin pancake that had lost the simulation's line-of-sight elongation.

**Method.** Recipe: `emission-envelope.json`. The original `emission.json` stays reproducible and unchanged.

1. Smooth the star-removed image (Gaussian σ = 10 fit pixels, about 0.4 kpc) and integrate the pinned simulation along each ray.
2. Envelope gain per sky position = 0.85 × smoothed image ÷ smoothed simulation column. The envelope is gain × simulation density, so its depth distribution is the simulation's own; image brightness never changes depth. A 3% floor keeps faint simulation wings. The gain tapers to zero across the observed footprint edge.
3. Depth is trimmed to the image-weighted 0.5–99.5% simulation mass, so a faint 45 kpc tail does not coarsen the slabs.
4. Finite components fit only the remaining detail (image − envelope projection), placed at the strongest prior mode with thickness up to 2× their on-sky size.
5. Colour: components keep footprint chromaticity. The envelope takes smoothed, sky-subtracted chromaticity that fades to neutral where the signal is faint. Every texel's colour fades to neutral below alpha byte 24 (`fullChromaAlphaByte`). The browser composites premultiplied 8-bit colour, and at alpha 1–3 channel rounding across 128 stacked slabs produced strong false red/blue tints.
6. Exposure gain 2.5 (was 1). At 1, 95% of textured texels had alpha 1–3, which caused contour banding.

**Result.** Model `ed90b7bcbc123853ddfe187984d4fc0b4eb77e3323633f4ea9730d32a72acb2b`: total front-projection relative squared error 0.0063 (the dominant-mode prototype had 0.0060); envelope carries 85% of image light, with 4.1% excess over the image. Slabs 91 × 78 × 128 at 0.178 kpc. Front, ±60° and both exact 90° side views were inspected in the shared viewer against the simulation and the previous prototype. The side views now follow the simulation's elongated body, and the front matches the photograph's blue core, pink star-forming region and knots.

**Lenses.** `finite-lenses.json` bakes nine lenses onto this one model: VISTA, SMASH, DSS2, AllWISE and Horálek from publisher images, and four composites built from pinned survey bands on one exact 10° TAN grid — DSS2 blue/red plates, AllWISE W2/W1, AllWISE W4/W3/W1 and Herschel SPIRE 250 µm. Each lens recolours the same neutral alpha with its own component and envelope chromaticity; the Model tab switches between them without changing geometry. The two dust and PAH composites keep their compact emission: their baselines use the identity stellar treatment instead of NOX, recorded per image in `../processing-plan.json`. The DSS2 and SPIRE composites declare their own coverage: masked saturated plate stars and the unobserved sky outside the SPIRE footprint reach the material as no coverage instead of black. The other candidates remain excluded for the reasons listed in the recipe.

**Known problems.** Faint concentric ripples remain in the outer halo, where alpha is still quantized. Detail resolution is bounded by the 384-pixel fit and 128 slabs. The envelope is the simulation's shape hypothesis, not measured gas depth. The VMC comparison still prefers a simple ellipsoid to this simulation.

## Ellipsoid envelope, 2026-09-17

**Why.** The two-scale envelope above carries 83% of the image light along the *simulation's* depth distribution. The neutral VMC comparison in [the shape trial](README.md#executed-comparison) prefers the simple ellipsoid over that simulation: withheld deviance per observed count 0.45749 against 0.60119, and lower is better. Keeping the simulation as the broad envelope therefore showed the body at the shape the observations score worst. This refit swaps only the envelope's depth density for the VMC-constrained ellipsoid volume and leaves the rest of the method unchanged.

**Method.** Recipe: `emission-envelope-ellipsoid.json`. `emission-envelope.json` stays reproducible and unchanged. The two recipes differ only in `priorCloud`: the ellipsoid volume (`.local/nebula-lab/smc-constrained/ellipsoid-volume/source/volume.json`, `9ac62796…`) instead of the simulation volume. The envelope record now pins its own `priorCloud`, so the depth density is the one the envelope was fitted with rather than the baseline request's cloud; `priorIdentity` must match it or the bake, the star preparation and the lens bake all refuse.

The finite detail components still sample the **simulation** along their observer rays, because that is where conditional local depth modes exist. The envelope and the detail components therefore carry different depth hypotheses, and the model records both pins. The generic `limitations` line inherited by the model receipt still reads "the stellar simulation's depth distribution"; for this model the envelope's pinned cloud is the ellipsoid, as `source/envelope.json` and `densityProjection` show.

**Result.** Model `075ce045c9369e4260c04473e100adad31703c7fef6e6b834fe895687c6b8b26`.

- 476 finite components from 480 iterations; 8 of them (1.68%, 0.35% of projected light) found no prior support and keep the authored finite depth.
- Total front-projection relative squared error 0.006282 (the simulation envelope had 0.0063). Detail-only relative squared error 0.0726; projection RMSE 0.01264 after fitting against 0.04694 before.
- Envelope carries 82.79% of the image light with 2.98% excess; 36,272 sky pixels sit on the 3% floor.
- 342 baked quads (109 x, 105 y, 128 z) at about 0.15 kpc; 272 survive transparent cropping into the compiled bank. Every one of the 342 material textures reproduces the newly fitted neutral alpha exactly.
- Fit width 384 × 380 px over tangent bounds −6.935…5.018 × −6.350…5.482 kpc at the 62.44 kpc observer distance.

**Lenses.** `finite-lenses-ellipsoid.json` bakes the same nine lenses onto this model, with the same exclusions and the same recorded reasons. `.local/nebula-lab/finite-lenses-075ce045….json` indexes their result ids.

**Stars.** `prepare-smc-stars labs/nebula/models/smc/constrained/finite-lenses-ellipsoid.json` writes `../stars/prepared/stars-ellipsoid.json` (1,803 Bonanos et al. 2010 massive stars) and the model-owned index `.local/nebula-lab/finite-stars-075ce045….json`. Depths sample the joint emission and **the ellipsoid** density, so the same measured rays land a median 0.48 kpc from their positions in the simulation-envelope model. Tangent positions are identical by construction.

**Application promotion.** This model's five publisher-image lenses are the shipped SMC object; see [the object's source-and-evidence README](../../../../../src/objects/smc/README.md) for the promotion recipe, the delivered bank and the app inspection record. The four FITS survey-band composites stay lab-only for the defects recorded in [candidate intake](../README-candidates.md#survey-band-composites).

**Known problems.** Unchanged from the two-scale section: faint concentric ripples in the outer halo where alpha is still quantized, and detail bounded by the 384-pixel fit. The envelope is now the *ellipsoid's* shape hypothesis, still not measured gas depth, and an ellipsoid that scores better against red-clump tracers is not a measurement of the gas body. The detail components remain conditioned on the simulation the same comparison disfavours.
