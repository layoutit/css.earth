# Kepler-13 b

## Sources

It is the only planet known around Kepler-13. Its orbit and size follow Esteves et al. 2015's fit, the archive's default. The introduction is generated from Esteves et al. 2015's published values; the sections below are the data's own.

**Size and mass.** Radius 1.512 Jupiter radii from Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract): 108,095.9 km at 71,492 km per Jupiter radius. GM from the mass 9.28 Jupiter masses (Esteves et al. 2015, the mass the NASA Exoplanet Archive's composite table adopts (2015ApJ...804..150E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2015ApJ...804..150E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Gajdoš et al. 2019 (2019RAA....19...41G), via the NASA Exoplanet Archive ps table (pl_refname GAJDO_SCARON__ET_AL__2019): P 1.7635874737 d Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): a/R* 4.5007; Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): inclination 86.77 degrees Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): e 0.00064 Esteves et al. 2015 (2015ApJ...804..150E), via the NASA Exoplanet Archive ps table (pl_refname ESTEVES_ET_AL__2015): omega 5 degrees Gajdoš et al. 2019 (2019RAA....19...41G), via the NASA Exoplanet Archive ps table (pl_refname GAJDO_SCARON__ET_AL__2019): transit mid-time 2454953.56598 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,750 K dayside brightness temperature measured in secondary eclipse in the Kepler, Ks, 3.6 µm and 4.5 µm bands together (Shporer et al. 2014, the temperature of a black body showing the same occultation depths in all four bands): #ffae5c. Read from the paper (abstract): the paper's own value; Esteves et al. 2015's Kepler-band 3,490 K assumes no reflected light and is not used. Reflected starlight is not included.

**Charts.** The orbits of Kepler-13's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (75, 80, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-10-16 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-13b.json).


## Known problems

- **Orbit convention.** omega 5 degrees is taken as Esteves et al. 2015 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.00064) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "Kepler-13" (revision 1368288051) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
