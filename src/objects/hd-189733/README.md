# HD 189733 A

HD 189733 A is a K2 dwarf in Vulpecula, 19.8 parsecs away. It hosts the hot Jupiter
[HD 189733b](../hd-189733b/README.md), and the red dwarf [HD 189733 B](../hd-189733-companion/README.md) moves with it
through space. No image of the star's surface exists. The package draws it as a sphere of the size its planet's map
assumes, in the color of its measured spectrum, darkened toward its edge as the planet's transits show, and turning
on the spin axis measured against the planet's orbit. The default dataset overlays a published spot-band illustration. Three
"Radial field" datasets show the star's magnetic field in 2006, 2007 and 2013, mapped in this project from archived spectra,
each with a corona derived from it ([hd-189733-corona](../hd-189733-corona/README.md)).

## Sources

- **Placement.** Gaia DR3 source 1827242816201846144, archived in `photometry/gaia-dr3-source.csv` (its
  [acquisition record](../../sources/gaia-dr3-hd-189733.json), epoch J2016.0). The distance is 1000 / 50.567 mas =
  19.776 pc, with no parallax zero-point correction.
- **Radius and mass.** 0.752 solar radii and 0.807 solar masses, from Lally et al. (2025,
  [arXiv:2503.20895](https://arxiv.org/abs/2503.20895), Table 1), whose eclipse map of HD 189733b is fitted in units of
  this radius.
- **Color.** The Gaia DR3 BP/RP spectrum (Montegriffo et al. 2023), 336 to 1020 nm every 2 nm, pinned as
  `photometry/gaia-dr3-xp-sampled.csv`.
- **Limb darkening.** Three TESS SPOC 2-minute light curves, sectors 41, 54 and 81, restored from MAST.
- **Spot bands.** [Narrett, Rackham & de Wit (2024)](https://doi.org/10.3847/1538-3881/ad1f6c), their
  [Figure 7, left](https://www.astroexplorer.org/details/ajad1f6cf7).
- **2021 spot.** [Haris, Tuomi & Hackman (2025)](https://doi.org/10.1051/0004-6361/202452633), Table 3.
- **Axis.** Cristo et al. (2024, [A&A 682, A28](https://doi.org/10.1051/0004-6361/202346366)), Table 4, model M1.
- **Magnetic maps.** 31 polarised spectra from CFHT's ESPaDOnS spectropolarimeter, in the
  [Canadian Astronomy Data Centre](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/) archive (CC BY 4.0): 9 of 5 to 14
  August 2006 (programs 06BD01, 06BF27, 06BT15), 15 of 23 June to 4 July 2007 (07AC27) and 7 of 13 to 27 September 2013
  (13BE92). The three programs `hd-189733-<run>-as-drawn` in
  [the telescope's ESPaDOnS archive](../../../packages/telescope-cli/src/archives/espadons/programs/) pin every spectrum
  by its size. A run's receipt, with what every step measured, is a result that `reduce.mts` writes under ignored `output/espadons`. The maps are the tables in
  `source/science/espadons/`.

## Processing

**Color.** [stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)
weights the spectrum from 380 to 780 nm by the CIE 1931 2° observer and converts to sRGB with its D65 white, scaled so
the brightest channel is full: 255, 226, 207 (#ffe2cf). The method record is
[`stellar-color.json`](source/photometry/stellar-color.json). This is the star's own measured light, not a blackbody.

**Limb darkening.** No published fit to TESS transits covers this star, so the package fits one.
[transit-limb-darkening.ts](../../../packages/bake/src/objects/raster/eclipse-map/transit-limb-darkening.ts) keeps
good-quality PDCSAP samples, normalizes each of the 30 complete transits and folds them onto the planet's orbit.
[transit-timing.ts](../../../packages/bake/src/objects/raster/eclipse-map/transit-timing.ts) uses batman and SciPy for
the fit. The result is u₁ = 0.216, u₂ = 0.440: the edge is 34% as bright as the centre.

**Spot-band model (default).** Narrett et al. infer 42 ± 4% mean spot coverage and a 0.099 spot-to-photosphere
intensity ratio in the TESS band. Their Figure 7 is a hypothetical example of dense latitudinal bands. The
`activity-model` dataset extracts the figure's dark pattern with the
[extraction record](source/photometry/narrett-2024-band-model.json), removes the dotted transit guides and bakes it into
the limb plate. Spots keep about 10% of the nearby photospheric light, applied achromatically over the Gaia color. The
`color` dataset shows the star without spots.

**2021 spot.** Haris et al. report a dark-region occultation during transit 2165 (BJD−2450000 9435.46), with minimum
angular radius 5.0 (+1.0/−0.8)° and TESS-band contrast 0.076 (+0.041/−0.025). The `spot-2021` dataset places a
spherical cap of that radius along the observed transit chord. Its circular shape and position across the chord are
display choices.

**Axis.** Cristo et al. modelled the Rossiter–McLaughlin effect in ESPRESSO spectra with differential rotation, which
gives the tilt of the axis toward us as well as its angle on the sky: λ = −1.00 +0.22/−0.23°, i★ = 71.87 +5.55/−6.91°,
equatorial period 11.454 +0.092/−0.088 days. The rotation record ([rotation.json](source/preparation/rotation.json),
read by [authored-rotation.ts](../../../packages/bake/src/objects/scene/authored-rotation.ts)) builds the axis in the
planet's sky frame.

**Magnetic maps.** No map of this star's field has been released as a file, so these are made here, with the codes the
method's authors publish and nothing of our own in between
([A star's magnetic map from archived spectra](../../../docs/stellar-magnetic-maps-from-spectra.md)): Korg computes the
depth of 8,537 atomic lines in a 5,023 K, log g 4.58 model atmosphere (the TESS Input Catalog's values), LSDpy averages
them into one polarised profile for each spectrum, and ZDIpy fits the field to each run's profiles. The fit uses the tilt
and the period this page already draws (71.87°, 11.454 days at the equator, the poles turning 0.159 rad/day slower), not
the 85° and 11.94 days of the papers that mapped the star, so that a map sits on the sphere the way it was fitted.
Longitude 0 faces us at the middle of each run. One color scale, ±150 G, serves the three maps. The nights of June 2006 are
not mapped: three nights cover a quarter of a rotation, and fitted together with August the two months do not make one
field (reduced chi-square 7.1 at best).

**System.** Companion B is bound to this star but has no measured orbit, so none is drawn. The navigation marker is
rendered by [author.mts](../../../packages/telescope-cli/authoring/hd-189733/author.mts) (`--check` recomputes it).

## Evidence

- Moving every spectrum sample one standard error changes the blue channel by at most 2.
- Fitted one at a time, the TESS sectors give u₁ from 0.13 to 0.28 and u₂ from 0.37 to 0.54, while their sum stays
  between 0.65 and 0.67, so the edge brightness is steady. The fitted radius ratio, 0.1556, matches the map's 0.1553.
  The transit comes 6.4 ± 0.9 s before the map's ephemeris.
- λ, i★ and the orbit's 85.71° inclination give a true obliquity ψ = 13.9°, inside the paper's 13.6 ± 6.9°.
- Fares et al. (2010, MNRAS 406, 409, Table 1) print the longitudinal field of the June 2007 spectra. The same 15 spectra
  reduced here give a mean of -3.36 G against their -3.47 G, with an rms difference of 0.82 G, a third of the two error bars
  combined (`compare.mts hd-189733-2007-06`).
- Fitted with the papers' tilt and period, the June 2007 map has a mean field of 23.5 G and 59% of its energy in the
  toroidal part; Fares et al. (2010, Table 2) give 22 G and 57%, from these spectra and four more of another telescope.
- As drawn here, each fit reaches the noise: reduced chi-square 1.25, 1.20 and 1.30, against 22.5, 13.1 and 61.0 with no
  field. The mean field is 27 G in August 2006, 24 G in June 2007 and 55 G in September 2013; Fares et al. (2017,
  [arXiv:1706.07262](https://arxiv.org/abs/1706.07262)) find 42 G for 2013 with the other tilt.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) and
  [`rendered-spot-2021-view.png`](source/reference/rendered-spot-2021-view.png) show the two spot datasets;
  [`rendered-system-view.png`](source/reference/rendered-system-view.png) shows the planet's orbit around the star.

## Known problems

- **No image of the surface.** At 19.8 pc the disc is 0.38 mas across, too small for any telescope. The public
  interferometry of this star measures its size, not its surface.
- **The radius is the map's, not the measured one.** CHARA measured a limb-darkened diameter of 0.3848 ± 0.0055 mas in
  the H band (Boyajian et al. 2015, MNRAS 447, 846), which gives 0.818 solar radii at the Gaia distance. The sphere is
  9% smaller; see the [investigation ledger](investigations.json).
- **The axis's tilt toward us rests on a tentative detection.** Cristo et al. detect differential rotation at 93.4%
  confidence. The axis's position angle on the sky is not measured; it follows the planet's orbit, whose sky orientation
  is a display convention. The sign convention of λ is not checked against the paper's; at 1° it moves the pole by 1°.
- **The magnetic maps are this project's reduction, not published maps.** A star turning this slowly, seen this close to
  equator-on, constrains a map weakly: the two hemispheres largely cancel in the polarised light. How tightly a map is
  fitted is a choice the mapping code leaves open; it is set on 21 published maps, whose mean fields the same recipe
  reproduces with a scatter of a factor 1.4. The 2013 map rests on 7 spectra.
- **The limb darkening is measured in red light.** TESS observes 600–1000 nm; in visible light a K dwarf darkens more.
  The folded transits scatter about 1.8 times their pipeline errors (reduced χ² 3.4), from starspots and stellar noise.
- **Spot patterns are stationary models.** A transit constrains one chord, not the whole photosphere. The Figure 7
  bands illustrate one arrangement consistent with activity estimates, not a measured surface; their dark pixels cover
  about half the disc, which is not a new measurement of spot coverage. Both spot plates stay fixed while the sphere
  turns, and spot contrast is applied achromatically.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
