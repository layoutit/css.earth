# LP 714-47 b

## Sources

It is the only planet known around LP 714-47. Its orbit and size follow Serrano Bell et al. 2026's fit, the archive's default. The introduction is generated from Serrano Bell et al. 2026's published values; the sections below are the data's own.

**Size and mass.** Radius 0.37916026 Jupiter radii from Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260713333S/abstract): 27,106.9 km at 71,492 km per Jupiter radius. GM from the mass 0.08929347 Jupiter masses (Serrano Bell et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026arXiv260713333S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026arXiv260713333S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Patel & Espinoza 2022 (2022AJ....163..228P), via the NASA Exoplanet Archive ps table (pl_refname PATEL__AMP__ESPINOZA_2022): P 4.052034 d Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): a/R* derived from its semi-major axis 0.04056 au and stellar radius 0.536 solar radii; Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): inclination 87.5 degrees Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): e 0.022 Serrano Bell et al. 2026 (2026arXiv260713333S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2026): omega -110 degrees, stored as 250 Patel & Espinoza 2022 (2022AJ....163..228P), via the NASA Exoplanet Archive ps table (pl_refname PATEL__AMP__ESPINOZA_2022): transit mid-time 2459196.1149 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by lp-714-47's measured color (#ffbf8a, the color dataset of lp-714-47 (src/objects/lp-714-47/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of LP 714-47's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (5, 32), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/lp-714-47b.json).

## Known problems

- **Orbit convention.** omega -110 degrees is taken as Serrano Bell et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.022) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
