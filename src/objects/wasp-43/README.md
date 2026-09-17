# WASP-43

## Sources

WASP-43 is a K7 dwarf in Sextans, the host star of the hot Jupiter [WASP-43b](../wasp-43b/README.md). Its package holds the placement, the published size and the record of what was checked for its surface. No image of the star exists: it is a sphere of the published size in the colour of its measured temperature. Unlike Antares and Polaris it stays on the map, because a body with imagery orbits it: preparation marks its discovery `hostsImagery` ([prepare-catalog.mts](../../../tools/prepare-catalog.mts)) and `discoveryVisibility` keeps a planetary system's star visible. The Milky Way overview lists it under Systems.

**Placement.** The ICRS position, parallax and proper motion are Gaia EDR3 values as SIMBAD gives them; the radial velocity, −3.7 ± 0.7 km/s, is Gaia DR2's. The distance is 1000 / 11.474 mas = 87.15 pc, with no parallax zero-point correction.

**Radius and mass.** 0.665 solar radii and 0.6916 solar masses, the stellar values Challener et al. (2024, [ApJL 969, L32](https://arxiv.org/abs/2406.10207), Table 1) assume for their eclipse map of WASP-43b. They are model-dependent stellar parameters, not an interferometric size. The planet's size and orbit in the WASP-43b package are in units of this radius.

**Rotation: none measured.** No publication measures the star's rotation axis. Challener et al. (2024) mention only some evidence of rotational modulation longer than 15 days in its light curve (from Hellier et al. 2011). The rotation record is the `cssearth-display-orientation@1` convention used for the other stars without an axis: celestial north at the star, in the plane of the sky. The star record sets `presentationUp: display-axis`.

**Color lens.** Gaia DR3 fits WASP-43's photometry with model atmospheres (GSP-Phot, [Andrae et al. 2023](https://doi.org/10.1051/0004-6361/202243462)) and gives 4,416 K, with 16th–84th percentiles of 4,407–4,424 K that leave out systematic error. The archived row is [`photometry/gaia-dr3-source.csv`](source/photometry/gaia-dr3-source.csv); the query is in [`stellar-color.json`](source/photometry/stellar-color.json). The `stellar-photometric-color` science kind ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)) integrates a Planck spectrum at that temperature against the CIE 1931 2° observer and converts it to sRGB with its D65 white, scaled so the brightest channel is full: **255, 220, 184 (#ffdcb8)**. The colour is uniform and self-luminous, drawn by the emissive route with transparent plates. It shows no brightness, limb darkening or surface detail. Gaia published no measured spectrum for this star, so a blackbody stands in for it.

## Evidence

Run of 2026-09-16 (this version): `node tools/prepare-object.mts wasp-43` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the archived Gaia row, checks the colour 255, 220, 184 and that the temperature percentiles move no channel by more than 1, and that a Planck colour runs blue-white to orange as it cools.
- [`source.test.mts`](../../../tests/objects/unit/wasp-43/source.test.mts) verifies the pins, that no observation is acquired, that radius and GM are the table's stellar values, that the distance is the Gaia parallax and that the angular diameter is marked as computed.
- [`object-discovery.test.mts`](../../../site/test/object-discovery.test.mts) checks that WASP-43 and WASP-43b stay on the map under every discovery setting while Antares and Polaris stay hidden.
- [`default-view.test.mts`](../../../tests/objects/unit/wasp-43/default-view.test.mts) derives the default camera from the runtime's camera math: the sub-camera point one degree from the sub-Earth point, with the display axis and celestial north up.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/wasp-43/` with the default camera, no console errors.

## Known problems

**No image of the surface.** At 87 pc the star's disc is 0.07 milliarcseconds across (computed from the radius and distance), far below the resolution of any telescope or interferometer.

**The colour is a model of a measurement.** The temperature is fitted from photometry, not read from a spectrum; the spectroscopic 4,520 K of Challener et al. (2024) would give 255, 222, 189. A blackbody misses the absorption bands of a K7 dwarf.

**The axis is a convention.** Where the star's pole points is unknown. The planet's orbit in the WASP-43b package has its own display convention for the direction of its ascending node.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
