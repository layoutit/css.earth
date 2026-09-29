# WASP-10 b

## Sources

It is the only planet known around WASP-10. Its orbit and size follow Johnson et al. 2009's fit, the archive's default. This account was drafted from Johnson et al. 2009's values; the sections below are the data's own.

**Size and mass.** Radius 1.08 Jupiter radii from Johnson et al. 2009 (2009ApJ...692L.100J), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2009ApJ...692L.100J/abstract): 77,211.4 km at 71,492 km per Jupiter radius. GM from the mass 3.15 Jupiter masses (Johnson et al. 2009, the mass the NASA Exoplanet Archive's composite table adopts (2009ApJ...692L.100J), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2009ApJ...692L.100J/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2022 (2022ApJS..258...40K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2022): P 3.09272826 d Johnson et al. 2009 (2009ApJ...692L.100J), via the NASA Exoplanet Archive ps table (pl_refname JOHNSON_ET_AL__2009): a/R* 11.65; Johnson et al. 2009 (2009ApJ...692L.100J), via the NASA Exoplanet Archive ps table (pl_refname JOHNSON_ET_AL__2009): inclination 88.49 degrees Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): e 0.0601 Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): omega 151.9 degrees Kokori et al. 2022 (2022ApJS..258...40K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2022): transit mid-time 2455638.24761 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** A black body at the 1,152 K dayside brightness temperature measured in secondary eclipse at 3.6 µm (Kammer et al. 2015, dayside brightness temperature at 3.6 µm (NASA Exoplanet Archive emission table)): #ff4900. Chosen from the archive's emission rows by rule: 2 measured of 3 rows; the smallest relative uncertainty, then the longest wavelength. Reflected starlight is not included.

**Charts.** The orbits of WASP-10's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (56, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-10b.json).


## Known problems

- **Orbit convention.** omega 151.9 degrees is taken as Bonomo et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0601) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "WASP-10b" (revision 1374241985), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
