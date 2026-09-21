# HD 189733 A

## Sources

HD 189733 A is a K2 dwarf in Vulpecula, 19.8 parsecs away. It hosts the hot Jupiter [HD 189733b](../hd-189733b/README.md), and the red dwarf [HD 189733 B](../hd-189733-companion/README.md) moves with it through space. No image of the star's surface exists. The package draws it as a sphere of the size its planet's map assumes, in the colour of its measured spectrum, darkened toward its edge as the planet's transits show, and turning on the spin axis measured against the planet's orbit.

**Placement.** Position, parallax, proper motion and radial velocity are the Gaia DR3 values for source 1827242816201846144, archived as one row in `photometry/gaia-dr3-source.csv` (its [acquisition record](../../sources/gaia-dr3-hd-189733.json), epoch J2016.0). The distance is 1000 / 50.567 mas = 19.776 pc, with no parallax zero-point correction.

**Radius and mass.** 0.752 solar radii and 0.807 solar masses, the stellar values Lally et al. (2025, [arXiv:2503.20895](https://arxiv.org/abs/2503.20895), Table 1) fix for their eclipse map of HD 189733b. The planet's orbit and size are fitted in units of this radius, so the sphere keeps it. CHARA interferometry measured a limb-darkened diameter of 0.3848 ± 0.0055 mas in the H band (Boyajian et al. 2015, MNRAS 447, 846; the JMDC catalogue lists it with ± 0.0046), which gives 0.818 solar radii at the Gaia distance, 9% larger; see the [investigation ledger](investigations.json).

**Colour lens.** Gaia DR3 published a low-resolution BP/RP spectrum of this star, calibrated to absolute flux and sampled every 2 nm from 336 to 1020 nm (Montegriffo et al. 2023). The sampled spectrum is pinned unchanged as `photometry/gaia-dr3-xp-sampled.csv` (same [acquisition record](../../sources/gaia-dr3-hd-189733.json)). [stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts) weights its samples from 380 to 780 nm by the CIE 1931 2° observer and converts the result to sRGB with its D65 white, scaled so the brightest channel is full: **255, 226, 207 (#ffe2cf)**. Moving every sample one standard error down or up changes the blue channel by at most 2. The method record is [`stellar-color.json`](source/photometry/stellar-color.json). This is the star's own measured light, not a blackbody.

**Limb darkening.** A transit is the planet scanning the star's disc: the depth at each point along its path is the star's brightness there. No published limb-darkening fit to TESS transits covers this star, so the package fits one. [transit-limb-darkening.mts](../../../tools/objects/eclipse-map/transit-limb-darkening.mts) reads three TESS SPOC 2-minute light curves (sectors 41, 54 and 81; 2021, 2022 and 2024; pinned in the manifest and restored from MAST). It keeps good-quality PDCSAP samples, divides each of the 30 complete transits by a straight line fitted outside it, and folds them onto HD 189733b's orbit. [transit-timing.mts](../../../tools/objects/eclipse-map/transit-timing.mts) delegates the exposure-integrated quadratic transit to batman and the bounded fit to SciPy. All three sectors together give **u₁ = 0.216, u₂ = 0.440**: the edge is 34% as bright as the centre. Fitted one at a time, the sectors give u₁ from 0.13 to 0.28 and u₂ from 0.37 to 0.54, while their sum stays between 0.65 and 0.67, so the edge brightness is steady. The fitted radius ratio, 0.1556, matches the map's 0.1553, and the transit comes 6.4 ± 0.9 s before the map's ephemeris. The limb plate is drawn as for WASP-43: a black overlay fitted edge to edge to the sphere's outline, dithered so the 8-bit alpha does not band.

**Axis: measured in three dimensions.** Cristo et al. (2024, [A&A 682, A28](https://doi.org/10.1051/0004-6361/202346366)) modelled the Rossiter–McLaughlin effect of HD 189733b in ESPRESSO spectra. As the planet crosses the rotating star it blocks first the side turning toward us, then the side turning away, which distorts the star's spectral lines. Their model includes differential rotation: the equator turns faster than the poles, so the distortion depends on the latitude the planet crosses. That gives the tilt of the axis toward us as well as its angle on the sky. Table 4 (model M1): projected obliquity λ = −1.00 +0.22/−0.23°, stellar inclination i★ = 71.87 +5.55/−6.91°, equatorial period 11.454 +0.092/−0.088 days. The rotation record, `cssearth-measured-obliquity-pole@1` ([rotation.json](source/preparation/rotation.json), read by [authored-rotation.mts](../../../tools/objects/authored-rotation.mts)), builds the axis in the planet's sky frame. The planet's orbit normal is (0, sin i, cos i) with +Z toward us; the spin axis is (sin i★ sin λ, sin i★ cos λ, cos i★). The star turns once every equatorial period. The record checks the published true obliquity: λ, i★ and the orbit's 85.71° inclination give ψ = 13.9°, inside the paper's 13.6 ± 6.9°. Longitude 0 faces the Sun at the scene epoch.

**Navigation marker.** The distant marker is the same disc: the spectrum's colour dimmed toward the limb by the same law, rendered by [author.mts](../../../tools/objects/source-authoring/hd-189733/author.mts) (`--check` recomputes it).

**On the map.** The star has no surface image, but a planet with imagery orbits it (`hostsImagery`) and its colour comes from its own spectrum (`sourceColor`, [prepare-object-discovery.mts](../../../tools/prepare-object-discovery.mts)), so it stays on the map.

**Its system.** The HD 189733 system holds the planet, on its measured orbit, and the companion B, which is measured to be bound to this star but has no measured orbit, so none is drawn (see [B's README](../hd-189733-companion/README.md)). The system view frames the planet's orbit, 7,000 times smaller than the companion's separation; once the camera is farther out than the two stars are apart, it turns onto the pair's centre of mass instead of this star.

**Catalogue colour.** the swatch that search, the catalogue and the minimap show is this lens's prepared colour, #ffe2cf.

## Evidence

Run of 2026-09-17 (this version): `node tools/prepare-object.mts hd-189733` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the pinned XP spectra of both HD 189733 stars and checks their colours, 255, 226, 207 and 255, 201, 123, and that the spectrum's errors move no channel by more than 3.
- [`source.test.mts`](../../../tests/objects/unit/hd-189733/source.test.mts) verifies the pins and acquisitions, that radius and GM are the map paper's stellar values, that placement is the archived Gaia row, and that the TESS fit returns the coefficients above from 30 transits with the map's radius ratio within 0.001.
- [`authored-rotation.test.mts`](../../../tools/objects/authored-rotation.test.mts) checks that λ −1.00° and i★ 71.87° with Cristo et al.'s own orbit inclination (85.508°) give ψ 13.68°, and that an aligned axis falls on the orbit normal. The source test checks that the prepared pole is 13.9° from HD 189733b's orbit normal.
- [`object-discovery.test.mts`](../../../site/test/object-discovery.test.mts) checks that the three HD 189733 bodies stay on the map under every discovery setting while Antares and Polaris stay hidden.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) and [`rendered-system-view.png`](source/reference/rendered-system-view.png) are the branch's dev server at `/hd-189733/` and `?overview=system` in headless Chrome, no console errors: the limb plate fitted to the sphere, and the planet's orbit around the star.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffe2cf is the colour lens's prepared colour.

## Known problems

**No image of the surface.** At 19.8 pc the disc is 0.38 mas across. That is too small for any telescope, and the public interferometry of this star measures its size, not its surface.

**The axis's tilt toward us rests on a tentative detection.** Cristo et al. detect differential rotation at 93.4% confidence; without it only the angle on the sky, 1°, is measured. The axis's position angle on the sky is not measured either: it is placed relative to the planet's orbit, whose orientation on the sky is a display convention. The sign convention of λ is not checked against the paper's; at 1° it moves the pole by 1°. The disc is uniform, so its rotation shows nothing, and differential rotation is not drawn.

**The radius is the map's, not the measured one.** The sphere is 9% smaller than the interferometric diameter, because the planet's orbit and size are fitted in units of 0.752 solar radii.

**The limb darkening is measured in red light, by this project.** TESS observes 600–1000 nm; in visible light a K dwarf darkens more. The folded transits scatter about 1.8 times their pipeline errors (reduced χ² 3.4), from starspots and stellar noise the model leaves out. The local 0.9-second timing uncertainty describes the fitted model near its optimum; it does not include those model inadequacies.

**The star is spotted, and no spot map is drawn.** SIMBAD classes HD 189733 A as a BY Draconis variable, a star whose brightness changes as spots rotate with it. Spots crossed during a transit are single strips at single moments, not a map.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
