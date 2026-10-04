# TOI-206 b

## Sources

It is the only planet known around TOI-206. Its orbit and size follow Giacalone et al. 2022's fit, the archive's default. The introduction is generated from Giacalone et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11597843 Jupiter radii from Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract): 8,291.5 km at 71,492 km per Jupiter radius. GM from the mass 0.00705 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): P 0.7363104 d Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): a/R* derived from its semi-major axis 0.0112 au and stellar radius 0.35 solar radii; Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): inclination derived from its impact parameter 0.66 with its a/R* 6.881 (Winn 2010, eq. 7) No archive row states an eccentricity; the orbit is taken as circular Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): transit mid-time 2458325.5431 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at 1,165 K, the hottest day side a dark, airless rock can have on its orbit, computed from toi-206's temperature, 3383 K, and the orbit's a/R* 6.881, as T* (R*/a)^(1/2) (2/3)^(1/4): #ff4a00. Chosen by rule: the bare-rock maximum, no light reflected and no heat carried to the night side; the star's temperature is Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-206 b in the NASA Exoplanet Archive, a/R* is Giacalone et al. 2022. Nine rocky planets of red dwarfs with a measured day side fall within 13% of this kind of estimate (Coy et al. 2025); GJ 357 b, measured since, is 35% above it; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of TOI-206's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (96, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-206b.json).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
