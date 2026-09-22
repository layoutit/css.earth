# Small Magellanic Cloud (SMC)

Five published images colour one shared three-dimensional emission model; **Horálek optical is the default**. Each lens carries the same 272 directional slices (80 x, 64 y, 128 z), packed into three WebP axis atlases, and the same 1,803 catalogue stars. All five lenses total 5,169,756 bytes of cloud textures in 15 files, so a lens costs three texture requests rather than 272. Nothing here measures gas or dust depth.

The shape is a hypothesis with two parts. A broad envelope carries 82.79% of the image light along the depth distribution of a **VMC-constrained ellipsoid**, and 476 fitted detail components sit at conditional modes of the **Garver stellar simulation** along their own sightlines. Catalogue-star depths are realizations inside that model, not distances.

## Sources

| Source / lens | Role and selected input |
| --- | --- |
| [Tatton et al. (2021) red clump](https://doi.org/10.1093/mnras/staa3857) with [ESO VMC DR5.1 PSF photometry](https://www.eso.org/rm/api/v1/public/releaseDescriptions/155) | 489,760 observed tracers constrain the envelope shape; their distances are standard-candle estimates, not geometry. |
| [Garver, Nidever, Debattista & Deg simulation](https://doi.org/10.5061/dryad.1vhhmgr82) | 225,000 stellar particles supply conditional line-of-sight modes for the detail components. |
| [Horálek optical, iotw2615a](https://noirlab.edu/public/images/iotw2615a/) | 6069 × 4045-pixel wide-field photograph; also the baseline the emission model was fitted to. |
| [ESO VISTA, eso1714a](https://www.eso.org/public/images/eso1714a/) | Y/J/Ks near-infrared display; 4000 × 3540 pixels. |
| [SMASH, noirlab2030b](https://noirlab.edu/public/images/noirlab2030b/) | DECam g/r/i/z optical survey image, 3827 × 3190 pixels; also the publisher sky anchor every relative registration is matched to. |
| [DSS2, heic0514c](https://esahubble.org/images/heic0514c/) | 13096 × 13616-pixel photographic plate composite; narrower footprint than VISTA or SMASH. |
| [AllWISE colour HiPS through CDS](https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FallWISE%2Fcolor&get=record&fmt=json) | W4/W2/W1 false colour over a 10° TAN field, 4000² pixels; not native detector sampling. |
| [Bonanos et al. (2010)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/140/416) | Observed sky positions and Johnson V for 1,803 selected massive stars; their depths are model-contained realizations. |

Native photographs supply colour after registered star removal; the two dust and PAH lab composites keep compact emission instead, and are not shipped. Every lens recolours the same neutral alpha, so switching lenses changes colour and never geometry. None of the images covers the full Bridge, Wing or tidal debris.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; "included" means used by this delivery, not scientifically validated, and the search was not exhaustive.

## Processing

1. **Shape.** The pinned simulation particles and a deterministic Gaussian ellipsoid are each fitted to VMC red-clump sky positions and distance moduli through an approximate survey selection and a magnitude-error kernel, on training regions only. Withheld deviance per observed count, lower better: **ellipsoid 0.45749**, affine simulation 0.60119, simulation with bounded regional weights 0.59503. The recipe and its scores are in [`fit.json`](source/evidence/smc/constrained/fit.json) and [`fit-evidence.json`](source/evidence/smc/constrained/fit-evidence.json); the method is described in [the shape trial](../../../labs/nebula/models/smc/constrained/README.md).
2. **Emission.** The registered, star-removed Horálek image is smoothed (σ = 10 fit pixels, about 0.4 kpc) and divided by the integrated ellipsoid column to give an envelope gain, so image brightness scales the envelope but never moves it in depth. The remaining detail is fitted with 476 positive finite components placed at the strongest simulation mode along each ray. [`emission-envelope-ellipsoid.json`](source/evidence/smc/constrained/emission-envelope-ellipsoid.json) is the recipe; [EMISSION-METHOD.md](../../../labs/nebula/models/smc/constrained/EMISSION-METHOD.md) explains the method, the earlier rejected attempts and this model's numbers.
3. **Lenses.** [`finite-lenses-ellipsoid.json`](source/evidence/smc/constrained/finite-lenses-ellipsoid.json) bakes each registered image onto that one geometry, and the promotion installs the five publisher-image lenses here with identity appearance controls ([receipt](source/lens-settings-evidence.json)). The [compact inputs](source/compact/inputs.json) then carry exactly what a replay needs: the fitted field, the envelope gain map, the neutral alpha bank, the depth density and, per lens, the registered colour raster with an alpha-only coverage mask, because only that alpha is ever read from the registered original. Each delivered byte's laboratory record is numbered under [`bake-inputs/references/`](source/bake-inputs/references).
4. **Stars.** Table 3 rows with finite V ≤ 16 whose measured ray lands on a covered footprint pixel; each depth inverts the joint emission × ellipsoid density × (1+z/D)² CDF at a fixed per-star quantile. [Star preparation](../../../labs/nebula/models/smc/stars/README.md) records the selection and its guards.

## Evidence

- **Fit.** Total front-projection relative squared error 0.006282; projection RMSE 0.01264 after fitting against 0.04694 before. The envelope carries 82.79% of the image light with 2.98% excess. 8 of the 476 components (0.35% of projected light) found no prior support and keep an authored finite depth. All 342 baked material textures reproduce the newly fitted neutral alpha exactly.
- **Registration.** The pinned [alignment report](source/evidence/smc/registration/alignment-report.json) qualifies all five shipped images; no threshold was relaxed for a rejected one. AllWISE has its own catalogue check against 7,172 bright W1 stars; SMASH's absolute solution remains the publisher's.
- **Stars against images.** Of the 40 brightest stars projected onto each registered original, those within 1 px of a photographic peak: Horálek 22 (median 0.67 px), DSS2 35 (0.70 px), VISTA 20 (3.12 px), AllWISE 14 (3.84 px), SMASH 9 (5.26 px). Mirroring east–west gives 0 for every image.
- **App inspection.** [The merged-tree inspection](evidence/merged-2026-09-17/inspection.json) is the current acceptance, with [the atlas-delivery run](evidence/atlas-delivery-2026-09-17/inspection.json) before the `main` merge and [the original slice-delivery run](evidence/promotion-2026-09-17/inspection.json) before that: each lens decodes one texture at the Earth framing instead of 128, the world camera is unchanged across all five switches, all 1,803 stars mount and toggle, the route raises no page error and no failing request, and Earth, oblique and both exact 90° side views are unchanged from the slice delivery. [The original slice-delivery inspection](evidence/promotion-2026-09-17/inspection.json) and its captures hold this promotion's Earth view, an oblique view, both exact 90° side views, all five lens switches and stars on and off, taken from the running application by the shared browser conformance harness. Every lens decoded 128 textures at the Earth framing, a lens switch left the world camera unchanged, all 1,803 stars mounted and rendered visible, and the route raised no page error and no failing request. The side views show line-of-sight extent rather than a flat sheet.
- **Delivery and replay.** `prepared/` is generated, not committed: `pnpm prepare:nebulae --if-missing` rebuilds the bank and its atlases from [the compact inputs](source/compact/inputs.json) alone, and the [object descriptor](object.json) pins the result. Verified with the ignored laboratory caches moved aside, from a removed `prepared/`: **all 1,360 regenerated slice textures are byte-identical** to the promotion output, every lens is value-identical in label, stars, brightness, frame, provenance and leaf geometry, and the committed descriptor pin matches the regenerated bank. Startup verification then reads every delivered atlas against the bank before the view is offered.
- **Model identity.** The accepted fit was re-derived as `ed2688a0…` after the envelope samplers, observer-ray conversion and prior loader moved to the owners a delivery replay may import; `075ce045…` was the pre-relocation identity of the same fit. The emission field, the envelope, all 342 neutral textures and every registered raster are byte-identical, and every fit metric matches to the last digit.

## Known problems

- The envelope is the ellipsoid's shape hypothesis and the detail components are conditioned on the simulation that the same VMC comparison disfavours. The two therefore carry different depth hypotheses, and neither is measured gas geometry. The model records `materialGatePassed: false`.
- Photometric red-clump distances include intrinsic luminosity scatter, photometric error, reddening uncertainty and contamination, and have not been deconvolved into geometric depth. Large-scale extensions outside the survey footprint remain model-dependent.
- Faint concentric ripples remain in the outer halo where alpha is still quantized. Detail resolution is bounded by the 384-pixel fit and 128 slabs.
- Star removal leaves crowded and saturated stars and can remove compact nebular light. A bright foreground cluster is masked by an authored exclusion rather than classified.
- The five per-lens `catalogue-stars.json` records the promotion writes are byte-identical copies of one star layer, so `source/lenses/` carries about 3.8 MB of duplication. That is the shape the shared promotion tool produces; the replay inputs reference a single copy.
- The four survey-band FITS composites are not shipped: the AllWISE W2 background gradient toward the south-east, W3 Galactic cirrus and scattered light, SPIRE covering only about 26% of the rectified field and uncorrected DSS2 plate-to-plate steps are all still present in them.

<details>
<summary>Retired image-layer delivery</summary>

Until this promotion the SMC was an `image-layer-bank`: one SMASH image spread through 32 normalized parametric slabs with an adopted 25 kpc thickness and no observational depth constraint. Its prepared bank and 96 layer images are removed. Its [source record](source/provenance.json) and [recipe](source/recipe.json) are retained as documents, and its publisher photograph is retained and reused as the SMASH lens preview. The earlier README's 2026-09-12 layer-replay account belongs to that retired delivery and is not evidence for this one.

</details>

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions and SHA-256 pins are preserved; nested research paths describe historical inputs and are not application file reads.
