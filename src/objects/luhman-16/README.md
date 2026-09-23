# Luhman 16 A

## Sources

Luhman 16 A is a brown dwarf of 35.4 Jupiter masses (spectral type L7.5), 2 parsecs from the Sun, found by Luhman (2013, ApJ 767, L1) in WISE images. With [Luhman 16 B](../luhman-16b/README.md) it is the nearest known pair of brown dwarfs.

- **Placement:** Bedin et al. (2024, Astronomische Nachrichten 345, e20230158), Table 1: the barycentre of the pair at epoch 2000.0 (RA 162.32821578°, Dec −53.31941054°), proper motion −2768.511, 358.472 mas/yr, parallax 500.993 mas (1.996 pc). A is placed at the barycentre, although it really sits 0.4535 of the way to B from it (up to 1.6 au); B circles A. Gaia DR3 has only a two-parameter solution for one component, which Bedin et al. set aside.
- **Radial velocity:** 21.47 km/s, the barycentre's: Kniazev et al. (2013)'s 23.1 ± 1.1 (A) and 19.5 ± 1.2 km/s (B), weighted by Bedin et al.'s masses. Both include about 1 km/s of orbital motion.
- **Radius and temperature:** 1.01 ± 0.07 Jupiter radii and 1,334 ± 58 K, Filippazzo et al. (2015, ApJ 810, 158), from its luminosity through evolutionary models.
- **Surface:** the shared neutral gray. No map of A is deposited, and a blackbody colour would misrepresent a brown dwarf's heavily absorbed visible spectrum ([ledger](investigations.json)).
- **Rotation:** unmeasured here. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).

Catalogue colour: #ff6100, the star field's colour for 1,334 K, as for every star.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places B around A where Garcia et al. (2017) measured it, which also tests the barycentre placement at the scale of the orbit.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places Luhman 16 A and B in one system.

## Known problems

- **A is drawn at the barycentre.** It is off by up to 1.6 au, less than the pair's separation.
- **No surface.** The sphere is neutral gray.
- **The spin axis is a display convention.**

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
