# Twin Jet Nebula (M2–9)

One Hubble optical lens displays an axially symmetric, image-conditioned emission model. **Depth and inclination are not measured.** The adopted physical scale remains substantially uncertain.

## Sources

| Source | Role and limits |
| --- | --- |
| [Hubble/WFPC2, opo9738a](https://esahubble.org/images/opo9738a/) and [APOD 2004-02-01](https://apod.nasa.gov/apod/ap040201.html) | Same 1997 optical photograph, with [O I]/nitrogen/[O III] display colors; the pinned 800 × 525 JPEG supplies the image. |
| [Wenger, Lorenz & Magnor (2013)](https://doi.org/10.1111/cgf.12216) | Independently implemented axial group-sparsity method; no author code or restricted downloadable volumes are used. |
| [Image-frame record](source/image-frame.json) | Native hashes and cross-edition astrometry; caption-free 788 × 438 crop, 58.0350″ × 32.2766″. |

The adopted **650 pc** distance follows [Sánchez Contreras et al. (2024), §2](https://arxiv.org/html/2411.03825v1#S2). [Corradi et al. (2011), abstract](https://arxiv.org/abs/1102.5634) report an expansion distance of 1300 ± 200 pc, which would double this model’s physical size. At 650 pc the displayed crop is about 0.183 pc wide, not the full nebula’s measured extent.

The [stellar field](source/stellar-field.json) supplies seven Gaia sources in an authored 10 pc sphere, G < 14, using Bailer-Jones distance estimates with uncertainty intervals. The original four manually masked image points are a removal aid, not a catalogue or measured membership sample.

Exact input identities, credits, reuse terms and processing pins are in the [source manifest](source/manifest.json). The [investigation ledger](investigations.json) records selected and rejected routes; “included” means used by this delivery, not scientifically validated.

## Evidence

- [Delivery](source/delivery.json) retains the 144-slice symmetry result and adds the independently prepared catalogue field. This does not rerun or relabel the original separation as NOX.
- The [fixed experiment report](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m2-9/README.md) records synthetic hollow-shell and zero-regularization controls, real front/oblique inspection and the original test/build results. Source-image fit errors are not physical depth errors.
- This provenance update makes no fresh cold-replay, independent scientific-review or material-acceptance claim. The historical external review timed out and was not completed.

## Known problems

- Authored axis position and zero inclination select one of many possible depths from a single photograph.
- Faint planar background, rings and directional color/brightness changes remain in oblique views. Photographic RGB is neither calibrated additive emission nor measured density.
- The small working grid is a bounded method trial; finer source pixels alone cannot resolve the distance or symmetry ambiguity.

<details>
<summary>Methods and historical comparisons</summary>

The [fixed lab account](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/models/m2-9/README.md) preserves crop, manual point masks, independent FISTA/proximal implementation, original timings and failed-view limitations. The [planetary-nebula method](https://github.com/layoutit/css.earth/blob/5569fa211db447927cb9c30284f13d2a37049695/labs/nebula/docs/planetary-nebulae.md) describes the paper and its constraints. Common preparation is in the [nebula guide](../../../docs/nebulae/README.md).

</details>

## Compact delivery inputs

The source-owned compact input pin in [delivery.json](source/delivery.json) retains the accepted pre-slice model, material and integration data. Ordinary preparation regenerates the runtime WebP Q80/A80 XYZ atlases and distant impostors without native observation downloads, star extraction or model fitting. Runtime images remain generated and ignored. The [shared bake guide](../../../docs/nebulae/README.md#compact-inputs-and-research-replay) distinguishes this replay from optional full research processing. Source observations and the model limitations above still apply.

Application provenance reads the object-owned evidence and recipe copies recorded in [provenance references](source/provenance-references.json). Their original revisions and SHA-256 pins are preserved; nested research paths describe historical inputs and are not application file reads.
