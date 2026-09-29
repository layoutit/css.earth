# TOI-4860 b

## Sources

It is the only planet known around TOI-4860. Its orbit and size follow Almenara et al. 2024's fit, the archive's default. This account was drafted from Almenara et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.77 Jupiter radii from Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...683A.166A/abstract): 55,048.8 km at 71,492 km per Jupiter radius. GM from the mass 0.273 Jupiter masses (Almenara et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...683A.166A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...683A.166A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): P 1.5227591 d Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): a/R* 11; Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): inclination 88.5 degrees Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): e 0.008 Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): omega 240 degrees Almenara et al. 2024 (2024A&A...683A.166A), via the NASA Exoplanet Archive ps table (pl_refname ALMENARA_ET_AL_2024): transit mid-time 2460036.69124 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-4860's measured colour (#ffc07d, the colour lens of toi-4860 (src/objects/toi-4860/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-4860's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (63, 90, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-4860b.json).


## Known problems

- **Orbit convention.** omega 240 degrees is taken as Almenara et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.008) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
