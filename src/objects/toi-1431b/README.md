# TOI-1431 b

## Sources

It is the only planet known around TOI-1431. Its orbit and size follow Addison et al. 2021's fit, the archive's default. The introduction is generated from Addison et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 1.49 Jupiter radii from Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract): 106,523.1 km at 71,492 km per Jupiter radius. GM from the mass 3.12 Jupiter masses (Addison et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162..292A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..292A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.650232 d Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): a/R* 5.15; Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): inclination 80.13 degrees Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): e 0.0022 Addison et al. 2021 (2021AJ....162..292A), via the NASA Exoplanet Archive ps table (pl_refname ADDISON_ET_AL__2021): omega 108 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460554.58625 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** An estimate, not a measurement: a black body at the 2,370 K equilibrium temperature of Addison et al. 2021, equilibrium temperature (NASA Exoplanet Archive planetary systems table): #ff9e3f. Chosen by rule: 1 paper in the archive prints one; the archive's default parameter set. On 120 hot Jupiters whose day side Spitzer measured, the measured temperature is within 20% of this kind of estimate for 83% (Deming et al. 2023); see [the expected glow](../../../docs/color-preparation.md#the-expected-glow-of-a-hot-giant). Reflected starlight is not included.

**Heat map.** The page opens on a brightness-temperature map across 0.6–0.95 µm from Addison et al. (2021, AJ 162, 292, [arXiv:2104.12078](https://arxiv.org/abs/2104.12078)): their fit to the TESS phase curve of Sectors 15 and 16, 15 August to 7 October 2019. The [record](source/science/addison-2021/phase-curve.json) holds the cells of the paper's joint-fit table: the occultation depth 0.127 +0.004/-0.005 ppt, the radius ratio 0.07955 +0.00063/-0.00053, and the planet's brightness term, a cosine of the orbital period with no shift, printed as its full amplitude, 0.0785 +0.0073/-0.0077 ppt, half of which is the semi-amplitude. The star's ellipsoidal and beaming terms of the same fit are not the planet's and are left out. Nothing is refitted. The series becomes a map of longitude through the Cowan & Agol (2008) inversion ([published fits](../../../docs/eclipse-mapping.md#a-published-fit-drawn-as-the-paper-made-it)), so it has no north-south information and every latitude is drawn alike. Temperatures use the star's brightness temperature that the paper's own day side, 3004 ± 64 K, implies with its depth and radius ratio (7,566 K). The false color runs from 2,500 to 3,050 K.

**Charts.** The orbits of TOI-1431's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (77, 83, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

- Run of 2026-10-08: [`new-object --phase-curve`](../../../packages/telescope-cli/src/new-object/planets/phase-curve-dataset.mts) wrote the dataset from the record. The paper's night side was not an input: the map gives 2,595 K at mid-transit against the printed 2583 ± 63 K.

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1431b.json).

## Known problems

- **The map is a fit, not an image.** One sinusoid in orbital phase fixes one number per longitude; nothing is known north to south.
- **Visible light is not only heat.** TESS sees 0.6 to 0.95 µm, where a planet also reflects its star. The paper turns the light into temperature assuming the planet reflects nothing, and prints day sides from 2,700 to 3,100 K for an albedo up to 0.2. The map draws the paper's zero-albedo temperatures.
- **The hottest longitude is not measured.** The paper's model has no shift, so the map is the same east and west of noon by construction.
- **Orbit convention.** omega 108 degrees is taken as Addison et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0022) about the line of sight.
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "TOI-1431 b" (revision 1366872522) verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
