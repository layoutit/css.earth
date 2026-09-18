# Betelgeuse dust shell

## Sources

The shell is the degree of linear polarisation around Betelgeuse measured by VLT/SPHERE-ZIMPOL in the V band on 3 December 2024, from the ESO Phase 3 collection `BETELGEUSE-B` (programme 114.28H9.001, released 2026-08-19) that accompanies Montargès et al. (2026, [A&A 711, L12](https://doi.org/10.1051/0004-6361/202661023)). Two of the four released products are used: the pipeline intensity image `SPHERE_ZIMPOL_Betelgeuse_P1_V_phase3.fits` (ESO `ADP.2026-08-19T13:19:07.655`) and its ancillary degree-of-linear-polarisation map `SPHERE_ZIMPOL_Betelgeuse_P1_V_DOLP.fits` (`ADP.2026-08-19T13:19:07.656`), both 1024 × 1024 pixels of 3.6 milliarcseconds, north up and east left by their WCS. The N_I pair is kept beside them and not shown: its polarisation is a tight ring at the limb, the pattern a resolved disc's own edge produces, while the V map shows the patches from one to 4.5 stellar radii that Kervella et al. (2016) and the release paper attribute to dust.

**Placement.** The cube is anchored on the Betelgeuse object's own scene origin, not on the FITS header centre, which is the catalogue position and sits 0.8 arcseconds, 38 stellar radii, from the star at the scene epoch. One volume unit is one stellar radius (531,514,800 km, Joyce et al. 2020), so the cube spans six radii each way. The star's centre in the image is the intensity centroid, at pixel (513.0, 429.1).

**Depth model, stated.** The map is a sky-plane image with no third axis. Following the convention of the polarimetric papers, the polarised light is placed in the plane of the sky through the star and spread along the line of sight by the Rayleigh polarisation efficiency r² / (r² + 2 z²), normalised so that each sky pixel's column reproduces its measured degree. The map is floor-subtracted (the median degree between 8 and 12 radii, 0.55 percent, is instrumental) and stretched linearly to 5 percent; the disc within one radius and everything fainter than three thousandths of the stellar peak are removed; the map tapers out between 4.5 and six radii. Depth is not measured.

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

**No third axis.** Everything along the line of sight is a stated model. Orbiting away from the observed direction shows the slab's assumed thickness, not a measurement.

**The intensity file is scaled.** Its header carries `BSCALE = 10.977`; the shared FITS reader applies it, raw byte reads do not, and only ratios to the peak are used here.

**Colour.** The leaves carry a scalar degree of polarisation rendered as white light; the map has no colour.

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
