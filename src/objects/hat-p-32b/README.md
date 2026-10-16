# HAT-P-32 b

## Sources

It is the only planet known around HAT-P-32. Its orbit and size follow Wang et al. 2019's fit, the archive's default. The introduction is generated from Wang et al. 2019's published values; the sections below are the data's own.

**Size and mass.** Radius 1.98 Jupiter radii from Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract): 141,554.2 km at 71,492 km per Jupiter radius. GM from the mass 0.68 Jupiter masses (Wang et al. 2019, the mass the NASA Exoplanet Archive's composite table adopts (2019AJ....157...82W), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2019AJ....157...82W/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.150008197 d Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): a/R* 5.344; Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): inclination 88.98 degrees Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): e 0.159 Wang et al. 2019 (2019AJ....157...82W), via the NASA Exoplanet Archive ps table (pl_refname WANG_ET_AL__2019): omega 50 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2456265.154123 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,063 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Zhao et al. 2014, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff8e1f. Chosen from the archive's emission rows by rule: 4 measured of 18 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of HAT-P-32's planets from above, from their hosted-orbit records, and its dayside emission, 14 bins from Nikolov et al. 2018 in the archive's emissionspec table; its transit in 1 TESS sector (58), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-32b.json).


## Known problems

- **Orbit convention.** omega 50 degrees is taken as Wang et al. 2019 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.159) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "HAT-P-32b" (revision 1370776745) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
