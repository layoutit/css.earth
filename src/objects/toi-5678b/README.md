# TOI-5678 b

## Sources

It is the only planet known around TOI-5678. Its orbit and size follow Ulmer-Moll et al. 2023's fit, the archive's default. The introduction is generated from Ulmer-Moll et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.43804161 Jupiter radii from Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..43U/abstract): 31,316.5 km at 71,492 km per Jupiter radius. GM from the mass 0.06292704 Jupiter masses (Ulmer-Moll et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...674A..43U), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...674A..43U/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): P 47.73022 d Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): a/R* derived from its semi-major axis 0.249 au and stellar radius 0.938 solar radii; Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): inclination 89.83 degrees Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): e 0.14 Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): omega 208 degrees Ulmer-Moll et al. 2023 (2023A&A...674A..43U), via the NASA Exoplanet Archive ps table (pl_refname ULMER_MOLL_ET_AL_2023): transit mid-time 2458424.7059 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 12 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-5678's measured colour (#ffeee4, the colour dataset of toi-5678 (src/objects/toi-5678/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-5678's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (31, 97, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-5678b.json).

## Known problems

- **Orbit convention.** omega 208 degrees is taken as Ulmer-Moll et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.14) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
