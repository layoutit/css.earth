# Carina: next physical-evidence experiment

Intake: 12 September 2026. The [evidence ledger](physical-evidence.json) now supplies the [authored depth recipe](depth-model.json) selected by the compiler. This records configuration, not a completed new bake or physical fit. The target is the **Carina Nebula complex**, not Eta Carinae's much smaller Homunculus.

## Why this tests a different problem

[Damiani et al. 2016](https://arxiv.org/html/1604.01208) identifies several distorted, locally expanding regions near Trumpler 14, Eta Car and WR25, with obscuring lanes and locally preferred directions. Approximate five-arcminute shell scales belong to these regions, not the entire complex. Their Figure 34 uses an assumed velocity-to-distance factor; it is a model hypothesis, not a measured 3D point cloud. Broad Halpha wings can include reflected Eta Car emission, so not every high velocity belongs to local emitting gas.

Our existing lenses cover roughly 33′ × 33′ optically and 88′ × 72′ in VISTA. The present solver supports only **one smooth height surface with finite thickness**: a broad unconstrained warp plus three localized deformations near independently checked cluster/star anchors. Published topology motivates their placement, but every depth, curvature, width and blend strength is authored. It does not reconstruct separate overlapping shells, a molecular-cloud network, foreground dust or true empty cavities. Do not inflate a single stellar ejecta model to fill either photograph.

## Data and research packet

| Source | Available constraint | Access and limitation |
| --- | --- | --- |
| [Damiani optical line catalogue, CDS J/A+A/591/A74](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/591/A74) | 866 fitted blue/red line-component records at 666 distinct sky positions; Halpha, [NII], HeI and [SII] | Downloaded 244 KB table and 10 KB ReadMe. Approximately 21′ × 24′ sparse central coverage; no velocity-uncertainty columns. |
| [Rebolledo et al. 2016, molecular clouds](https://arxiv.org/html/1511.07513) | Eight square degrees of CO spectroscopy; Northern Cloud, Southern Cloud, Southern Pillars and Gum31 have different structures | [CSIRO survey release](https://doi.org/10.25919/9Z4P-MJ92) identified; no cube acquired. Qualify selected release/tile and line frame before importing. |
| [Preibisch et al. Herschel project](https://www.usm.uni-muenchen.de/people/preibisch/carina-herschel.html) | Five far-infrared bands over 2.3° × 2.3°; filaments, pillars and cloud column/temperature estimates | Author page/paper inspected; FITS products not retrieved. Column density and temperature are not spatial depth. |
| [Shull et al. 2021](https://arxiv.org/abs/2103.07922) and [Preibisch et al. 2022](https://arxiv.org/abs/2201.09097) | Gaia-based cluster distances around 2.35 kpc; the latter finds investigated cluster distances consistent within approximately 2% | Useful projected scale and stellar context; cluster-distance agreement does not determine individual gas depths. Preserve each study's uncertainties and selection. |
| [Smith & Brooks 2007, global nebulosity](https://academic.oup.com/mnras/article/379/4/1279/996059) | Large north/south cavities, molecular remnants and widespread feedback | Global morphology is useful context; do not equate a projected bipolar cavity with a single measured expansion law. |

The [source manifest](physical-sources.json) pins the downloaded table and ReadMe. Velocities are heliocentric. The sigma columns describe line width, including instrumental broadening; **they are not velocity measurement errors**. Preserve blanks and fibre/setup identities. Repeated sky positions must remain grouped when withholding observations.

## Configured comparison and remaining work

The recipe uses the same ICRS origin as `observations.json` and the compiler's west/north/away axes. Anchor offsets follow the existing small-angle west/north helper; the ledger retains the original ICRS coordinates and their catalogue epoch/quality. The roughly five-arcminute trial windows are not measured boundaries. Smooth local blending selects one depth per sightline, and all lenses paint that same support. The ledger hash is part of the runnable recipe.

1. Register the line-catalogue positions on the existing image frame and show their actual coverage. Start with qualified sky-fibre components; keep stellar-fibre contamination and failed fits visible.
2. Compile the configured single-front trial. Treat its local deformations as a coarse appearance hypothesis, not a recovery of the paper's multiple physical regions. Every unmeasured depth and thickness is declared authored in the recipe and ledger.
3. Compare the same front, oblique and side views against the current centered-depth baseline. Keep optical and VISTA geometry/alpha/stars identical.
4. Add a measured-velocity forward fit only after choosing defensible component/motion hypotheses and an uncertainty policy. Obtain dust/CO maps before treating obscuring lanes, pillars or reflected light as recovered material.

Use the shared [Nebula Compiler Process Guidelines](../../docs/nebula-compiler-guidelines.md). No Carina-specific algorithm branch, global Homunculus prior or direct velocity-to-depth conversion is needed.
