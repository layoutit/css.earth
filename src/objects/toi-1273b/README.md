# TOI-1273 b

## Sources

It is the only planet known around TOI-1273. Its orbit and size follow Serrano Bell et al. 2024's fit, the archive's default. This account was drafted from Serrano Bell et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.99 Jupiter radii from Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...684A...6S/abstract): 70,777.1 km at 71,492 km per Jupiter radius. GM from the mass 0.222 Jupiter masses (Serrano Bell et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...684A...6S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...684A...6S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): P 4.631296 d Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): a/R* derived from its semi-major axis 0.0549 au and stellar radius 1.06 solar radii; Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): inclination derived from its impact parameter 0.958 with its a/R* 11.137 and the orbit's e 0.055, omega 110 degrees (Winn 2010, eq. 7) Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): e 0.055 Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): omega 110 degrees Serrano Bell et al. 2024 (2024A&A...684A...6S), via the NASA Exoplanet Archive ps table (pl_refname SERRANO_BELL_ET_AL_2024): transit mid-time 2458712.3468 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1273's measured colour (#fff1ec, the colour dataset of toi-1273 (src/objects/toi-1273/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1273's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (50, 75, 77), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1273b.json).


## Known problems

- **Orbit convention.** omega 110 degrees is taken as Serrano Bell et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.055) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
