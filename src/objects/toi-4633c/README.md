# TOI-4633 c

## Sources

It is the only planet known around TOI-4633. Its orbit and size follow Eisner et al. 2024's fit, the archive's default. This account was drafted from Eisner et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.28548537 Jupiter radii from Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..241E/abstract): 20,409.9 km at 71,492 km per Jupiter radius. No mass is measured: Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..241E/abstract) gives only an upper limit of 0.38700128 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): P 271.9445 d Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): a/R* derived from its semi-major axis 0.847 au and stellar radius 1.05 solar radii; Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): inclination 89.888 degrees Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): e 0.117 Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): omega -21 degrees, stored as 339 Eisner et al. 2024 (2024AJ....167..241E), via the NASA Exoplanet Archive ps table (pl_refname EISNER_ET_AL__2024): transit mid-time 2458864.8265 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 47 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4633's measured colour (#ffeee8, the colour lens of toi-4633 (src/objects/toi-4633/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4633's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4633c.json).


## Known problems

- **Orbit convention.** omega -21 degrees is taken as Eisner et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.117) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
