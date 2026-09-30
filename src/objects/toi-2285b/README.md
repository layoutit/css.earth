# TOI-2285 b

## Sources

It is the only planet known around TOI-2285. Its orbit and size follow Fukui et al. 2022's fit, the archive's default. This account was drafted from Fukui 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.1579091 Jupiter radii from Fukui 2025 (2025RNAAS...9...73F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025RNAAS...9...73F/abstract): 11,289.2 km at 71,492 km per Jupiter radius. No mass is measured: Fukui et al. 2022 (2022PASJ...74L...1F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022PASJ...74L...1F/abstract) gives only an upper limit of 0.06135386 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Fukui 2025 (2025RNAAS...9...73F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_2025): P 13.635109 d Fukui 2025 (2025RNAAS...9...73F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_2025): a/R* 43.1; Fukui et al. 2022 (2022PASJ...74L...1F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2022): inclination 89.66 degrees Fukui et al. 2022 (2022PASJ...74L...1F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2022): e 0.3 Fukui et al. 2022 (2022PASJ...74L...1F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_ET_AL__2022): omega 56 degrees Fukui 2025 (2025RNAAS...9...73F), via the NASA Exoplanet Archive ps table (pl_refname FUKUI_2025): transit mid-time 2458747.1831 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2285's measured colour (#ffc588, the colour dataset of toi-2285 (src/objects/toi-2285/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2285's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (77, 83, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2285b.json).


## Known problems

- **Orbit convention.** omega 56 degrees is taken as Fukui et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.3) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-2285 b" (revision 1373096621), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
