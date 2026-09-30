# HD 18599 b

## Sources

It is the only planet known around HD 18599. Its orbit and size follow Desidera et al. 2023's fit, the archive's default. This account was drafted from Desidera et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.23195686 Jupiter radii from Desidera et al. 2023 (2023A&A...675A.158D), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023A&A...675A.158D/abstract): 16,583.1 km at 71,492 km per Jupiter radius. GM from the mass 0.07582708 Jupiter masses (Desidera et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...675A.158D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...675A.158D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.13744033335 d Desidera et al. 2023 (2023A&A...675A.158D), via the NASA Exoplanet Archive ps table (pl_refname DESIDERA_ET_AL_2023): a/R* 14.1; Desidera et al. 2023 (2023A&A...675A.158D), via the NASA Exoplanet Archive ps table (pl_refname DESIDERA_ET_AL_2023): inclination 87.6 degrees Desidera et al. 2023 (2023A&A...675A.158D), via the NASA Exoplanet Archive ps table (pl_refname DESIDERA_ET_AL_2023): e 0.34 Desidera et al. 2023 (2023A&A...675A.158D), via the NASA Exoplanet Archive ps table (pl_refname DESIDERA_ET_AL_2023): omega -2.5 degrees, stored as 357.5 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460985.999063 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-18599's measured colour (#ffe4d4, the colour dataset of hd-18599 (src/objects/hd-18599/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 18599's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (30, 96, 97), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-18599b.json).


## Known problems

- **Orbit convention.** omega -2.5 degrees is taken as Desidera et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.34) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
