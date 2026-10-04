# GJ 367 b

## Sources

It is one of 3 planets known around Añañuca. Its orbit and size follow Lee et al. 2026's fit, the archive's default. The introduction is generated from Lee et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.06566164 Jupiter radii from Lee et al. 2026 (2026arXiv260618355L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260618355L/abstract): 4,694.3 km at 71,492 km per Jupiter radius. GM from the mass 0.00158261 Jupiter masses (Lee et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026arXiv260618355L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026arXiv260618355L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 0.3219233 d Lee et al. 2026 (2026arXiv260618355L), via the NASA Exoplanet Archive ps table (pl_refname LEE_ET_AL_2026): a/R* 3.33; Lee et al. 2026 (2026arXiv260618355L), via the NASA Exoplanet Archive ps table (pl_refname LEE_ET_AL_2026): inclination 78.6 degrees Lee et al. 2026 (2026arXiv260618355L), via the NASA Exoplanet Archive ps table (pl_refname LEE_ET_AL_2026): e 0 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460013.7131 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by gj-367's measured color (#ffc589, the color dataset of gj-367 (src/objects/gj-367/source/photometry/stellar-color.json)) at the gray's own brightness.

**Rock model.** The page opens on a model set by one measurement: the 5 to 12 µm eclipse depth of Zhang et al. (2024, ApJL, [arXiv:2401.01400](https://arxiv.org/abs/2401.01400), [doi:10.3847/2041-8213/ad1a07](https://doi.org/10.3847/2041-8213/ad1a07)), 75 to 83 ppm ([record](source/science/zhang-2024/dayside-5-12um.json)), which the paper finds fully consistent with a zero-albedo planet with no heat recirculation: a dark, hot, airless sub-Earth. The `bare-rock-eclipse` format draws the bare rock that shows that depth ([a rock set by one eclipse depth](../../../docs/eclipse-mapping.md#a-rock-set-by-one-eclipse-depth)): no atmosphere and no heat transport, 1,991 K under the star (1,930 to 2,052 K across the depth's range), falling as cos^(1/4) of the angle from it, and nothing at night. The depth becomes a temperature through the JWST MIRI LRS throughput table released with Valentine et al. (2024) ([Zenodo record 12571830](https://zenodo.org/records/12571830), CC BY 4.0), summed as counted photons over the wavelengths the paper summed, and the BT-Settl model spectrum at 3500 K, log g 5.0, the grid point nearest the star's cited values, from the Spanish Virtual Observatory. The radius ratio is the one the paper fitted with the depth, 0.01364 ± 0.00023, not this package's 0.0148: the two belong to one fit. Only the dayside brightness is drawn from.

**Charts.** The orbits of Añañuca's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (89, 90, 99), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-367b.json).

- Run of 2026-10-04: [`new-object --rock-eclipse`](../../../packages/telescope-cli/src/new-object/rock/rock-eclipse-dataset.mts) wrote the dataset from the paper's depth. The paper's dayside temperature was not an input: the uniform day side that shows the same depth here is 1,773 K against the printed 1,728 ± 90 K (+0.5 sigma), which tests the throughput table, the stellar model and the radius ratio together. With this package's own radius ratio it would be 1,616 K.


## Known problems

- **A model, not a map.** The day side's brightness in one band sets it. The night side is drawn dark because a bare rock's is.
- **The phase curve is not drawn.** The paper also followed the planet round its orbit: a night side of 4 ± 8 ppm, consistent with dark, and a hot spot 11 ± 5° east that the authors do not take as ruling out zero. Its fit is second order and printed only as derived numbers, so it cannot be redrawn; the rock model is the paper's own reading of it.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gliese 367 b" (revision 1374088283) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
