# Milky Way dust in the fitted galaxy

Dust contributes to the accepted b30 slab and inside-sky bake described in the [Milky Way volume source-and-evidence document](../milky-way-volume/README.md). This change publishes that presentation; it does not publish the experimental dust or stellar octrees.

## Sources

| Component | Source and meaning |
| --- | --- |
| Local dust | [Edenhofer et al. (2024), v1.0.2](https://zenodo.org/records/10658339): inferred extinction within 1.25 kpc. |
| Regional dust | [Vergely et al. (2022), CDS J/A+A/664/A174](https://cdsarc.cds.unistra.fr/ftp/J/A+A/664/A174/ReadMe): inferred extinction density, 50 pc cube. |
| Inner dust | [Marshall et al. (2006), CDS J/A+A/453/635](https://cdsarc.cds.unistra.fr/ftp/J/A+A/453/635/ReadMe): 2MASS/model-derived extinction constraints. |
| Far dust | [Drimmel et al. (2003), grids v1](https://zenodo.org/records/7340108): modeled extinction. |

The [lineage record](../milky-way-volume/source/preparation/b30/lineage.json), fitted parameters, compact source inputs and acquisition manifest live with the consuming volume. Wang et al. and the earlier dust-point representation are not inputs promoted by this change.

## Evidence

All 78 production slab PNGs reproduce the accepted step-19 outputs exactly, including their original canonical crops and empty borders. All 84 inside-sky faces reproduce the accepted skies. The independent golden, locality and extent tests exercise the actual producer. See the consuming volume's README and draft PR for check results and inspected views.

## Known problems

Scalar-alpha compositing approximates wavelength-dependent extinction, scattering and post-integration tone. It cannot exactly reproduce b30's spectral radiative transfer. Finite-slab stripes, X/Y criss-cross, some far-only blackouts and edge-on extent differences remain visible limitations. These errors are not additional measured dust structure.
