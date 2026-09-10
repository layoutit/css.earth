# LMC volume lenses

Three prepared materials paint the same simulated LMC density cloud: **ESO VISTA** near infrared (default), **Horálek optical**, and **NASA WISE** infrared. Each lens has 144 directional slices and the same 943 catalogue stars. The shared world camera, focused-object sidebar and star toggle own navigation and presentation; switching material does not move the cloud or catalogue.

## Sources and interpretation

- Shape: [Garver, Nidever, Debattista & Deg stellar simulation](https://doi.org/10.5061/dryad.1vhhmgr82), prepared in the Nebula Lab's full-density model. This is a stellar-density prior, not measured gas/dust depth.
- VISTA color: [ESO, eso1914a](https://www.eso.org/public/images/eso1914a/).
- Optical color: [NOIRLab/NSF/AURA/P. Horálek, iotw2547a](https://noirlab.edu/public/images/iotw2547a/).
- WISE color: NASA/IPAC WISE survey data; the per-lens provenance records the exact registered survey mosaic, bands and source hashes.
- Stars: [Bonanos et al. (2009), CDS/VizieR J/AJ/138/1003](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003), observed catalogue astrometry/photometry with deterministic modeled depths conditioned on this same density cloud. Candidate images do not move or select stars.

Native sources were registered and passed through NOX once. Reconstruction samples the saved starless image's colors on the existing density slices and preserves their geometry and every alpha byte. Uncovered regions keep neutral density material; none of these images covers the entire model.

## Saved appearance

The browser handoff at `2026-09-09T23:12:20.083Z` pins the current VISTA result, the user's completed Horálek job, and the WISE result referenced by saved applied controls. The receipt hash and selection evidence are retained without copying unrelated browser storage.

| Lens | Brightness | Gamma | Saturation | Detail | Detail scale |
|---|---:|---:|---:|---:|---:|
| ESO VISTA | 0.85 | 0.9 | 1.3 | 1 | 24 |
| Horálek optical | 1.3 | 1.3 | 2.5 | 1.95 | 96 |
| NASA WISE | 1 | 1 | 1 | 0 | 24 |

All three use saved cloud attenuation 1 on each axis, cutoff 0, softness 0.25, stars enabled, stellar exposure 1 and size 0.95. Material controls are already in the prepared pixels; runtime does not apply them a second time. WISE has no newer personal appearance draft or job in the handoff.

## Reproduce the handoff

`source/lenses.json` pins exact reconstruction IDs and display choices. `source/lenses/<image>/` retains each result, processing provenance, star catalogue and selected parts. `source/lens-manifest.json` pins delivery bytes. The previous SMASH source image, recipe and provenance remain as historical inputs; the old prepared image-layer bank is superseded.

From a clean checkout with Node 22, pnpm and Python 3.9–3.12:

```sh
pnpm install --frozen-lockfile
pnpm lab:nebula:bake
pnpm dev
```

The bake acquires hash-pinned originals and the NOX model, prepares its Python environment, and recreates star removal, density colors and catalogue placement from saved settings. No previous processing cache is required. All 432 app slice WebPs are ignored generated outputs; the bake verifies every texture against the accepted manifest before restoring it locally. Descriptors, settings and provenance remain versioned. See [baking](../../../labs/nebula/docs/baking.md) for dependencies, stages and cache recovery.

App development/build and shell tests run `pnpm prepare:nebulae` automatically: a complete verified delivery is reused; missing textures trigger the bake. This does not publish assets or alter the accepted geometry/material metadata.

## Remaining visual limits

These are visualization lenses on modeled depth, not independent 3D observations. XYZ slice handoff brightness/banding and finite-resolution detail remain lab research issues; promotion does not solve them. See [slice stability](../../../labs/nebula/docs/slice-stability.md), [research](../../../labs/nebula/RESEARCH.md) and [next steps](../../../labs/nebula/NEXTSTEPS.md).
