# LHS 1678 b

## Sources

It is one of 3 planets known around LHS 1678. Its orbit and size follow Silverstein et al. 2022's fit, the archive's default. The introduction is generated from Silverstein et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.06111171 Jupiter radii from Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..255S/abstract): 4,369 km at 71,492 km per Jupiter radius. No mass is measured: Silverstein et al. 2022 (2022AJ....163..151S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..151S/abstract) gives only an upper limit of 0.00110122 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): P 0.8602325 d Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): a/R* 8.08; Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): inclination 88.53 degrees Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): e 0.033 Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): omega -23 degrees, stored as 337 Silverstein et al. 2024 (2024AJ....167..255S), via the NASA Exoplanet Archive ps table (pl_refname SILVERSTEIN_ET_AL_2024): transit mid-time 2458998.15553 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at 1,109 K, the hottest day side a dark, airless rock can have on its orbit, computed from lhs-1678's temperature, 3490 K, and the orbit's a/R* 8.08, as T* (R*/a)^(1/2) (2/3)^(1/4): #ff4200. Chosen by rule: the bare-rock maximum, no light reflected and no heat carried to the night side; the star's temperature is Silverstein et al. 2022, the stellar temperature of the default parameter set of LHS 1678 b in the NASA Exoplanet Archive, a/R* is Silverstein et al. 2024. Nine rocky planets of red dwarfs with a measured day side fall within 13% of this kind of estimate (Coy et al. 2025); GJ 357 b, measured since, is 35% above it; see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Charts.** The orbits of LHS 1678's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (31, 32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/lhs-1678b.json).

## Known problems

- **Orbit convention.** omega -23 degrees is taken as Silverstein et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.033) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
