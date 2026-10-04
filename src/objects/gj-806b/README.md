# GJ 806 b

## Sources

It is one of 2 planets known around GJ 806. Its orbit and size follow Palle et al. 2023's fit, the archive's default. The introduction is generated from Palle et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11874407 Jupiter radii from Palle et al. 2023 (2023A&A...678A..80P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...678A..80P/abstract): 8,489.3 km at 71,492 km per Jupiter radius. GM from the mass 0.00597807 Jupiter masses (Palle et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...678A..80P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...678A..80P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 0.9263237 d Palle et al. 2023 (2023A&A...678A..80P), via the NASA Exoplanet Archive ps table (pl_refname PALLE_ET_AL__2023): a/R* 7.3; Palle et al. 2023 (2023A&A...678A..80P), via the NASA Exoplanet Archive ps table (pl_refname PALLE_ET_AL__2023): inclination 87.7 degrees No archive row states an eccentricity; the orbit is taken as circular ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460559.015552 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at 1,204 K, the hottest day side a dark, airless rock can have on its orbit, computed from gj-806's temperature, 3600 K, and the orbit's a/R* 7.3, as T* (R*/a)^(1/2) (2/3)^(1/4): #ff4f00. Chosen by rule: the bare-rock maximum, no light reflected and no heat carried to the night side; the star's temperature is Palle et al. 2023, the stellar temperature of the default parameter set of GJ 806 b in the NASA Exoplanet Archive, a/R* is Palle et al. 2023. Nine rocky planets of red dwarfs with a measured day side fall within 13% of this kind of estimate (Coy et al. 2025); GJ 357 b, measured since, is 35% above it; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of GJ 806's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (76, 82, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-806b.json).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
