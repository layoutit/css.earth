# Wolf 503 b

## Sources

It is the only planet known around Wolf 503. Its orbit and size follow Polanski et al. 2021's fit, the archive's default. The introduction is generated from Polanski et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.18226457 Jupiter radii from Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..238P/abstract): 13,030.5 km at 71,492 km per Jupiter radius. GM from the mass 0.01969616 Jupiter masses (Polanski et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162..238P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..238P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2021): P 6.00127 d Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2021): a/R* derived from its semi-major axis 0.05706 au and stellar radius 0.689 solar radii; Bonomo et al. 2023 (2023A&A...677A..33B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL_2023): inclination 89.87 degrees Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2021): e 0.41 Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2021): omega 112 degrees Polanski et al. 2021 (2021AJ....162..238P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2021): transit mid-time 2458191.361449 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 14 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wolf-503's measured color (#ffd3bc, the color dataset of wolf-503 (src/objects/wolf-503/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Wolf 503's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wolf-503b.json).

## Known problems

- **Orbit convention.** omega 112 degrees is taken as Polanski et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.41) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
