# TOI-1685 b

## Sources

It is the only planet known around TOI-1685. Its orbit and size follow Egger et al. 2025's fit, the archive's default. The introduction is generated from Egger et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.12677335 Jupiter radii from Egger et al. 2025 (2025A&A...696A..28E), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract): 9,063.3 km at 71,492 km per Jupiter radius. GM from the mass 0.0096593 Jupiter masses (Egger et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...696A..28E), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...696A..28E/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Fisher et al. 2026 (2026MNRAS.545f2187F), via the NASA Exoplanet Archive ps table (pl_refname FISHER_ET_AL_2026): P 0.66913856 d Egger et al. 2025 (2025A&A...696A..28E), via the NASA Exoplanet Archive ps table (pl_refname EGGER_ET_AL__2025): a/R* 5.41; Luque et al. 2025 (2025AJ....170...49L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL__2025): inclination 86.62 degrees Luque et al. 2025 (2025AJ....170...49L), via the NASA Exoplanet Archive ps table (pl_refname LUQUE_ET_AL__2025): e 0 Fisher et al. 2026 (2026MNRAS.545f2187F), via the NASA Exoplanet Archive ps table (pl_refname FISHER_ET_AL_2026): transit mid-time 2459593.76594 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** A black body at the 1,360 K dayside brightness temperature measured in secondary eclipse at 4.5 µm (Luque et al. 2024, dayside brightness temperature from the NIRSpec G395H white light of detector NRS2, 1360 +/- 100 K): #ff6000. Read from the paper (section on the brightness temperatures; NRS1 gives 1520 +/- 140 K): of the two detectors, the one with the smaller relative uncertainty and the longer wavelength, 3.8 to 5.2 µm. Reflected starlight is not included.

**Heat map.** The page opens on a brightness-temperature map across 3.8–5.2 µm from Luque et al. (2025, AJ 170, 49, [arXiv:2412.03411](https://arxiv.org/abs/2412.03411)): their fit to a JWST NIRSpec G395H phase curve of 14–15 February 2024 (program 3263), the white light of detector NRS2. The [record](source/science/luque-2025/phase-curve.json) holds the cells of the paper's prayer-bead fit, the one it uses for its temperatures: the eclipse depth 119 +23/-18 ppm, the squared radius ratio 755.9 +30.1/-29.2 ppm, and one sinusoid counted from mid-eclipse, C1 0.49 +0.13/-0.10 and D1 -0.05 +0.11/-0.10. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 1360 ± 100 K, implies with its depth and radius ratio (3,422 K). The false color runs from 350 to 1,450 K.

**Charts.** The orbits of TOI-1685's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (19, 59, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 523 K at mid-transit against the printed 550 +300/-550 K, and its maximum falls 5.8° before eclipse against the 5.5 ± 3.2° east of the paper's other fit of the same model.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1685b.json).

## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **Part of the night side is blank.** With C1 near one half the planet's night-side light is near zero, and the sinusoid map is not positive over 71 of 360 longitudes; no temperature is drawn there.
- **Only one of two detectors is drawn.** The paper fits detector NRS1 (2.8–3.7 µm) too and says the parameters from NRS2 are the more reliable: a linear trend in NRS1 is degenerate with the phase curve, and NRS1 gives an effective albedo of -1.0.
- **The printed offset is from the paper's other fit.** Its prayer-bead table prints no offset; 5.5 ± 3.2° is the nested-sampling fit's, whose error leaves the correlated noise out.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1685 b" (revision 1374086968) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
