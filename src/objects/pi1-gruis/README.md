# π¹ Gruis

π¹ Gruis is placed at its catalogue position, 162 parsecs from the Sun, and
shown as a sphere of the fitted radius carrying one image reconstructed from the
public VLTI/PIONIER visibilities of September 2014, the data behind the first
resolved granulation on a star other than the Sun. A colour dataset shows the
colour of its Gaia spectrum.

## Sources

- **Placement:** the ICRS position, proper motion and parallax are SIMBAD's, from Gaia DR3 (Gaia Collaboration 2020): parallax 6.19 ± 0.45 mas, 161.7 pc, with RUWE 2.9 because the star is a wide binary. No catalogue lists a radial velocity for the star; the record assumes zero. The mass behind the display GM is the 1.5 solar masses of Mayer et al. (2014, A&A 570, A113).
- **PIONIER photograph:** Paladini et al. (2018, [Nature 553, 310](https://doi.org/10.1038/nature25001); ESO release [eso1741](https://www.eso.org/public/news/eso1741/)) imaged π¹ Gruis in the H band over four nights in September 2014. Their image-ready calibrated file is public in the [JMMC OiDB](https://oidb.jmmc.fr/) (`PI_GRU_forImage.fits`, data PI C. Paladini) and is read as is.
- **Reconstruction code:** the public [SQUEEZE](https://github.com/fabienbaron/squeeze) code; `source/reference/squeeze-command.txt` records the build and the command.
- **Colour dataset:** Gaia DR3's measured spectrum of π¹ Gruis; the file and the full citation are in [stellar-color.json](source/photometry/stellar-color.json).

## Processing

The uniform-disc diameter fitted to the pinned visibilities is 18.17
milliarcseconds, which at 161.7 pc is 219,710,723 km, 316 solar radii.
`packages/bake/authoring/pi1-gruis/author.mts` writes the reference sphere at
that radius, and the surface-observation route casts the image onto it, as for
Betelgeuse. An asymptotic giant branch photosphere has no sharp limb; the sphere
is the surface the image is cast onto, not a measured shape.

SQUEEZE reconstructs the image with the prior used for Betelgeuse (maximum
entropy, µ = 10, uniform-disc start, 128 pixels of 0.4 mas). `author.mts`
convolves it to the 2.1 mas interferometric beam, and that is what the dataset
casts. The palette is the Betelgeuse heat scale over the 1st to 99.5th
percentile; the legend reads relative intensity at 1.65 µm.

No rotation is measured. The record uses the `cssearth-display-orientation@1`
convention: the display axis is celestial north at the star, the display
meridian faces Earth at the scene epoch, and no spin is propagated.
`presentationUp: display-axis` puts that axis up, so the camera orbit lies in
the star's equator, where the sub-Earth point is.

The spectrum's samples from 380 to 780 nm are weighted by the CIE 1931 2°
observer and converted to sRGB with the D65 white
([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)):
**#ff9a41**. [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts)
writes it, and `--check` recomputes it. The disc is dimmed toward the limb by
the power law I(mu) = mu^1.29 fitted to the PIONIER visibilities inside the
first lobe.

The [navigation marker](source/preparation/navigation.json) is a photosphere
crop of the reconstruction, centred and sized from the matching frame in
[the raster recipe](source/preparation/raster.json). It omits off-limb emission.

## Evidence

- An independent discrete Fourier transform, without SQUEEZE, fits the image to the pinned file at reduced chi-squared below 3 on squared visibilities and below 1.5 on closure phases (SQUEEZE reported 2.45 and 1.06). A uniform disc fits the visibilities at reduced chi-squared 51.
- The beam-convolved image still fits the closure phases (1.3) but not the squared visibilities (55), so the display image is smoother than the data.
- Preparation accepted 1,433 pixels with geometry; 12.8 percent of the beam-convolved flux lies outside the fitted disc and is drawn on the off-limb plate.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) shows the default camera: the photographed hemisphere faces the camera with the display axis up.

## Known problems

- **The image is a reconstruction.** An interferometer records no picture. The image is the maximum-entropy solution SQUEEZE prefers; a different regulariser changes the fine structure. The published image was made from the same file with a different code and is not redistributed here.
- **The axis is a convention.** Where the pole really points is unknown. Longitudes on this sphere mean nothing beyond the image.
- **One hemisphere, one band, one week.** The far hemisphere and the poles carry the no-data grid. The heat scale is not colour, temperature or albedo. The granulation pattern changes on a timescale of months.
- **The colour's blue end is uncertain.** At G = 3.6 the star is bright enough for Gaia XP photometry to saturate, blue first (Montegriffo et al. 2023, A&A 674, A33), and its RUWE is high. No usable second spectrum was found.
- **The radius is a fit.** Mayer et al. (2014) list 370 solar radii from the bolometric luminosity.
- **The limb law depends on the baselines.** Inside the first lobe it is 1.29 ± 0.11; fitted to every baseline it is 0.42 ([record](source/photometry/pi1-gruis-pionier-2014-09-first-lobe-limb-darkening.json)). It is measured in the H band, not the visible band.
- **The sky is the Sun's.** The star field behind π¹ Gruis is the shared cube baked from the Sun's position.
- **Self-luminous, so no lighting.** The star is drawn by the emissive material; no light direction or shadow is applied.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
