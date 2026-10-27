# Large Magellanic Cloud (LMC)

The local site uses the owner-approved **l36 optical model**. Its immutable local tag is `lmc-approved-model`. The [accepted recipe](source/preparation/l36/recipe.json), [fitted grade](source/preparation/l36/fit.json) and [parent lineage](source/preparation/l36/lineage.json) preserve the model and its version history. Delivery does not refit its physical structure or appearance.

The model combines measured stellar populations, finite catalogue objects and dust on the published warped disc. Horálek's photograph calibrates component colors, object brightness and the approved dust material. It does not become a diffuse sheet of light in the volume. Individual catalogue objects retain their approved on-sky footprints and finite depths.

## Sources

| Component | Source and use |
| --- | --- |
| Distance and frame | Pietrzyński's 49.59 kpc distance, Choi's disc plane, Oden's distance surface and Rathore's bar placement. The [initial geometry lineage](source/preparation/l1/lineage.json) records the papers and qualifications. |
| Old disc and bar light | Gaia DR3 red giant and red clump populations, with the accepted l21 crowding correction. Kacharov and Rathore remain structural checks. Measured Gaia photometry supplies stellar grain; the accepted population grade supplies integrated color. |
| Young stars | Gaia DR3 young members, MCPS hot stars and Bica associations. The accepted density structure and smoothing are retained; SMASH is a check. |
| Finite objects | The l11/l12 catalogue regions, clusters, shells and molecular clouds, with approved object footprints. Knots have depth comparable to sky width. No new gas mosaic is introduced by this delivery. |
| Dust | HERITAGE fine structure, Bell's large-scale column calibration and OGLE regional foreground fractions. Chen's published mean foreground reddening is retained; its unavailable regional maps are not treated as downloaded data. The accepted l28 dust material and l36 strength remain fixed. |
| Appearance | [Horálek optical](https://noirlab.edu/public/images/iotw2547a/) is the Earth-view calibration image. VISTA and WISE remain source checks; this model has no calibrated infrared emissivity. |

The adopted Gaussian thicknesses remain 410 pc for the old disc, 367 pc for the bar, 150 pc for diffuse young stars and gas, and 250 pc for dust. These are model assumptions and published-model choices, not precise depths recovered from the photograph. The [source manifest](source/manifest.json) owns input identities, credits and acquisition routes.

## Preparation and delivery

The [native resolution qualification](source/preparation/l36/resolution.json) redeposits the same catalogue populations onto 9.77 pc cells, uses a 15 pc ray step and samples finite objects at 4 by 4 subpixels. It preserves the accepted component budgets, grades, warp and depths. Outside views use the same physical image scale as Earth's view.

The [full native bake](source/preparation/l36/full-native.json) reuses the Milky Way slab pipeline. It contains 26 physical slabs, distributed 10/9/7 over the axes, plus seven second optical layers: **33 layers total**. Textures are 2048 px across 20 kpc. The accepted 128 px pilot's encoding coefficients and split-slab choices are frozen. No new fit is performed at full resolution.

The [far bank](source/preparation/l36/far-native.json) contains direct source-model pictures at 3072 px, or 9.31 pc per texel at the disc centre. It never renders completed slabs into pictures. Eight prepared directions cover the viewing sphere, including the Sun direction, face-on, 45 degrees and edge-on. The shared far-picture mechanism uses these images at Earth distance, even when magnified. Slabs carry close views within 20 kpc; the distance handoff ends at 35 kpc. The universe backing reuses the same Sun-facing model picture on the existing fixed plane.

The [delivery record](source/delivery.json) names the LMC generator and completed local checkpoints. The previous compact recipe is archived under `source/legacy/`; it must not regenerate the retired model. The optical dataset replaces that bank's old three-dimensional image fits. Infrared source observations remain available as checks. Catalogue grain is already baked, so an extra runtime catalogue does not add a second copy of its light.

## Validation

The owner [accepted the near pilot](source/preparation/l36/delivery-acceptance.json) by comparison with the Milky Way's shipped approximation. The absolute-gate failures remain recorded; acceptance does not erase them.

| Near view, 128 px test grid | Full native LMC CSS error | Shipped Milky Way CSS error |
| --- | ---: | ---: |
| Face-on | 10.48% | 21.67% |
| 45 degrees | 12.79% | 14.13% |
| Edge-on | 9.70% | 10.91% |

These are encoded relative L1 errors from actual retained CSS rendering, against each model's physical reference. The full-bank merged-copy face-on encoded-alpha loss is **0.309%**. It is not a luminosity-loss measurement. All twenty full-resolution matched CSS views are below their Milky Way errors. The earlier pilot's two exceptions remain recorded with that pilot.

The [real-site qualification](source/preparation/l36/site-native.json) verifies the published physical camera, active far or near presentation and decoded images in Chrome. The four 1024 px views span 9.47 kpc, or 9.25 pc per pixel at the disc centre. The local comparison sheet and enlarged owner-pin crops use the app’s existing embed mode; the normal app captures are retained alongside them. No page errors occurred.

Whole-frame and tiled model projections agree byte for byte at the pilot cameras. The default Milky Way replay remains byte-identical for its 33 slab PNGs, six sky faces and inventory. Runtime images and screenshots stay in ignored local storage.

## Known problems

- Scalar RGBA slabs approximate spectral extinction, display grading after integration and emitter positions inside thick intervals. Absolute light, radial-profile and color limits are not all met. These remain known problems under the owner's accepted comparison standard.
- A far picture is exact, to its recorded 8-bit encoding, at its prepared direction and 49.59 kpc camera distance. Angular interpolation and other far distances approximate changes in depth projection. The universe's fixed backing foreshortens away from the Sun direction.
- The optical photograph constrains one direction. Unobserved depth remains conditional on the adopted disc, warp, bar and finite-object geometry. Catalogue and Hα coverage limitations remain those of the approved model.
- The photograph includes a display sky background. It is not emitted by galaxy textures. Physical site comparisons reproject the photograph through its recorded registration, without reflecting the world camera.
- This delivery is local and unpublished. A fresh checkout cannot fetch these new assets from R2 yet. Phone performance is unqualified until a connected device is tested.
