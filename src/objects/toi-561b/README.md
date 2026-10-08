# TOI-561 b

## Sources

It is one of 4 planets known around TOI-561. Its orbit and size follow Piotto et al. 2024's fit, the archive's default. The introduction is generated from Piotto et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.12463221 Jupiter radii from Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract): 8,910.2 km at 71,492 km per Jupiter radius. GM from the mass 0.00635563 Jupiter masses (Piotto et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024MNRAS.535.2763P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024MNRAS.535.2763P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): P 0.4465697 d Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): a/R* 2.683; Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): inclination 87 degrees Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): e 0 Piotto et al. 2024 (2024MNRAS.535.2763P), via the NASA Exoplanet Archive ps table (pl_refname PIOTTO_ET_AL__2024): transit mid-time 2459317.75002 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 2,048 K dayside brightness temperature measured in secondary eclipse at 4 µm (Boucher et al. 2026, dayside temperature of the combined NIRSpec G395H phase-curve fit, 2048 +193 -206 K): #ff8d1d. Read from the paper (results, the combined NRS1 and NRS2 fit): the fit to both detectors together, 2.9 to 5.1 µm; the larger of its two errors is kept. Reflected starlight is not included.

**Heat maps.** The page opens on a brightness-temperature map across 3.8–5.1 µm and holds a second across 2.7–3.7 µm, from Boucher et al. (2026, accepted in AJ, [arXiv:2608.21519](https://arxiv.org/abs/2608.21519)): their fits to a JWST NIRSpec G395H phase curve of 1–3 May 2024 (program 3860), one for each detector's white light. The records ([NRS2](source/science/boucher-2026/phase-curve-nrs2.json), [NRS1](source/science/boucher-2026/phase-curve-nrs1.json)) hold the paper's cells. NRS2: the day-side flux 47.3 +11.7/-12.4 ppm, the radius ratio 0.01454 ± 0.00042, and one sinusoid counted from mid-eclipse, A 0.15 +0.12/-0.15 and B 0.15 +0.14/-0.11. NRS1: 34.8 +10.4/-11.6 ppm, 0.01474 +0.00038/-0.00039, A 0.439 +0.039/-0.078 and B -0.14 +0.12/-0.14. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that each detector's printed day side implies: 2095 +275/-291 K for NRS2 (5,317 K) and 1970 +273/-320 K for NRS1 (4,978 K). The false colors run from 1,600 to 2,250 K and from 450 to 2,100 K.

**Charts.** The orbits of TOI-561's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (45, 46, 72), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote both datasets from the records. The paper's night sides were not inputs: NRS2's map gives 1,767 K at mid-transit against the printed 1742 +302/-359 K, and NRS1's gives 1,059 K, under the paper's two-sigma limit of 1388 K. NRS2's maximum falls 45° after eclipse against the printed 32.7° (+32.1, -58.2); NRS1's falls 17.7° before eclipse against the printed 17.0° (+16.3, -15.5).

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-561b.json).

## Known problems

- **The maps are fits, not images.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **The two detectors disagree.** NRS2 puts the hottest longitude west of noon and keeps a warm night side; NRS1 puts it east and has a faint one. The paper says its climate models cannot explain NRS2's westward hot spot, which may come from unmodelled granulation of the star, and that it cannot rule out that leftover detector effects cause part or all of NRS1's faint night side. Both maps are shown, each as the paper fitted it.
- **The page opens on NRS2 for a reason of drawing, not of science.** It is the detector whose map has a temperature at every longitude and a printed night side to check against. NRS1's map is blank over 34 longitudes, 146° to 179° west, where the fitted sinusoid map is not positive.
- **NRS2's hottest longitude.** The map's maximum, 45° west, is what the printed A and B give; the paper prints 32.7° west as the middle of its own distribution.
- **The color dataset uses a third number.** The paper's fit to both detectors together prints a day side of 2048 K but no sinusoid, so it cannot be drawn as a map; the one-color dataset keeps it.
- **Band edges.** The paper does not state which wavelengths each white light curve sums; the records use the detector ranges it gives, 2.67–3.72 and 3.82–5.14 µm.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-561 b" (revision 1374392593) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
