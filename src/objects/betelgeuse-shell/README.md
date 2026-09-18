# Betelgeuse dust shell

## Sources

The shell is the degree of linear polarisation around Betelgeuse measured by VLT/SPHERE-ZIMPOL in the V band on 3 December 2024, from the ESO Phase 3 collection `BETELGEUSE-B` (programme 114.28H9.001, released 2026-08-19) that accompanies Montargès et al. (2026, [A&A 711, L12](https://doi.org/10.1051/0004-6361/202661023)). Two of the four released products are used: the pipeline intensity image `SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits` (ESO `ADP.2026-08-19T13:19:07.655`) and its ancillary degree-of-linear-polarisation map `SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits` (`ADP.2026-08-19T13:19:07.656`), both 1024 × 1024 pixels of 3.6 milliarcseconds, north up and east left by their WCS. The N_I pair is kept beside them and not shown: its polarisation is a tight ring at the limb, the pattern a resolved disc's own edge produces, while the V map shows the patches from one to 4.5 stellar radii that Kervella et al. (2016) and the release paper attribute to dust.

**Placement.** The cube's centre is Betelgeuse's own scene origin, the point its sphere is drawn at: the prepared bank's frame origin and the star's world frame agree to 794 metres, one and a half billionths of a stellar radius, which is float round-trip, and one volume unit is exactly one stellar radius. So the sphere is at the centre of the cube by construction, and the only question that can be got wrong is where the star sits inside the map.

**The two released products are not pixel-aligned to each other,** although they carry one WCS, and getting that wrong moved the whole envelope. The intensity image puts the star at pixel (513.00, 429.09): its peak, its half-maximum silhouette centroid and its ten-percent centroid all agree there. The degree map marks the stellar disc instead by setting 93 pixels to exact zero, a disc of 0.93 stellar radii centred at (502.40, 428.43), and nothing else in that frame is exactly zero. The two centres are 10.6 pixels apart, 38 milliarcseconds, 1.8 stellar radii. A first version measured the star on the intensity image and sampled the degree map about that point, which put the polarised envelope nearly two stellar radii off the star. Each product is now read about its own centre.

**Checked against the published figure.** Fig. B.1 of Montargès et al. 2026 is shipped in `source/previews/` and can be registered against the released degree map directly. Its five ticks an axis are 159.5 image pixels apart and label 50-milliarcsecond steps, which calibrates the panel at 0.31348 mas per pixel with no assumption: the panel spans 240.4 mas and the red circle marking the star is 21.0 mas in radius, against this package's stellar radius of 21.15 mas. Fitting the panel to the degree map at that fixed scale peaks at a normalised cross-correlation of 0.798 with the figure's origin at degree-map pixel (501.53, 430.31), and the peak is single and symmetric, falling to 0.09 within eight pixels either way. The mirrored fits reach only 0.455 and 0.421, which settles the grid's own handedness: increasing image column is west, as the sampling assumes. Against that origin the first version's sampling centre scored 0.282 and the present one scores 0.771, 2.1 pixels or 0.35 stellar radii from the paper's own marker, which is the precision of registering a smoothed figure.

**What is genuinely lopsided is the light, not the star.** The centroid of the drawn brightness between one and 4.5 radii lies about a stellar radius from the star, because the envelope is clumpy; one quadrant of the one-to-three-radius ring carries roughly a third of the polarised light of the other three. The published figure shows the same asymmetry.

**Depth: a shape fitted to the profile, not the image pushed backwards.** The map is a sky-plane image with no third axis, and an extrusion along the line of sight is not a shape. This package instead asks which simple envelope, placed around the star, projects to the radial profile that was measured. The azimuthal average between one and six stellar radii is fitted against a spherical shell of free radius and gaussian thickness, against the steady outflow a constant mass-loss rate gives, and against constant depth, which is what an extrusion assumes. The shell wins and is what is drawn:

| envelope | residual against a profile of 1.41e-2 |
|---|---|
| spherical shell, radius 3.50 R★, gaussian thickness 1.20 R★ | 4.28e-3 |
| steady outflow, ρ ∝ r^−0.70 | 6.23e-3 |
| constant depth, what an extrusion assumes | 6.94e-3 |

Each sky column is then spread along that envelope and normalised so it reproduces its own measured degree, which puts a patch at the shell's radius rather than smeared through the box. The envelope is symmetric in depth, so every patch is drawn both in front of the star and behind it; one image cannot say which, and nothing here pretends to. The author refuses to write the grid if the shell is not the best of the three. The map is floor-subtracted (the median degree between 8 and 12 radii, 0.55 percent, is instrumental) and carried on the same zero-to-0.10 scale as the published figure's colourbar; the disc within one radius and everything fainter than three thousandths of the stellar peak are removed; the map tapers out between 4.5 and six radii. The shell radius is inferred, not measured.

**Preparation.** `tools/objects/source-authoring/betelgeuse-shell/author.mts` samples each dataset into a 96³ density grid, `source/density-zimpol-v.ktx2` and `source/density-veil-2019-12.ktx2`, and writes the two volume recipes, the delivery, the presentation and the provenance record. The nebula delivery's `density-grid` method bakes 24 slabs per axis, half a radius apart, through the Milky Way's slab baker, one lens per grid, and the ordinary nebula preparation installs the lens bank. The two grids must share their bounds; the method refuses them otherwise.

## Where it appears

A cloud that surrounds the body it accompanies is not a place of its own, so this package ships no catalogue entry: it has no marker, no search result and no destination on the map. Its delivery names `attachedTo: "betelgeuse"` instead, and the bank it mounts stays dark until one of Betelgeuse's own datasets asks for it.

Betelgeuse's Datasets list therefore has three entries. `matisse` is the reconstruction and draws no cloud. `dust-2024` and `dust-2019` each name a lens of this package, and each borrows the MATISSE dataset's prepared surface for the star itself, so the two add no textures of their own: the photosphere is the same sphere under all three, and only the cloud around it changes. Selecting one asks the bank for that lens and turns the other off; one lens is drawn at a time.

## Evidence

- The ESO products are pinned by SHA-256 and size in `source/provenance.json`; the authoring script refuses a byte that differs.
- The star centre, intensity peak, polarisation floor and pixel scale are measured by the script and recorded in `source/provenance.json#/measured`.
- The acceptance gate for this proof is a rendered check of the cube around the sphere on the Betelgeuse page. It was made on 18 September 2026 against the local dev server, on all three of that page's datasets: the 2024 shell draws around the star, the 2019 clump draws in front of it and dims it, and the MATISSE dataset draws no cloud at all.

## Known problems

**Proof of concept.** This package exists to prove that a body can sit inside a prepared volume. It passes the application's availability gate on its own records; the local bypass an earlier draft needed is gone.

**No third axis.** The shell is an inference from one projected profile, not a measurement. Orbiting away from the observed direction shows the slab's assumed thickness, not a measurement. The masked disc is spread the same way, so it is a tube twelve radii long rather than a hole: seen from Earth's direction the star sits inside it, and seen from any other direction it reads as a dark lane through the cloud with the star in the middle of it. That lane is the convention made visible, not a placement error.

**The intensity file is scaled.** Its header carries `BSCALE = 10.977`; the shared FITS reader applies it, raw byte reads do not, and only ratios to the peak are used here.

**Colour is a legend, not colour.** The degree of polarisation is a ratio and has no colour of its own. The leaves carry the colour map the paper prints it in, matplotlib `inferno`, on the paper's own zero-to-0.10 scale, so this dataset is their Fig. B.1 given depth rather than a picture of coloured dust. Four stops of the bar, its quarters, are carried as four emission channels with the stop colours; the slab compiler sums them, so a line of sight emits the interpolated bar colour of its own measured degree, and every channel shares the one depth profile, which keeps a column's chromaticity constant instead of only approximately so. Four stops are the most an RGBA8 grid can hold, so the bar is interpolated between quarters rather than sampled continuously. Brightness follows the renderer's `1 - exp(-gain x column)` transfer rather than the flat bar of a printed figure, so mid-scale values sit brighter than a linear colourbar would put them; the hue at every value is the published one. The instrumental floor is subtracted here and is not in the figure, so empty sky is darker than the print.

## The December 2019 clump

The second lens is not an image. It is the dust clump Montargès et al. (2021, [Nature 594, 365](https://doi.org/10.1038/s41586-021-03546-8), preprint [arXiv 2201.10551](https://arxiv.org/abs/2201.10551)) fitted with RADMC-3D to the SPHERE images taken during the Great Dimming, drawn from the numbers they published. Their Extended Data Table 3 gives the December 2019 solution: a sphere of radius 6.5 au centred at (−1.9, −3.0, +12.5) au, of constant dust density 3.2 × 10⁻¹⁹ g cm⁻³, in MgFeSiO₄ grains centred on 0.21 µm. Their Extended Data Figure 6 defines the axes: x along right ascension, y along declination, z positive toward Earth. That places the clump south and slightly west of the star and between it and us, which is why the southern hemisphere went ten times darker.

December 2019 is the only epoch shipped. The paper records its January and March 2020 solutions as unoptimised best guesses.

The clump is drawn as starlight scattered by that dust: the published density is uniform, so the brightness that varies across it is only the inverse-square illumination each parcel receives from the star. It is warm because scattered starlight is the star's own colour; nothing about its colour was measured.

## How the two lenses sit against the star

The volume normally composites behind the body, which would put a clump that occults the star behind it. A lens may therefore declare the centre of a compact structure that stands clear of the body in depth. The bank then moves that lens's cloud above or below the detail scene each frame, by which of the two is nearer to the camera. The 2019 clump declares one, and preparation refuses to write it unless every voxel of the grid is nearer to the observer than the photosphere. The 2024 map declares none, because its emission surrounds the star instead of standing clear of it, so it always draws behind.

That ordering is what lets the clump dim the star. The slab compiler takes absorption channels beside emission, so the clump's leaves carry their extinction as alpha and the light they scatter as colour, and ordinary source-over compositing gives transmission times the star behind plus the scattered term. The absorption is scaled from the paper's own report that the southern hemisphere went ten times darker: the line of sight through the clump's centre carries an optical depth of ln 10. The scattered light is drawn at four percent of the photosphere's surface brightness, which is a display choice and is marked as one.

What this still cannot do is cut a leaf at the limb. The clump covers the whole silhouette it crosses rather than being clipped by the sphere, which is exact here only because the clump stands clear of the photosphere in depth. Its extinction is grey; silicate dust reddens what it transmits, and no colour was applied because the photosphere behind it is drawn in an infrared intensity palette rather than in colour.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](source/provenance.json)

## What is not verified

The grid's axes come from the products' own WCS, and its sky plane reproduces the patch layout of the published figure with east on the left. The clump is transcribed into the same frame from the paper's stated axes. The step that has not been checked is the last one: at the world camera used for this object's captures the volume's east axis projects to the screen's right, while the star's own default camera is documented as putting east on the left. The two cameras differ in roll, and the renderer's world frames mirror celestial content unless a flag compensates. North and south are not in doubt, and the clump covers the star's southern half as the Great Dimming did, but do not read the east–west side of either dataset off the screen until that check is made. The ledger carries it as an open decision.
