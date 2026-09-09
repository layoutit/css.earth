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

From a clean checkout, restore the pinned native inputs and completed reconstruction cache described in [the lab workflow](../../../labs/nebula/docs/workflows.md), then:

```sh
pnpm install --frozen-lockfile
node --experimental-strip-types labs/nebula/src/run.ts promote-volume-lenses src/objects/lmc/source/lenses.json .local/lmc-promoted
```

Native originals and completed lab cache are deliberately local and are not fetched by that command. Missing pinned inputs fail rather than producing substitutes. Verify the staged manifest and fixed-camera views before replacing the checked-in bank.

## Remaining visual limits

These are visualization lenses on modeled depth, not independent 3D observations. XYZ slice handoff brightness/banding and finite-resolution detail remain lab research issues; promotion does not solve them. See [slice stability](../../../labs/nebula/docs/slice-stability.md), [research](../../../labs/nebula/RESEARCH.md) and [next steps](../../../labs/nebula/NEXTSTEPS.md).
