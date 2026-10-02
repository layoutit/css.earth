# TOI-4201 b

## Sources

It is the only planet known around TOI-4201. Its orbit and size follow Gan et al. 2023's fit, the archive's default. The introduction is generated from Gan et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 1.22 Jupiter radii from Gan et al. 2023 (2023AJ....166..165G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..165G/abstract): 87,220.2 km at 71,492 km per Jupiter radius. GM from the mass 2.48 Jupiter masses (Gan et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..165G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..165G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): P 3.5819134 d Gan et al. 2023 (2023AJ....166..165G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL_2023): a/R* 13.694; Gan et al. 2023 (2023AJ....166..165G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL_2023): inclination 88 degrees Gan et al. 2023 (2023AJ....166..165G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL_2023): e 0.041 Gan et al. 2023 (2023AJ....166..165G), via the NASA Exoplanet Archive ps table (pl_refname GAN_ET_AL_2023): omega 130 degrees Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): transit mid-time 2459864.32835 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-4201's measured color (#ffbe87, the color dataset of toi-4201 (src/objects/toi-4201/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4201's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (87, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4201b.json).

## Known problems

- **Orbit convention.** omega 130 degrees is taken as Gan et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.041) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
