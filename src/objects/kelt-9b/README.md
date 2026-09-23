# KELT-9b

## Sources

KELT-9b is the hottest known giant planet. It orbits the fast-spinning A star [KELT-9](../kelt-9/README.md) every 35.5 hours on a nearly polar orbit. Its one lens is a brightness-temperature map drawn from a published phase-curve fit. No map of KELT-9b has been published ([ledger](investigations.json)).

**The map.** Mansfield et al. (2020, [ApJL 888, L15](https://doi.org/10.3847/2041-8213/ab5b09); [arXiv:1910.01567](https://arxiv.org/abs/1910.01567)) observed a full orbit with Spitzer at 4.5 µm in October 2018 (program 14059). They fitted the planet's light with two sinusoids, one per orbit and one per half orbit (their equation 1). Their table is transcribed cell by cell in [phase-curve.json](source/science/mansfield-2020/phase-curve.json). Cowan & Agol (2008, [ApJ 678, L129](https://doi.org/10.1086/589232), equation 5) show that such a curve comes from exactly one map of longitude: each map sinusoid makes a light-curve sinusoid of the same order and phase, 2, π/2 and 2/3 times as large for orders 0, 1 and 2. The [`published-phase-curve-map`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.mts) format inverts the fit that way. A phase curve carries no north–south information, so every latitude is drawn alike. The palette runs from 2,400 to 5,100 K in false colour.

| Quantity | This map | Mansfield et al. (2020), Table 1 |
| --- | --- | --- |
| Day side | 4,566 K (sets the star's band temperature) | 4,566 +140/−136 K |
| Night side | 2,542 K | 2,556 +101/−97 K |
| Hottest hemisphere | 4,623 K | 4,636 +145/−138 K |
| Amplitude, (F_max − F_min)/F_max | 0.612 | 0.609 ± 0.020 |
| Peak before eclipse | 16.5° | 18.7 +2.1/−2.3° |
| Hottest point on the map | 5,087 K at 16.5° east | — |
| Coldest point on the map | 2,410 K at 162.6° west | — |

**Temperature.** The planet's intensity relative to the star's is 2J/rp², with J the Cowan & Agol map and rp = 0.08004. It becomes a brightness temperature at 4.5 µm against the star's 4.5 µm brightness temperature. The paper says its temperatures come from PHOENIX models but prints no number for them. The value its own eclipse depth, radius ratio and day side imply is 7,942 K. The paper's night side and hottest hemisphere then follow from the curve within their uncertainties, as the table shows. The one stellar temperature the paper does print, 8,287 K for its energy-balance model, would put the day side at 4,739 K ([ledger](investigations.json)). The constant of the sinusoid fit is not printed. The planet's flux at mid-eclipse is taken to be the eclipse depth, and the amplitude check confirms it.

**Orbit and rotation.** Gaudi et al. (2017, [Nature 546, 514](https://doi.org/10.1038/nature22392), Extended Data Table 3, adopted Model 1) give the period, 0.03462 au, 86.79° inclination and the transit time. Their mass is 2.88 Jupiter masses. The radius is Ahlers et al. (2020)'s 1.84 Jupiter radii. The orbit sits on the volume-equivalent radius of the flattened star, so a/R* is 3.2046 here rather than the paper's 3.153 for its 2.362 solar-radius sphere. The rotation record, `cssearth-synchronous-rotation@1`, assumes the planet is tidally locked, as the papers do. The planet is drawn emissive: the map is its own heat, not lit by its star.

**Catalogue colour.** #f6aa3a, the lens palette at the paper's 4,566 K day side, the rule WASP-43b's colour follows.

## Evidence

Run of 2026-09-23 (this version):

- [`published-phase-curve-map.test.mts`](../../../tools/objects/terrestrial-layers/published-phase-curve-map.test.mts) integrates the map over the visible hemisphere at eight phases and gets the paper's light curve back to 1e-9. It holds the lens to the table above: amplitude, night side and hottest hemisphere within the paper's uncertainties, the day side exactly, and the peak within the lower bound of the paper's offset. It checks that every latitude is alike and the hottest longitude lies between 10° and 30° east.
- [`exoplanet-radius.test.mts`](../../../tests/objects/unit/exoplanet-radius.test.mts) checks the radius in the astronomy record, the recipe and the world frame.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) places KELT-9b in the KELT-9 system.
- [`hot-jupiter-default-views.png`](evidence/hot-jupiter-default-views.png): the default views of KELT-9, KELT-9b, WASP-76 and WASP-76b on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready. Both planets open on their substellar point; KELT-9b's hot spot shows east of centre.

## Known problems

- **Longitude only.** A phase curve cannot see north and south, so the map is a band that varies only with longitude. Real hot Jupiters are cooler toward the poles.
- **Only the largest pattern is real.** The fit has two sinusoids. Nothing finer than half a planet is measured.
- **The offset is one standard deviation low.** The sinusoids peak 16.5° before eclipse; the paper quotes 18.7 +2.1/−2.3°. The paper does not say how it computed its offset from the fit. Its table's t1 alone places the first sinusoid 16.5° before eclipse.
- **Brightness temperature, not temperature.** Each value is the temperature of a blackbody with the observed 4.5 µm brightness. It is taken at one wavelength against a star temperature the paper's own numbers imply.
- **Assumptions of the frame.** Tidal locking and a pole on the orbit normal are assumed. The orbit's position angle on the sky is not measured by transits; it is set at 0 as a display convention. The planet is a sphere.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
