# TOI-1278 b

## Sources

It is the only planet known around TOI-1278. Its orbit and size follow Artigau et al. 2021's fit, the archive's default. The introduction is generated from Artigau et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 1.09 Jupiter radii from Artigau et al. 2021 (2021AJ....162..144A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..144A/abstract): 77,926.3 km at 71,492 km per Jupiter radius. GM from the mass 18.5 Jupiter masses (Artigau et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162..144A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..144A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 14.47510623109 d Artigau et al. 2021 (2021AJ....162..144A), via the NASA Exoplanet Archive ps table (pl_refname ARTIGAU_ET_AL__2021): a/R* derived from its semi-major axis 0.095 au and stellar radius 0.573 solar radii; Artigau et al. 2021 (2021AJ....162..144A), via the NASA Exoplanet Archive ps table (pl_refname ARTIGAU_ET_AL__2021): inclination 88.3 degrees Artigau et al. 2021 (2021AJ....162..144A), via the NASA Exoplanet Archive ps table (pl_refname ARTIGAU_ET_AL__2021): e 0.013 Artigau et al. 2021 (2021AJ....162..144A), via the NASA Exoplanet Archive ps table (pl_refname ARTIGAU_ET_AL__2021): omega 246 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459826.540249 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-1278's measured color (#ffbe8a, the color dataset of toi-1278 (src/objects/toi-1278/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1278's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (75, 82, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1278b.json).

## Known problems

- **Orbit convention.** omega 246 degrees is taken as Artigau et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.013) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
