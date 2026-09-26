# HD 209458 b

HD 209458 b was the first planet seen crossing its star. It is a gas giant 1.36 times as wide as Jupiter. It opens on its thermal colour; a second lens maps its heat by longitude from a published Spitzer phase curve.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Measured, from Torres et al. 2008, ApJ 677, 1324 (2008), arXiv:0801.1841: radius 1.359 +0.016 −0.019 Jupiter radii (at 71492 km per Jupiter radius), period 3.524746 days, inclination 86.71 degrees, transit time (T0 = BJD_TDB 2459893.75120 ± 0.00005, MEASURED here from the JWST NIRCam F322W2 grism white-light curve of programme 1274 observation 2 (MAST product jw01274-o002_t002_nircam_f322w2-grismr-subgrism64_whtlt.ecsv), by a trapezoid fit with a linear baseline; the paper gives no transit time). Scaled distance a/R* = 8.76. The orbit is drawn circular. The position angle of the orbit on the sky is not measured; the ascending node at celestial north is a display convention.

**Thermal colour (default lens).** The colour of a black body at the 1,499 K the NASA Exoplanet Archive lists for the day side (Zellem et al. 2014, the maximum of their 4.5 µm phase curve), uniform over the disc and lit by the star ([thermal-color.json](source/photometry/thermal-color.json)).

**The map.** Zellem et al. (2014, [ApJ 790, 53](https://doi.org/10.1088/0004-637X/790/1/53); [arXiv:1405.5923](https://arxiv.org/abs/1405.5923)) observed a full orbit with Spitzer at 4.5 µm on 2010 January 17 to 21 (program 60021). They fitted the planet's light with one sinusoid, c1 cos(2πt/P) + c2 sin(2πt/P) (section 2.3; the second-order terms did not improve the fit). Their table is transcribed cell by cell in [phase-curve.json](source/science/zellem-2014/phase-curve.json). The paper does not say where t = 0 falls. Counted from mid-transit, their c1 = −0.0410% and c2 = 0.0354% put the curve's peak 40.8° before eclipse and its trough 40.8° before transit, as their Table 2 gives both (40.9 ± 6.0°); no other origin does. The Cowan & Agol (2008, [ApJ 678, L129](https://doi.org/10.1086/589232), equation 5) inversion turns that curve into its one map of longitude, through the [`published-phase-curve-map`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.mts) format. A phase curve carries no north–south information, so every latitude is drawn alike. The palette runs from 850 to 1,600 K in false colour. The map is drawn under the star's light like the colour lens; with shadows on, the night half is dark.

| Quantity | This map | Zellem et al. (2014) |
| --- | --- | --- |
| Day side, at mid-eclipse | 1,443 K (sets the star's band temperature) | 1,443 ± 30 K, second eclipse (Table 3) |
| Maximum of the curve | 1,497 K, 1,523 ppm | 1,499 ± 15 K; 1.001527 ± 0.000036 (Tables 2, 3) |
| Minimum of the curve | 972 K, 439 ppm | 972 ± 44 K; 1.000443 −0.000067/+0.000068 (Tables 2, 3) |
| Peak before eclipse | 40.8° | 40.9 ± 6.0°, 9.6 ± 1.4 hours (Table 2, section 4.2) |
| Night side, at mid-transit | 1,052 K | not given |
| Hottest point on the map | 1,557 K at 40.8° east | — |
| Coldest point on the map | 867 K at 139.2° west | — |

**Temperature.** The planet's intensity relative to the star's is 2J/rp², with J the Cowan & Agol map and rp = 0.12130. It becomes a brightness temperature at 4.5 µm against the star's 4.5 µm brightness temperature. The paper does not say which stellar spectrum it used. The value that its deeper eclipse (0.1391%, the baseline it names) and 1,443 K imply is 5,588 K. The curve's maximum and minimum then give the paper's 1,499 and 972 K within their uncertainties, as the table shows. The paper does not print the constant c0 of its fit. The planet's flux at mid-eclipse is taken to be the deeper eclipse depth, as the paper says it set the baseline.

**Independent reanalysis.** Dang et al. (2025, [AJ 169, 32](https://doi.org/10.3847/1538-3881/ad8dd7); [arXiv:2408.13308](https://arxiv.org/abs/2408.13308)) refit the same Spitzer data: offset 43 +5/−6° east, day side 1,420 ± 20 K and night side 1,010 +70/−80 K (Tables 2 and 3 of arXiv v1). It agrees with this map. It prints no fit coefficients, so it is not drawn ([ledger](investigations.json)).

**Rotation.** The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as Zellem et al. do: longitude 0 faces the star.

Measured and not shown: mass, 0.685 (+0.015/−0.014) Jupiter masses (Torres et al. 2008, Table 5), and a transmission spectrum. Not measured and not shown: albedo, surface, rotation.

## Evidence

Run of 2026-09-25 (this version):

- [`published-phase-curve-map.test.mts`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.test.mts) integrates the map over the visible hemisphere and gets the Fourier curve back to 1e-9. It holds the lens to the table above: the curve's maximum and minimum within Table 2's uncertainties, the peak and trough 40.81° before eclipse and transit, the Table 3 temperatures within theirs, and the hottest longitude at 40.8° east with every latitude alike.

[2026-09-22 exoplanet radius and route check](../../../site/test/evidence/exoplanets/2026-09-22/README.md): the 97,158 km source radius agrees with the scene and world frame; the prepared runtime contract passed. That run predates the map lens; the radius and frame have not changed since.

## Known problems

- **Longitude only.** A phase curve cannot see north and south, so the map is a band that varies only with longitude. Real hot Jupiters are cooler toward the poles.
- **Only the largest pattern is real.** The fit has one sinusoid. Nothing finer than a hemisphere is measured.
- **Brightness temperature, not temperature.** Each value is the temperature of a black body with the observed 4.5 µm brightness, against a star temperature the paper's own numbers imply.
- **Residual systematics.** The paper notes bumps in its light curve before the first eclipse and near phase 0.2, likely instrumental. The fit does not model them.
- **The colour lens is not the map.** The thermal colour is one temperature, 1,499 K, over the whole disc; the map shows how that heat is spread.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The transit time is our own measurement from one JWST visit. The planet is a sphere.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
