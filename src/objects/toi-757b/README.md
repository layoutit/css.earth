# TOI-757 b

## Sources

It is the only planet known around TOI-757. Its orbit and size follow Alqasim et al. 2024's fit, the archive's default. This account was drafted from Alqasim et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.22303545 Jupiter radii from Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.533....1A/abstract): 15,945.3 km at 71,492 km per Jupiter radius. GM from the mass 0.03303669 Jupiter masses (Alqasim et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024MNRAS.533....1A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024MNRAS.533....1A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): P 17.46819 d Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): a/R* derived from its semi-major axis 0.122 au and stellar radius 0.78 solar radii; Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): inclination 89.5 degrees Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): e 0.39 Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): omega -36 degrees, stored as 324 Alqasim et al. 2024 (2024MNRAS.533....1A), via the NASA Exoplanet Archive ps table (pl_refname ALQASIM_ET_AL_2024): transit mid-time 2459305.5322 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-757's measured colour (#ffebe1, the colour dataset of toi-757 (src/objects/toi-757/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-757's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (37, 64, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-757b.json).


## Known problems

- **Orbit convention.** omega -36 degrees is taken as Alqasim et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.39) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
