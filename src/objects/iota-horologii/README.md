# ι Horologii

## Sources

ι Horologii (HD 17051, HR 810) is an F8 to G0 dwarf 17.4 parsecs away in Horologium, about 625 million years old: a star like the young Sun, with a giant planet at about 1 au. Its magnetic activity cycles fast, and it has become a test of how young Suns' dynamos work.

**The magnetic maps.** Alvarado-Gómez et al. (2025, A&A 704, A68, "Far beyond the Sun III", [arXiv:2510.03146](https://arxiv.org/abs/2510.03146)) observed it with HARPSpol on the ESO 3.6 m telescope on 199 nights from October 2015 to September 2018. They used Zeeman-Doppler imaging (ZDI), which maps a star's magnetic field from how its spectral lines are polarised as it turns, to build 18 maps of the large-scale field, one per two-week visit. Their deposit, [Zenodo 10.5281/zenodo.17251923](https://zenodo.org/records/17251923) (CC BY 4.0), holds each map as a Tecplot table of longitude, latitude and the radial, azimuthal and meridional field on an 89 × 45 grid. This package shows the unconstrained maps of the paper's Figs. 1 to 3 in two stepped datasets:

- **Radial field**, 18 steps, October 2015 to September 2018: red where the field points out of the star, blue where it points in.
- **Azimuthal field**, 18 steps: the field running one way or the other around the spin axis.

Both use the paper's colour bar: linear from −12 G (blue) through white at 0 to +12 G (red). Stronger fields saturate, as in the paper (the strongest, 16.4 G, is azimuthal). A thin black line marks 60° S: at the adopted tilt the star never shows us what lies further south, and the paper marks the same limit with a dashed line. [tecplot-lonlat-map.mts](../../../tools/objects/terrestrial-layers/tecplot-lonlat-map.mts) reads the tables and interpolates bilinearly between grid nodes, so every node keeps its deposited value.

**Directions.** The paper marks each observed rotational phase φ on its map's longitude axis. For epoch 1 the ticks sit at 360° × (1 − φ) for the eleven phases of its Stokes V fits. So the central-meridian longitude falls as the star turns, and the maps' longitude is east longitude. All 18 maps share one rotational ephemeris (day 0 = BJD 2457300.78580, P = 7.73 d), so their longitudes line up from epoch to epoch.

**Spin.** The maps were made with the axis tilted 60° from the line of sight; the paper's own fit gives about 56°. The tilt is used, with the visible pole north. The axis's direction on the sky is unmeasured and set toward celestial north, and longitude 0 faces the Sun as a display convention.

**Star.** Placement: Gaia DR3 source 4745373133284418816, parallax 57.613 ± 0.038 mas (17.36 pc). Radius 1.16 solar radii, mass 1.23 solar masses and temperature 6,080 K: Bruntt et al. (2010), as tabulated by Alvarado-Gómez et al. (2018, Table 1). Colour: its Gaia DR3 BP/RP spectrum through the CIE 1931 2° observer, sRGB (252, 246, 255). Limb: Claret (2017)'s TESS-band quadratic law at 6,080 K and log g 4.40 (u1 0.334, u2 0.227), a model.

Catalogue colour: #fcf6ff, the colour lens's prepared colour.

## Evidence

Run of 2026-09-23 (this version):

- [`tecplot-lonlat-map.test.mts`](../../../tools/objects/terrestrial-layers/tecplot-lonlat-map.test.mts) averages B² over each deposited map by area. At all 18 epochs the paper's Table 3 value is 2π times that mean, 0.02 % to 2.9 % above it and never below. So the files are the maps the paper measured; the paper does not state its normalisation.
- The reader was compared with the paper's Fig. 1 epoch-1 radial panel, decoded through its colour bar: correlation 0.945 over 43,412 figure pixels, median difference 0.4 G. Mirrored in longitude the correlation is −0.50; mirrored in latitude, 0.59. The figure is not redistributed, so this was a one-off check.
- The longitude direction was read from the same figure's phase ticks against the epoch-1 Stokes V fits, as described above.
- [`iota-horologii-views.png`](evidence/iota-horologii-views.png): ι Horologii's Colour (its default), Radial field October 2015 and Azimuthal field December 2015, and Luhman 16 B's interpolated Brightness, on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready.
- [`lens-steps.test.mts`](../../../tools/objects/content/lens-steps.test.mts) checks that the stepped datasets form groups of consecutive steps with distinct labels.

## Known problems

- **Only the large-scale field.** The maps go up to spherical-harmonic degree 7, about 25° at the equator; anything smaller is below their resolution.
- **Weak fields.** Most of the surface holds a few gauss. The colour scale matches the paper so the epochs compare directly.
- **The far south is unseen.** South of 60° S the star never faces us, so the maps there are only the smooth continuation of the fit.
- **Not shown.** The symmetric and antisymmetric reconstructions, the meridional component and the planet ι Hor b ([ledger](investigations.json)).
- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
