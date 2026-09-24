# χ¹ Orionis

## Sources

χ¹ Orionis is a young Sun-like star 8.7 parsecs away, bright enough to see without a telescope. Its magnetic field may flip every few years. It is also HD 39587, HR 2047, HIP 27913.

**The maps.** Willamo et al. (2022, A&A 659, A71, "Zeeman-Doppler imaging of five young solar-type stars", [arXiv:2110.06729](https://arxiv.org/abs/2110.06729)) observed it with HARPSpol on the ESO 3.6 m telescope in December 2017. They used Zeeman-Doppler imaging (ZDI), which maps a star's magnetic field from how its spectral lines are polarised as it turns, with the inversLSD code (Kochukhov et al. 2014). Their deposit, [VizieR J/A+A/659/A71](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/659/A71), holds each map as 1876 equal-area surface cells in 38 latitude belts with the radial, meridional and azimuthal field and the brightness. This package shows them unchanged:

- **Radial field**: red where the field points out of the star, blue where it points in.
- **Meridional field**: the field running north or south along the surface.
- **Azimuthal field**: the field running one way or the other around the spin axis.

Each map uses its paper figure's colour bar: the field linear from minus to plus the strongest value of any component in that map, through white at 0; the brightness from the map's darkest to its brightest point, in the figure's black-red-orange-white colours. A thin black line marks 65° S, below which the star never faces us, as the paper's horizontal line does. [latitude-belt-map.mts](../../../tools/objects/terrestrial-layers/latitude-belt-map.mts) reads the tables and interpolates around each belt and between belts, so every cell keeps its deposited value. The star turns too slowly for a brightness map: the deposited brightness is 1.0 everywhere, so none is shown.

**Directions.** The paper's Fig. 1 caption says the phases are inverted so that the map longitudes turn like the Earth's; its dashed lines sit at 360° × (1 − φ) for the observed phases φ of Table 1. So the maps' longitude is east longitude.

**Spin.** The maps were made with the axis tilted 65° from the line of sight and a 5.022 d period (Table 2). The tilt is used, with the visible pole north. The axis's direction on the sky is unmeasured and set toward celestial north, and longitude 0 faces the Sun as a display convention.

**Star.** Placement: Gaia DR3 source 3399063235755057792, parallax 114.950 ± 0.528 mas (8.70 pc); its RUWE is 5.6, so the single-star astrometry fits poorly, and the parallax is used as published. Radius 1.05 solar radii from Takeda et al. (2007), ApJS 168, 297, as listed by Willamo et al. (2022), Table 2 (https://arxiv.org/abs/2110.06729). Mass 1.000 (0.960 to 1.040) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 5,882 K from Valenti & Fischer (2005), ApJS 159, 141, as listed by Willamo et al. (2022), Table 2. log g 4.4 from the mass and radius.

**Colour.** HST/STIS Next Generation Spectral Library v2 (Heap & Lindler; MAST high-level science product), HD 39587: 168-1020 nm, cross-checked against Kharitonov, Tereshchenko & Knyazeva (1988), Spectrophotometric Catalogue of Stars (Alma-Ata), record 400: HR 2047; VizieR III/202 (2 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #fff8f9. Routes tried in order: gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 2047 is not in the catalogue; kiehling: HR 2047 is not among its 60 stars; stis-ngsl: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,882 K and log g 4.4 (u1 0.438, u2 0.273): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-24 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.

Run of 2026-09-23 (this version):

- [`latitude-belt-map.test.mts`](../../../tools/objects/terrestrial-layers/latitude-belt-map.test.mts) reads every deposited map and recomputes the largest and the mean total field over the equal-area cells. They match the paper's Table 3 to the gauss: chi1ori.dat: paper 41 G and 13 G, read 41.1 G and 13.1 G. So the files are the maps the paper measured.
- The reader's own tests check that a cell centre keeps its value, that the interpolation wraps at longitude 0, and that a table with a misplaced cell or belts out of order is refused.

## Known problems

- **Only the large-scale field.** The inversion stops at spherical-harmonic degree 10, so smaller structures are not in the maps.
- **The far south is unseen.** South of 65° S the star never faces us, so the maps there hold no information from the data (paper, Fig. 2 caption, which the later map figures repeat).
- **Not shown.** The alternative maps with differential rotation in the paper's appendix are not deposited ([ledger](investigations.json)).
- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
