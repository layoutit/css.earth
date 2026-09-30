# TOI-411 c

## Sources

It is one of 3 planets known around HD 22946. Its orbit and size follow Garai et al. 2023's fit, the archive's default. The introduction is generated from Garai et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.20769061 Jupiter radii from Garai et al. 2023 (2023A&A...674A..44G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..44G/abstract): 14,848.2 km at 71,492 km per Jupiter radius. No mass is measured: Garai et al. 2023 (2023A&A...674A..44G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...674A..44G/abstract) gives only an upper limit of 0.03058254 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Garai et al. 2023 (2023A&A...674A..44G), via the NASA Exoplanet Archive ps table (pl_refname GARAI_ET_AL__2023): P 9.573083 d Garai et al. 2023 (2023A&A...674A..44G), via the NASA Exoplanet Archive ps table (pl_refname GARAI_ET_AL__2023): a/R* 19.61; Cacciapuoti et al. 2022 (2022A&A...668A..85C), via the NASA Exoplanet Archive ps table (pl_refname CACCIAPUOTI_ET_AL_2022): inclination 88.57 degrees Cacciapuoti et al. 2022 (2022A&A...668A..85C), via the NASA Exoplanet Archive ps table (pl_refname CACCIAPUOTI_ET_AL_2022): e 0.16 Cacciapuoti et al. 2022 (2022A&A...668A..85C), via the NASA Exoplanet Archive ps table (pl_refname CACCIAPUOTI_ET_AL_2022): omega 10 degrees Garai et al. 2023 (2023A&A...674A..44G), via the NASA Exoplanet Archive ps table (pl_refname GARAI_ET_AL__2023): transit mid-time 2459161.60861 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-411's measured colour (#f9f4ff, the colour dataset of toi-411 (src/objects/toi-411/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-411's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (31, 97, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-411c.json).

## Known problems

- **Orbit convention.** omega 10 degrees is taken as Cacciapuoti et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.16) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
