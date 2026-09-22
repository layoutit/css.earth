# WASP-43

## Sources

WASP-43 is a K7 dwarf in Sextans, the host star of the hot Jupiter [WASP-43b](../wasp-43b/README.md). Its package holds the placement, the published size and the record of what was checked for its surface. No image of the star exists: it is a sphere of the published size in the colour of its measured temperature, darkened toward its edge as its planet's transits measure, with its axis along the planet's orbit, as measured. Unlike Antares and Polaris it stays on the map, because a body with imagery orbits it: preparation marks its discovery `hostsImagery` ([prepare-catalog.mts](../../../tools/prepare-catalog.mts)) and `discoveryVisibility` keeps a planetary system's star visible. The Milky Way overview lists it under Systems.

**Placement.** The ICRS position, parallax and proper motion are Gaia EDR3 values as SIMBAD gives them; the radial velocity, −3.7 ± 0.7 km/s, is Gaia DR2's. The distance is 1000 / 11.474 mas = 87.15 pc, with no parallax zero-point correction.

**Radius and mass.** 0.665 solar radii and 0.6916 solar masses, the stellar values Challener et al. (2024, [ApJL 969, L32](https://arxiv.org/abs/2406.10207), Table 1) assume for their eclipse map of WASP-43b. They are model-dependent stellar parameters, not an interferometric size. The planet's size and orbit in the WASP-43b package are in units of this radius.

**Axis: aligned with the planet's orbit.** Esposito et al. (2017, [A&A 601, A53](https://arxiv.org/abs/1702.03136)) measured the Rossiter–McLaughlin effect of WASP-43b: as the planet crosses the rotating star it blocks first the side turning toward us, then the side turning away, which distorts the star's spectral lines. The distortion gives the angle on the sky between the star's spin axis and the planet's orbit: 3.5 ± 6.8°, aligned. The rotation record, `cssearth-orbit-aligned-pole@1` ([rotation.json](source/preparation/rotation.json), read by [authored-rotation.mts](../../../tools/objects/authored-rotation.mts)), therefore takes the pole from WASP-43b's orbit normal, with longitude 0 facing the Sun. The effect measures the axis on the sky only; its tilt toward or away from us is taken to equal the orbit's. The rotation period is measured: 15.6 ± 0.4 days (Hellier et al. 2011). Esposito et al. combine it with the star's radius and v sin i to get sin I★ = 1.08 ± 0.25, so the star's axis is inclined more than 72° to the line of sight (68% confidence), consistent with the orbit's 82°. The star still does not spin in the scene: without a prime meridian the rotation phase is unknown. The star record keeps `presentationUp: display-axis`, which now puts that pole up.

**Color lens.** Gaia DR3 fits WASP-43's photometry with model atmospheres (GSP-Phot, [Andrae et al. 2023](https://doi.org/10.1051/0004-6361/202243462)) and gives 4,416 K, with 16th–84th percentiles of 4,407–4,424 K that leave out systematic error. The archived row is `photometry/gaia-dr3-source.csv` (its [acquisition record](../../sources/gaia-dr3-gsp-phot-wasp-43.json)); the query is in [`stellar-color.json`](source/photometry/stellar-color.json). The `stellar-photometric-color` science kind ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)) integrates a Planck spectrum at that temperature against the CIE 1931 2° observer and converts it to sRGB with its D65 white, scaled so the brightest channel is full: **255, 220, 184 (#ffdcb8)**. The colour is self-luminous, drawn by the emissive route. Gaia published no measured spectrum for this star, so a blackbody stands in for it.

**Limb darkening.** A transit is the planet scanning the star's disc: the depth at each point along its path is the star's brightness there. Patel & Espinoza (2022, [AJ 163, 228](https://doi.org/10.3847/1538-3881/ac5f55)) fitted a quadratic limb-darkening law, I(μ)/I(1) = 1 − u₁(1 − μ) − u₂(1 − μ)², to TESS transits of WASP-43b (600–1000 nm): u₁ = 0.55 (+0.22/−0.31), u₂ = 0.00 (+0.46/−0.30). The edge is 45% as bright as the centre, anywhere from about 25 to 80% within the uncertainty. The row is pinned from VizieR ([`photometry/patel-2022-limb-darkening.tsv`](source/photometry/patel-2022-limb-darkening.tsv), J/AJ/163/228, table 4). [stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts) turns the law into the limb plate, a black overlay the runtime fits edge to edge to the sphere's outline. Its alpha dims the colour's displayed luminance by the law's intensity ratio at each radius, and a fixed ordered dither keeps the 8-bit alpha from banding when the disc fills the screen.

**Navigation marker.** The distant marker is the same disc: the photosphere colour dimmed toward the limb by the same law, rendered by [author.mts](../../../tools/objects/source-authoring/wasp-43/author.mts) (`--check` recomputes it).

**Activity.** Esposito et al. (2017) find enhanced chromospheric Ca II H and K emission, possibly driven by the planet. An active K dwarf has starspots, but no map of them exists: the disc cannot be imaged, the star rotates too slowly for Doppler imaging, and a spot crossed during one transit is a single strip at a single moment.

**Catalogue colour.** the swatch that search, the catalogue and the minimap show is this lens's prepared colour, #ffdcb8.

## Evidence

Run of 2026-09-16 (this version): `node tools/prepare-object.mts wasp-43` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the archived Gaia row, checks the colour 255, 220, 184 and that the temperature percentiles move no channel by more than 1, and that a Planck colour runs blue-white to orange as it cools.
- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) also reads the pinned limb-darkening row and checks that the plate is transparent outside the disc, black, undimmed at the centre, and dims the displayed luminance by the law within one 8-bit step at several radii.
- [`source.test.mts`](../../../tests/objects/unit/wasp-43/source.test.mts) verifies the pins, that the acquisitions are the title font, the Gaia query and the limb-darkening row, that radius and GM are the table's stellar values, that the distance is the Gaia parallax and that the angular diameter is marked as computed.
- [`object-discovery.test.mts`](../../../site/test/object-discovery.test.mts) checks that WASP-43 and WASP-43b stay on the map under every discovery setting while Antares and Polaris stay hidden.
- [`default-view.test.mts`](../../../tests/objects/unit/wasp-43/default-view.test.mts) derives the default camera from the runtime's camera math: the sub-camera point one degree from the sub-Earth point, and the pole, identical to WASP-43b's orbit normal, up.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/wasp-43/` with the default camera, no console errors.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffdcb8 is the colour lens's prepared colour.

## Known problems

**No image of the surface.** At 87 pc the star's disc is 0.07 milliarcseconds across (computed from the radius and distance), far below the resolution of any telescope or interferometer.

**The limb darkening is measured in red light.** TESS observes 600–1000 nm; in visible light a K dwarf darkens somewhat more, and no visible-light measurement exists for this star. The coefficients are uncertain enough that the edge could be 25 to 80% as bright as the centre.

**The colour is a model of a measurement.** The temperature is fitted from photometry, not read from a spectrum; the spectroscopic 4,520 K of Challener et al. (2024) would give 255, 222, 189. A blackbody misses the absorption bands of a K7 dwarf.

**The axis is measured only on the sky.** The Rossiter–McLaughlin effect gives the axis's angle on the sky; its tilt along the line of sight is assumed to equal the orbit's. The orbit's own orientation on the sky is a display convention (ascending node at position angle 0), so the axis shares it.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
