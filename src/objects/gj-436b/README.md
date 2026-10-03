# GJ 436 b

## Sources

It is the only planet known around Noquisi. Its orbit and size follow Maciejewski et al. 2014's fit, the archive's default. The introduction is generated from Maciejewski et al. 2014's published values; the sections below are the data's own.

**Size and mass.** Radius 0.372 Jupiter radii from Maciejewski et al. 2014 (2014AcA....64..323M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2014AcA....64..323M/abstract): 26,595 km at 71,492 km per Jupiter radius. GM from the mass 0.07 Jupiter masses (Maciejewski et al. 2014, the mass the NASA Exoplanet Archive's composite table adopts (2014AcA....64..323M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2014AcA....64..323M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.643897621 d Maciejewski et al. 2014 (2014AcA....64..323M), via the NASA Exoplanet Archive ps table (pl_refname MACIEJEWSKI_ET_AL__2014): a/R* 13.73; Maciejewski et al. 2014 (2014AcA....64..323M), via the NASA Exoplanet Archive ps table (pl_refname MACIEJEWSKI_ET_AL__2014): inclination 86.44 degrees Maciejewski et al. 2014 (2014AcA....64..323M), via the NASA Exoplanet Archive ps table (pl_refname MACIEJEWSKI_ET_AL__2014): e 0.13827 Maciejewski et al. 2014 (2014AcA....64..323M), via the NASA Exoplanet Archive ps table (pl_refname MACIEJEWSKI_ET_AL__2014): omega 351 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2455290.751684 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,120 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Stevenson et al. 2010, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff4400. Chosen from the archive's emission rows by rule: 6 measured of 6 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of Noquisi's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (22, 49), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/gj-436b.json).


## Known problems

- **Orbit convention.** omega 351 degrees is taken as Maciejewski et al. 2014 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.13827) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Gliese 436 b" (revision 1374939322) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
