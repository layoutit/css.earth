# TOI-2445 b

## Sources

It is the only planet known around TOI-2445. Its orbit and size follow Giacalone et al. 2022's fit, the archive's default. The introduction is generated from Giacalone et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.11151772 Jupiter radii from Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163...99G/abstract): 7,972.6 km at 71,492 km per Jupiter radius. GM from the mass 0.0066 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): P 0.3711281 d Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): a/R* derived from its semi-major axis 0.0064 au and stellar radius 0.27 solar radii; Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): inclination derived from its impact parameter 0.27 with its a/R* 5.0971 (Winn 2010, eq. 7) No archive row states an eccentricity; the orbit is taken as circular Giacalone et al. 2022 (2022AJ....163...99G), via the NASA Exoplanet Archive ps table (pl_refname GIACALONE_ET_AL__2022): transit mid-time 2459144.5697 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at 1,334 K, the hottest day side a dark, airless rock can have on its orbit, computed from toi-2445's temperature, 3333 K, and the orbit's a/R* 5.0971, as T* (R*/a)^(1/2) (2/3)^(1/4): #ff5e00. Chosen by rule: the bare-rock maximum, no light reflected and no heat carried to the night side; the star's temperature is Giacalone et al. 2022, the stellar temperature of the default parameter set of TOI-2445 b in the NASA Exoplanet Archive, a/R* is Giacalone et al. 2022. Nine rocky planets of red dwarfs with a measured day side fall within 13% of this kind of estimate (Coy et al. 2025); GJ 357 b, measured since, is 35% above it; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of TOI-2445's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2445b.json).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
