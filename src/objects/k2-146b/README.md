# K2-146 b

## Sources

It is one of 2 planets known around K2-146. Its orbit and size follow Hamann et al. 2019's fit, the archive's default. This account was drafted from Hamann et al. 2019's values; the sections below are the data's own.

**Size and mass.** Radius 0.18288875 Jupiter radii from Hamann et al. 2019 (2019AJ....158..133H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....158..133H/abstract): 13,075.1 km at 71,492 km per Jupiter radius. GM from the mass 0.01816 Jupiter masses (Hamann et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....158..133H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....158..133H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hirano et al. 2018 (2018AJ....155..127H), via the NASA Exoplanet Archive ps table (pl_refname HIRANO_ET_AL__2018): P 2.644646 d Hamann et al. 2019 (2019AJ....158..133H), via the NASA Exoplanet Archive ps table (pl_refname HAMANN_ET_AL__2019): a/R* derived by Kepler's third law from its period 2.644646 d, stellar mass 0.331 and radius 0.33 solar units; Hamann et al. 2019 (2019AJ....158..133H), via the NASA Exoplanet Archive ps table (pl_refname HAMANN_ET_AL__2019): inclination 88.93 degrees Hamann et al. 2019 (2019AJ....158..133H), via the NASA Exoplanet Archive ps table (pl_refname HAMANN_ET_AL__2019): e 0.129 Hamann et al. 2019 (2019AJ....158..133H), via the NASA Exoplanet Archive ps table (pl_refname HAMANN_ET_AL__2019): omega -64 degrees, stored as 296 Hirano et al. 2018 (2018AJ....155..127H), via the NASA Exoplanet Archive ps table (pl_refname HIRANO_ET_AL__2018): transit mid-time 2457139.35327 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 91 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-146's measured colour (#ffca85, the colour lens of k2-146 (src/objects/k2-146/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-146's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-146b.json).


## Known problems

- **Orbit convention.** omega -64 degrees is taken as Hamann et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.129) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
