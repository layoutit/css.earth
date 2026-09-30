# TOI-2158 b

## Sources

It is the only planet known around TOI-2158. Its orbit and size follow Knudstrup et al. 2022's fit, the archive's default. The introduction is generated from Knudstrup et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.96 Jupiter radii from Knudstrup et al. 2022 (2022A&A...667A..22K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...667A..22K/abstract): 68,632.3 km at 71,492 km per Jupiter radius. GM from the mass 0.82 Jupiter masses (Knudstrup et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022A&A...667A..22K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022A&A...667A..22K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 8.6007557 d Knudstrup et al. 2022 (2022A&A...667A..22K), via the NASA Exoplanet Archive ps table (pl_refname KNUDSTRUP_ET_AL_2022): a/R* 11.4; Knudstrup et al. 2022 (2022A&A...667A..22K), via the NASA Exoplanet Archive ps table (pl_refname KNUDSTRUP_ET_AL_2022): inclination 85.7 degrees Knudstrup et al. 2022 (2022A&A...667A..22K), via the NASA Exoplanet Archive ps table (pl_refname KNUDSTRUP_ET_AL_2022): e 0.07 Knudstrup et al. 2022 (2022A&A...667A..22K), via the NASA Exoplanet Archive ps table (pl_refname KNUDSTRUP_ET_AL_2022): omega 52 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459758.586312 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2158's measured colour (#ffeadb, the colour dataset of toi-2158 (src/objects/toi-2158/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2158's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (40, 53), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2158b.json).

## Known problems

- **Orbit convention.** omega 52 degrees is taken as Knudstrup et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.07) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
