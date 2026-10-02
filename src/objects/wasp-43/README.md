# WASP-43

WASP-43 is a K7 dwarf in Sextans, the host star of the hot Jupiter [WASP-43b](../wasp-43b/README.md). No image of the star exists: it is a sphere of the published size in the color of its measured temperature, darkened toward its edge as its planet's transits measure, with its axis along the planet's orbit. Because a body with imagery orbits it, preparation marks it `hostsImagery` ([prepare-catalog.mts](../../../site/build/prepare/prepare-catalog.mts)) and it stays on the map. The Milky Way overview lists it under Systems.

## Sources

**Placement.** The ICRS position, parallax and proper motion are Gaia EDR3 values as SIMBAD gives them; the radial velocity, −3.7 ± 0.7 km/s, is Gaia DR2's. The distance is 1000 / 11.474 mas = 87.15 pc, with no parallax zero-point correction.

**Radius and mass.** 0.665 solar radii and 0.6916 solar masses, the stellar values Challener et al. (2024, [ApJL 969, L32](https://arxiv.org/abs/2406.10207), Table 1) assume for their eclipse map of WASP-43b. They are model-dependent stellar parameters, not an interferometric size.

**Axis.** Esposito et al. (2017, [A&A 601, A53](https://arxiv.org/abs/1702.03136)) measured the Rossiter–McLaughlin effect of WASP-43b: the angle on the sky between the star's spin axis and the planet's orbit is 3.5 ± 6.8°, aligned. The rotation record ([rotation.json](source/preparation/rotation.json), read by [authored-rotation.ts](../../../packages/bake/src/objects/scene/authored-rotation.ts)) therefore takes the pole from WASP-43b's orbit normal, with longitude 0 facing the Sun. The rotation period is 15.6 ± 0.4 days (Hellier et al. 2011). The star does not spin in the scene, because without a prime meridian the rotation phase is unknown.

**Color dataset.** Gaia DR3 fits WASP-43's photometry with model atmospheres (GSP-Phot, [Andrae et al. 2023](https://doi.org/10.1051/0004-6361/202243462)) and gives 4,416 K. The archived row is `photometry/gaia-dr3-source.csv` (its [acquisition record](../../sources/gaia-dr3-gsp-phot-wasp-43.json)); the query is in [`stellar-color.json`](source/photometry/stellar-color.json). [stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts) integrates a Planck spectrum at that temperature against the CIE 1931 2° observer and converts it to sRGB: **255, 220, 184 (#ffdcb8)**. The search, catalogue and minimap swatch use the same color.

**Limb darkening.** Patel & Espinoza (2022, [AJ 163, 228](https://doi.org/10.3847/1538-3881/ac5f55)) fitted a quadratic law to TESS transits of WASP-43b (600–1000 nm): u₁ = 0.55 (+0.22/−0.31), u₂ = 0.00 (+0.46/−0.30). The edge is 45% as bright as the centre. The row is pinned from VizieR ([`photometry/patel-2022-limb-darkening.tsv`](source/photometry/patel-2022-limb-darkening.tsv), J/AJ/163/228, table 4). The same code turns the law into a black limb plate fitted to the sphere's outline. The navigation marker is the same dimmed disc, rendered by [author.mts](../../../packages/telescope-cli/authoring/wasp-43/author.mts).

**Activity.** Esposito et al. (2017) find enhanced chromospheric Ca II H and K emission, possibly driven by the planet. No map of starspots exists: the disc cannot be imaged, the star rotates too slowly for Doppler imaging, and a spot crossed during one transit is a single strip at a single moment.

## Evidence

- [`stellar-photometric-color.test.mts`](../../../packages/bake/src/objects/stellar/stellar-photometric-color.test.mts) checks the color 255, 220, 184, that the temperature percentiles move no channel by more than 1, and that the limb plate dims displayed luminance by the law within one 8-bit step.
- The default camera looks at a point one degree from the sub-Earth point, with the pole up. [`rendered-default-view.png`](source/reference/rendered-default-view.png) shows that view.

## Known problems

**No image of the surface.** At 87 pc the star's disc is 0.07 milliarcseconds across (computed from the radius and distance), far below the resolution of any telescope or interferometer.

**The limb darkening is measured in red light.** In visible light a K dwarf darkens somewhat more, and no visible-light measurement exists for this star. Within the uncertainty the edge could be 25 to 80% as bright as the centre.

**The color is a model of a measurement.** The temperature is fitted from photometry, not read from a spectrum; the spectroscopic 4,520 K of Challener et al. (2024) would give 255, 222, 189. A blackbody misses the absorption bands of a K7 dwarf.

**The axis is measured only on the sky.** Its tilt along the line of sight is assumed to equal the orbit's, and the orbit's orientation on the sky is a display convention (ascending node at position angle 0).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
