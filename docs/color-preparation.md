# Source-backed surface color

Source calibration, image registration and display color answer different
questions. A registered, calibrated infrared image does not establish the color
of a surface to a human observer. These rules apply to every body and preparation
lane; the runtime renderer only receives prepared display assets.

## Source interpretation comes first

| Source | Preparation | What the result can claim |
| --- | --- | --- |
| Publisher-prepared RGB image or RGB mosaic | Preserve the published channel order and display processing; honor an embedded color profile where the decoder supports it. Do not apply a second transfer intended for raw measurements. | The publisher's documented natural, approximate, enhanced or false-color interpretation. Three channels alone establish none of these. |
| Calibrated spectral bands | Validate the native band identities and units, register each observation, retain floating values through sampling and compositing, and apply an explicit scientific display at the end. | A band composite. Calibration or an sRGB output does not qualify it as natural color. |
| Archive-derived, sharpened spectral mosaic | Preserve the archive's band identities and processing. Treat the values according to the archive, without relabeling them as untouched radiance or reflectance. | The published derived/enhanced interpretation, with our additional display transfer identified. |
| One measured band | Use its documented monochrome display and coverage. | Monochrome observations, not recovered surface color. |
| Calibrated sky survey bands (nebula lab) | Calibrate each band to MJy/sr, subtract one measured background, divide by that band's own measured range, then apply one common asinh display. See [sky survey bands](#sky-survey-bands). | A band-normalized false-color view that shows where each band is bright. Hue does not show physical band ratios. |
| Numeric scientific field or categories | Use the declared palette, range, units and legend. | A visualization of that field, not photographed color. |
| Shape-only model | Use the existing model presentation. | Measured or modeled shape, without a photographic color claim. |

Do not infer a missing visible band from infrared/ultraviolet, invent a camera
color matrix, white-balance to an assumed neutral patch, or adjust saturation
until a body looks plausible. A natural-color reconstruction requires a cited
method applicable to the actual instrument and inputs, its supported calibration
and registration, and evidence appropriate to that claim. If that evidence is
missing, retain an explicitly scientific interpretation or defer the natural-color
view. A description or a successful geometric fit cannot supply missing evidence.

NASA explains the distinction between [measured visible RGB and false-color
band combinations](https://science.nasa.gov/earth/earth-observatory/how-to-interpret-a-false-color-satellite-image/).
Even the Cassini visible-band approximation in [Ordóñez-Etxeberria et al. (2019),
section 5](https://arxiv.org/abs/1905.02978) explicitly acknowledges instrument/eye
response differences and a synthetic red band. That Jupiter-specific method is
not a universal calibration for other bodies.

## Keep measured values until the display boundary

The shared [color transfer](../packages/bake/src/objects/color/color-transfer.ts) builds one
band-composite display per product. The route names the actual ordered bands and
their quantity from what it reads, checked against native labels where the product
has them, and the recipe declares only the common `displayRange`. Each route
refuses any other key, so a recipe has no place for natural-color claims,
independent channel gains or automatic white balance. Photometrically matched
color is compared with its monochrome base in display-linear light, so that method
fixes its range at 0 to 1. Already encoded image bytes cannot be sent through the
floating-band encoder.

The common range assigns normalized measurements to **linear display channels**.
This assignment is a scientific visualization, not an instrument-to-eye transform.
Interpolation, photometric corrections and overlap blending precede display
encoding. Missing-band footprints remain missing. Only the final output clips
values and quantizes them to eight bits.

The final transfer follows [IEC sRGB, as published by the ICC](https://registry.color.org/rgb-registry/files/sRGB.pdf):
for a bounded linear channel `L`, the code value is `12.92 L` below or at
`0.0031308`, and `1.055 L^(1/2.4) - 0.055` above it. An 18% linear channel maps
to byte 118, not 46. Writing linear measurements directly as display bytes
exaggerates channel differences when the display decodes those bytes.

This correct encoding does **not** turn IR/UV data into natural color. It makes
the chosen scientific display consistent with its declared linear channel values.
The display range is an explicit visualization choice, not a measured albedo
maximum or a new calibration constant.

## Current routes and scope of the repair

The preparation audit distinguishes producers, not body names. The retained
[all-object registration review](provenance/surface-registration-review.md)
provides the full 473-package disposition and its earlier reviewed revision;
this color repair does not promote its unresolved registration cases:

- `controlled-shape-color`: Pan, Atlas, Daphnis, Prometheus, Pandora, Janus,
  Epimetheus, Hyperion and Proteus, through the
  [shared surface-observation pipeline](../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md).
  Each band set names its red, green and blue photographs, and native labels
  must agree with the selected filters and calibrated reflectance units. A point
  is colored only where all three bands qualify, and it keeps the one band set
  the dataset selects. Level matching scales the three bands by one gain, so their
  measured ratios stay. The bands remain floating through the shared footprint,
  photometry and surface transfer; the same encoder finishes them.
- `terrestrial-observed-color`: Europa's Galileo I/F bands and the Voyager
  ISS bands of Triton and the five classical Uranian moons. Photometry and common brightness matching run before the final
  encoding. The already prepared monochrome base is decoded only as a display
  reference for that matching; its brightness does not establish natural color
  or new radiometric calibration. Two profile policies are recipe choices, not
  defaults: `withheld: "next-observation"` lets the next densest observation own
  a texel the densest one views or lights too steeply, for observations from
  one encounter (Europa's orbits keep the default, `monochrome`, so no other
  date's color fills a withheld footprint); `bandLevels` scales each
  observation's bands onto one named reference observation through the median
  ratios where their corrected footprints overlap, solved by weighted least
  squares over every overlapping pair on a coarse grid, and records the pairs
  and gains in the photometry report; the brightness match to the base is
  then one pooled gain for the dataset, clamped so 99.9 % of texels encode
  without clipping, instead of one gain per observation. The reference is chosen from evidence
  recorded in the body README, never by preference for a look. `bandRatios` ties the
  composed footprint's whole-disc band ratios to a published whole-disc color
  named in the recipe (the Uranian moons use Bell and McCord 1991): each named
  band takes one gain so its cosine-weighted mean against the reference band's
  mean equals the published ratio, and the report carries the measured ratios,
  the published ones and the gains. It answers a documented filter-calibration
  defect of the archive product, never a preference for a look; spatial color
  differences stay the observation's own.
- `pds4-float-rgb`: Charon's archive-produced, pan-sharpened MVIC composite.
  Its values are derived band values, not untouched I/F. The reader validates
  the archived wavelengths and applies its explicit common display range once.
- `nh-mvic-camera`: Arrokoth's registered, PSF-matched MVIC cube, through the
  [shared surface-observation pipeline](../packages/bake/src/objects/layers/terrestrial/surface-observations/README.md).
  Its native PDS label binds BLUE/RED/NIR/CH4 order, wavelengths and data-number
  units. The selected NIR/red/blue values remain floating through the shared
  footprint, photometry and surface transfer; the same encoder finishes the
  atlas samples and map preview, and its policy appears in the standard report.
- Published RGB/byte-band mosaics, static images, geographic imagery, giant-planet
  observations, scientific palettes and shape presentations do not enter this
  floating-band encoder. Their established source display interpretation is
  preserved; this change does not requalify them as natural color.

The audit located twelve active surfaces in four affected routes. The new shared
surface-observation pipeline from PR #173 is included in this repair. It also
searched 2,015 preparation JSON files smaller than 1.5 MB for authored color
matrices, white balance, saturation and tonal overrides; the only matching
active color-space fields were Io's existing sRGB decoder settings. That search
is a configuration inventory, not independent scientific validation of every
published image or a claim that every body has measured natural color.

## Sky survey bands

The [sky band composer](../packages/telescope-cli/src/sky/sky-band-composite.mts) turns
calibrated infrared survey bands into the nebula lab's working images. Its route
table owns the calibration: the WISE Explanatory Supplement DN-to-Jy factors for
1.375 arcsec atlas pixels, and the IRAC Handbook surface-brightness corrections
for the CDS IRAC maps. A recipe names bands, a grid, one background percentile,
one peak percentile and one display. It cannot hold a band gain.

Surface bodies keep one common range, so that measured band ratios survive.
Sky bands do not. At M8, the median 8 µm brightness above background is about
eight times the 3.6 and 4.5 µm values. With one common range, the image is red
everywhere and shows no structure in the shorter bands. Each sky band is
therefore divided by its own range: from its background percentile to its peak
percentile. This is the usual practice for survey false color. It is still a
visualization, and the dataset description must say that hue shows each band's
relative brightness, not physical band ratios.

Dividing by the band's own range cancels its calibration factor, so the MJy/sr
conversion does not change the image. It gives the recorded background and peak
physical units, and lets a later common-range display compare bands. What the
image shows comes from the band selection and the declared normalization and
stretch, not from calibration.

The shared [Lupton et al. (2004)](https://doi.org/10.1086/382245) asinh display then
maps the mean of the normalized bands and scales every band by the same factor.
Pixels brighter than the display are scaled down as a whole, which keeps their hue.
`packages/bake/src/objects/color/color-transfer.oracle.test.mts` matches every byte of Astropy's
`make_lupton_rgb` for color and one-band cases.

The WISE HiPS maps carry a separate level for each atlas tile, which shows as
rectangles once faint emission is stretched. WISE bands are therefore built from
the AllWISE atlas tiles, with one level fitted for each tile from its overlaps
([wise-atlas-mosaic.ts](../packages/bake/src/objects/raster/wise-atlas-mosaic.ts)).

The compositor also selects WISE atlas tiles by their projected footprint polygon, not its bounding box, and leaves out a grid-edge tile whose overlaps are too small to fix its level only when the joined tiles already cover every pixel it observed; such a tile is recorded in the evidence.

Scanned photographic plates saturate, so the sky band route measures that from the plate itself: a flat-topped
core a point spread function cannot produce, grown to where the ring median reaches the plate's own background
([plate-saturation.ts](../packages/bake/src/objects/layers/observation/plate-saturation.ts)). Those pixels are neither light nor
zero. A recipe that declares `coverage: "alpha"` composes an RGBA raster whose alpha is 0 wherever no band
observed a pixel, and the nebula lab carries that channel through rectification into the coverage its material
and fits read. Plate-to-plate background steps are a separate defect and are not corrected: the plate footprints
are not in the pinned inputs, and a segmentation of the plate's own background map cannot separate a seam from
the extended light of the object on it.

Two routes extend this. Two bands display as red and blue, with their mean as green, following the [CDS DSS2 color survey](https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FDSS2%2Fcolor&get=record&fmt=json). Bands without a documented flux calibration, the DSS2 photographic plates and the ESASky Herschel HiPS, keep `toMJyPerSr: null` and record their levels in relative source units. Dividing by each band's range means the image looks the same either way. The missing calibration only limits what the recorded levels can claim.

JWST bands come either from MAST's level-3 mosaics or from the pipeline's level-3 stage re-run onto the recipe grid; both are
already MJy/sr, so the route applies no factor. [JWST imaging](jwst-imaging.md) describes both routes, the reproduction check
against MAST and what they cost. A recipe may set `pointSources: "mask"` to report stars found on each band as no coverage
([point-sources.ts](../packages/bake/src/objects/layers/observation/point-sources.ts)), which a dataset that places the image in depth needs.

## Star photospheres

A star whose surface is not imaged still has a measured color: its spectrum. The `stellar-photometric-color` kind
([stellar-photometric-color.ts](../packages/bake/src/objects/stellar/stellar-photometric-color.ts)) reads one archived spectrum
in its own layout, averages it into 1 nm bins from 380 to 780 nm, weights it by the CIE 1931 2° observer and converts it to
sRGB with the D65 white, brightest channel full. It reads HST CALSPEC and the STIS libraries, Gaia DR3 XP, X-Shooter, UVES,
LAMOST and the Pulkovo, Kiehling, Burnashev and Kharitonov spectrophotometric catalogues. Plain column tables can carry a one-sigma error column: a bin below zero within three errors counts as no light, and the color range is the spectrum moved one error down and up. A record may set `gamut: 'desaturate'` when a measured color falls outside sRGB; the least white needed to bring it inside is mixed in and reported. A stretch with no data inside
380-780 nm must be declared as a gap, with its reason. Checked against the Sun, the route turns CALSPEC's solar spectrum
into #fff2ee, the color the Sun's swatch takes from a different spectrum (ASTM E490) with Color Science.

For a new star, [new-object/color.mts](../packages/telescope-cli/src/new-object/color.mts) (run by `telescope new-object`) tries the archives in
this order and keeps the first spectrum the reader accepts, with the next as its cross-check: the STIS Next Generation Spectral
Library, Gaia DR3 XP (from the ARI Heidelberg mirror when ESA's DataLink is down), Pulkovo, Kiehling, Kharitonov, then Burnashev's
part 2. With none, the color is a Planck spectrum at the cited temperature.

A planet nobody has imaged takes its color from what is measured
([new-object/planet-datasets.mts](../packages/telescope-cli/src/new-object/planet-datasets.mts)). Where the NASA Exoplanet Archive's
emission-spectroscopy table holds a measured dayside brightness temperature from a secondary eclipse, the planet gets the
"Thermal glow" dataset: a black body at that temperature over the disc, lit by the sphere lighting so the day side faces its
star, with reflected starlight left out because nothing measured says how much there is. The row is chosen by rule, the
smallest relative uncertainty and the longest wavelength on a tie, every row is kept in the package, and the choice is
stated in the record. Below about 1,800 K a black body lies outside sRGB and is shown mixed with the least white that brings
it inside, hue kept, which the dataset says. A planet with nothing measured keeps the neutral gray, lit by its host's measured
color instead of a white lamp: the gray's brightness with the host color dataset's chromaticity (`hostLitGray` in
[color-transfer.ts](../packages/bake/src/objects/color/color-transfer.ts)). `telescope new-object --from-archive` does both; `node packages/telescope-cli/src/new-object/new-object-cli.mts --thermal <id>...`
and `--host-light <id>...` (that entry only) give them to planets already in the tree.

The archive's emission table stopped growing, so a planet it lacks is looked up in the Spitzer eclipse catalogue of Deming et
al. (2023, AJ 165, 104; CDS `J/AJ/165/104`, table 2): one uniform reanalysis of every Spitzer eclipse of 122 hot Jupiters, with
a dayside brightness temperature at 3.6 and 4.5 µm. The same rule picks the band. A band Spitzer never observed is printed
as 0 and a temperature whose lower error reaches it is not a detection; neither is used. A planet on an orbit with an
eccentricity of 0.3 or more gets no glow: one eclipse catches it near its closest approach, not its day side round the orbit.

A measured day side that cannot be a glow is still shown, as a dataset of its own
([dayside-dataset.mts](../packages/telescope-cli/src/new-object/thermal/dayside-dataset.mts)). Under 1,000 K a black body has no
visible color, and on an eccentric orbit the temperature holds for one moment. In both cases the `measured-dayside` format
paints the hemisphere under the star in false color at the one printed brightness temperature and leaves the night hemisphere
blank, because an eclipse says nothing of it. Every planet drawn this way shares one scale, 300 to 3,000 K, so their colors
compare. An eccentric planet's texts say "at secondary eclipse"; past an eccentricity of 0.6 (HD 80606 b) nothing is drawn.
`--thermal-entries entries.json` takes a day side read from its own paper, for a planet neither table holds.

### The expected glow of a hot giant

A hot giant nobody has measured still gets a color, said to be an estimate wherever it is shown: the "Expected glow"
dataset, a black body at the equilibrium temperature a paper prints for it (`--expected-glow <id>...`). The temperature is
the archive's default parameter set's when that set prints one, the most recently published paper's otherwise; the TESS
candidate list is not a paper and is not used.

It is an estimate with a measured error. The catalogue above holds both numbers for 120 hot Jupiters on near-circular
orbits: the measured 4.5 µm day side (table 2) and the equilibrium temperature (table 3). Measured over estimated has a
median of 1.08, 68% of the planets between 0.95 and 1.20, and 83% within 20%. Taken with the archive's own
equilibrium temperatures, the ones the estimate uses, on the 107 of those planets the archive has one for: a median of 1.08,
85% within 20% and 95% within 30%. So the estimate is shown only where that test
reaches: a planet of at least 0.77 Jupiter radii, the smallest in the sample, hotter than the 1,000 K a black body needs to
glow, on an orbit rounder than 0.3. A measured day side replaces it: `--thermal` rebuilds an expected glow as a thermal glow.

A small planet is covered by a second, separate test, and only where that test reaches. Coy et al. (2025, ApJ 987, 22,
Table 2) print, for nine rocky planets of red dwarfs, the measured day side over the hottest a dark, airless rock can be:
0.88 to 1.07. For a gray planet like those nine (at most 1.5 Earth radii, a star no hotter than 3,600 K, an irradiation
temperature of 480 to 1,930 K) the expected glow is that maximum, the star's temperature over the square root of a/R*, times
(2/3)^(1/4), from the star's and the orbit's own records, and its texts state the test and its one outlier since (GJ 357 b,
35% above). The archive's insolation, printed in another column and often by another paper, is the check: seven planets
agree within 1%; TOI-6324 b disagrees by 13% and is left gray. Hot rocks of Sun-like stars and hot sub-Neptunes have no
such test and stay gray.

![Dataset thumbnails: HD 219134 c gray, HD 219134 b the same gray under its host's light, HD 209458 b and WASP-39 b glowing at their measured dayside temperatures](images/planet-color-routes.png)

![Before and after on the page: TRAPPIST-1 e, Kepler-186 f and HD 219134 b under their stars' light, HD 209458 b at its measured dayside heat; the flat gray discs on main had no stylesheet sizing their lighting frame](images/planet-color-before-after.png)

The star's catalogue swatch, minimap dot and navigation marker take the same color
([stellar-spectra/author.mts](../packages/telescope-cli/authoring/stellar-spectra/author.mts)). A star with no usable
spectrum keeps the star field's temperature fit at a cited effective temperature
([star-catalogue-color.ts](../packages/bake/src/objects/color/star-catalogue-color.ts)).

**Cross-checks.** A color record may name a second spectrum from a different instrument. Preparation records its color
beside the dataset color, and [object-package-consistency.test.mts](../src/objects/object-package-consistency.test.mts) fails when
the two differ by more than 12 levels in any channel unless the record states the disagreement.

**Limb darkening**, in this order of preference:

1. Coefficients measured on the star, from transits of its planet or from interferometry, in or near the visible.
2. The Claret & Bloemen (2011) V-band model grid (ATLAS, 3,500 K and hotter) at the star's cited temperature and gravity,
   labelled as a model. Cooler stars and brown dwarfs use the Claret (2017) PHOENIX grid instead (down to 2,300 K). Both
   are read bilinearly between the four surrounding grid nodes.
3. None, when the star lies outside both grids or falls in a hole in them. The value is not extrapolated, and the dataset
   says why it stays flat.

![Stars drawn with a limb law from a model grid or, for Luhman 16 B, a fit of its own light](images/star-limbs.png)

The plate is a round overlay fitted to the sphere's outline at its drawn size, geometry scale included.

**A planet with a map is lit.** A hosted planet whose dataset is a map (a heat map, a model, an illustration) is drawn lit by
its star, a sphere under the shared lighting bank, with shadows off until the reader turns them on. Nine planets built by hand
were once drawn self-luminous, flat discs with no limb; `new-object --star-lit <id>...`
([star-lit.mts](../packages/telescope-cli/src/new-object/map/star-lit.mts)) moved them, so every map is drawn one way. The
shading is a display convention, not data: a map's colors are read against its legend where the disc is fully lit. Only a body
seen by its own light, a star or an imaged planet with a disc color, stays self-luminous.

**An imaged planet's limb.** A planet seen by its own heat is one infrared color on an unresolved disc. It takes its law
the way a cool star does, from a model grid at its own temperature and gravity: Claret, Hauschildt & Witte
([2012](https://ui.adsabs.harvard.edu/abs/2012A&A...546A..14C/abstract)), PHOENIX models from 1,500 to 4,800 K, in the H
band, the middle band of a J, H, K color (`new-object --imaged-limb <id>...`,
[imaged-limb.mts](../packages/telescope-cli/src/new-object/imaged/imaged-limb.mts)). The nodes it is read between are kept
beside the planet, and every text calls it a model.

No published table reaches a planet cooler than 1,500 K, and a cloud-free model is not an answer for a cloudy planet. Where a
paper has fitted a public grid of model atmospheres to the planet, the law is computed from that fitted model: PICASO takes
its structure and its clouds and gives the intensity at eight viewing angles in the middle band of the planet's color
([picaso-limb.mts](../packages/telescope-cli/src/new-object/picaso-limb.mts)). The fit is transcribed with its table in
`source/photometry/atmosphere-fit.json`. Three grids are read:

- **Sonora Diamondback** (Morley et al. [2024](https://doi.org/10.3847/1538-4357/ad71d5)), cloudy, with the release's cloud
  optical properties. PICASO reproduces how the grid's published J−H and H−K colors change when the clouds thin from f_sed 1
  to 2 at 1,100 K, log g 3.5 and [M/H] +0.5: 0.369 and 0.345 mag against the published 0.366 and 0.373.
- **Exo-REM's public grid** for young giant planets (Charnay et al. [2018](https://doi.org/10.3847/1538-4357/aaac7d);
  [release](https://lesia.obspm.fr/exorem/YGP_grids/old_grids_2021/)), cloudy. Each model's file states, layer by layer, the
  gas abundances and the optical depth and particle radius of its iron and silicate clouds; their extinction, albedo and
  asymmetry at each wavelength come from Exo-REM's own optical-constant tables. The grid steps by half a decade in metallicity
  and 0.05 in C/O, and the law is read at the composition nearest the fit. The release carries the spectrum its authors
  computed, and each node records the band flux computed here over theirs.
- **Sonora Elf Owl** (Mukherjee et al. [2024](https://doi.org/10.5281/zenodo.10381250)), cloud-free, from the release's own
  file, which states the abundances of its disequilibrium chemistry and carries its spectrum; each node records the same
  ratio (1.04 for Epsilon Indi Ab at 10.65 µm).

A cloudy model is solved with PICASO's four-term spherical harmonics (Rooney, Batalha & Marley
[2023](https://arxiv.org/abs/2304.04830)), not its two-stream solver. Through a thick scattering cloud the two-stream
intensities are too flat toward the limb, and the flux says so: for the 850 K, log g 4.0 Exo-REM model in the H band, two
streams give 78% of the release's flux and an edge-most angle 72% as bright as the centre; four terms give 95% and 45%. A
cloud-free model's intensities are the same with either solver.

Exo-REM's neighbouring models differ in how deep their cloud tops lie, so a law read between four of them can differ much
from node to node; each README states that range and the flux ratios. A planet with no usable fit stays a flat disc, and its
ledger says why, with the fits read in its papers.

A self-luminous planet with no measured color is a gray disc, and it takes a law the same way: its fit record names the band
it is seen in (`band`), and the law darkens the gray (PDS 70 c, in SPHERE K1). The gray stays a display convention; only the
darkening is the model's.

**Gravity darkening.** A star that spins fast is flattened and hotter at its poles. Where a paper publishes a Roche-von Zeipel
fit (ω, β, the polar temperature, the radii and the pole's orientation), [gravity-darkening.ts](../packages/bake/src/objects/stellar/gravity-darkening.ts)
rebuilds the surface from those numbers and writes a temperature for each latitude row. Its tests require the paper's
equatorial radius and temperature to come back within their errors. The measured flattening is drawn as an ellipsoid.

![The placed stars' color datasets, each from a measured spectrum](images/star-colors.png)

**Pulsation.** A Cepheid's brightness follows Gaia DR3's published harmonic model through each period; [light-curve.ts](../packages/bake/src/photometry/light-curve.ts)
reads it as published and checks it against the same row's amplitude and epoch of maximum.

![HV 1345 through one cycle](images/cepheid-light-curve-phases.png)

## Evidence must match the claim

Check native band identities, units and registration separately from display
encoding. Numeric reference cases prove the transfer, late clipping and the
absence of double encoding. A rendered comparison can show the display change;
it cannot validate natural color without a suitable source reference.

The raster lane retains decoder reports per prepared density in its surface
metadata. Camera composites keep the policy in their source-grid report; the
shared surface-observation lane includes it in its standard display report.

Keep the input/output hashes, color policy and inspected product captures with
the body evidence. Reuse unchanged camera holdouts only with an explanation of
why the display-only work leaves their geometry and source samples applicable.
Follow the [visual-comparison contract](provenance/CONTRACT.md#say-what-the-checks-prove);
do not Pixelmatch different spectral combinations to claim fidelity.

For the 2026-09-13 refresh, each body's capture records the exact recipe, runtime,
transfer and delivered-image hashes, compared with retained geometry. Source registrations and native observations are unchanged. Captures
made before the final capture-helper edits remain applicable: those edits add an
optional viewpoint, an installed-Chrome selector and larger diagnostic response
buffers; they do not change prepared data or rendering. Europa's capture faces
its measured color footprint rather than the unchanged initial viewpoint.

A photographic refresh resolves declared monochrome dependencies for decoding
and minimaps while packing only the selected surface. Caption updates re-pin the
checked-in runtime's transport without recompiling texture geometry or seam
treatment.
