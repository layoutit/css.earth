# CE Tauri

## Sources

CE Tauri (119 Tau) is a red supergiant in Taurus and the fourth star placed here. It is placed at its catalogue position, 658 parsecs from the Sun, and shown as a sphere of the published diameter carrying the two images its authors reconstructed from VLTI/PIONIER data and deposited at the CDS. Unlike Betelgeuse and π¹ Gruis, nothing is reconstructed in this repository: the images are cast as published.

**Placement.** The ICRS position, proper motion and parallax are SIMBAD's, from Gaia DR3: parallax 1.52 ± 0.27 mas, 658 pc. Montargès et al. (2018) use the Hipparcos 1.82 ± 0.26 mas (549 pc). The radial velocity, 23.75 ± 0.44 km/s, is Famaey et al. (2005, A&A 430, 165). The mass behind the display GM is the current mass of 14.37 solar masses in the paper's stellar parameters.

**Radius.** Montargès et al. (2018, [A&A 614, A12](https://doi.org/10.1051/0004-6361/201731471)) fit a power-law limb-darkened disc of 10.18 ± 0.07 mas at 1.62 µm to the December 2016 data (10.09 ± 0.09 mas in November). At the Gaia distance that is 500,725,430 km, 720 solar radii; the paper's 593 solar radii come from the Hipparcos distance. The reference surface is a 5-degree sphere table written by `tools/objects/source-authoring/ce-tauri/author.mts`.

**Rotation: none measured.** The rotation record is the `cssearth-display-orientation@1` convention used for π¹ Gruis and Antares, with the display axis on celestial north. For a northern star that axis points to the star's right ascension plus 180 degrees. The star record sets `presentationUp: display-axis`, and the default view is one degree from the sub-Earth point.

**PIONIER images.** The CDS catalogue [J/A+A/614/A12](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/614/A12) holds the mean SQUEEZE images of the November 2016 and December 2016 datasets and their standard-deviation maps: 32 by 32 pixels of 0.5 mas, north up, east left. The paper merges all six H-band channels and reports reduced chi-squared 1.53 and 2.08 against its own reduction. Each image is one lens, cast by the surface-observation route with the same palette as the other stars; the December image is the default and the navigation marker.

**Colour lens.** The colour of CE Tauri's Crimean photoelectric spectrum. The scan is from 24 October 1982; a second scan in February 1983 is paler, and CE Tau varies. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ffa64f**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). No model limb darkening is added: the supergiant's gravity is below the Claret & Bloemen (2011) grid, and the PIONIER lens shows its measured disc. The catalogue swatch and the minimap use the same colour; the navigation marker stays the image. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Gaia DR3 XP spectrum, source 3400796031719045632 (G = 3.1, likely saturated) gives #ffbe5f, 24 levels from the lens colour in its most different channel; Gaia XP gives a paler colour (#ffbe5f), and so does the second Crimean night (record 647, #ffb859); CE Tau is a semi-regular variable and Gaia XP is unreliable this bright, so which colour is typical is not settled.

## Evidence

- `tests/objects/unit/ce-tauri/reconstruction.test.mts` fits the published images to the public calibrated PIONIER files in the OiDB, channel by channel, without the code that made them. The November image fits the November nights at reduced chi-squared 17.8 on squared visibilities and 35 on closure phases. The December image fits 23 December at 14.4 and 3.0. Mirroring or turning the November image makes the fit several times worse, which pins its orientation. A uniform disc of the published diameter fits worse still.
- `tests/objects/unit/ce-tauri/camera.test.mts` recomputes every camera field of both lenses from the astrometry, the display axis and the image headers, and checks the disc centres are the images' flux centroids.
- `tests/objects/unit/ce-tauri/source.test.mts` verifies every pin, that the radius is the published diameter at the stated distance, and that the sphere and the marker are the authoring tool's output.
- `tests/objects/unit/ce-tauri/default-view.test.mts` derives the default camera from the runtime's camera math.
- Preparation accepted 293 of 325 pixels with geometry in each image; 2.3 and 2.6 percent of the flux lies outside the disc and is drawn on the off-limb plate.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/ce-tauri/` with the default camera.
- Run of 2026-09-21 (this version): [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #ffa64f is the colour lens's prepared colour; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour from the pinned spectrum.

## Known problems

**The public visibilities are not the authors'.** The OiDB files are the JMMC pipeline's automated calibration, not the reduction of the paper with its own calibrators. The published images fit them only at the chi-squared above, so the test pins that they are the right images in the right orientation, not that they fit these files. Reconstructing from these files with the pinned SQUEEZE code does not converge.

**Finer than the beam.** The images are shown at their published 0.5 mas pixels. The longest baseline gives a 1.8 mas beam, so the pattern inside the disc is the authors' super-resolved reconstruction; the paper measures its contrast at 5 to 6 percent.

**The axis is a convention.** Where the pole really points is unknown.

**The default camera shows the sky as seen.** As for the other stars, it faces Earth with celestial north up and east on the left; the sphere, the display axis and the halo plate agree with the sky view. Measured with `tools/objects/default-view.mts` and pinned by the default-view test.

**The sky is the Sun's.** The star field behind CE Tauri is the shared cube baked from the Sun's position.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
