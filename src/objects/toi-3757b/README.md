# TOI-3757 b

## Sources

It is the only planet known around TOI-3757. Its orbit and size follow Kanodia et al. 2022's fit, the archive's default. This account was drafted from Kanodia et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 1.07057014 Jupiter radii from Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...81K/abstract): 76,537.2 km at 71,492 km per Jupiter radius. GM from the mass 0.26838381 Jupiter masses (Kanodia et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....164...81K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....164...81K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): P 3.438753 d Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): a/R* 13.26; Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): inclination 86.76 degrees Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): e 0.14 Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): omega 130 degrees Kanodia et al. 2022 (2022AJ....164...81K), via the NASA Exoplanet Archive ps table (pl_refname KANODIA_ET_AL__2022): transit mid-time 2458838.77148 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3757's measured colour (#ffbd8b, the colour lens of toi-3757 (src/objects/toi-3757/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3757's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (59, 60, 73), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3757b.json).


## Known problems

- **Orbit convention.** omega 130 degrees is taken as Kanodia et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.14) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-3757 b" (revision 1374086850), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
