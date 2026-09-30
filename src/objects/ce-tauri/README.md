# CE Tauri

CE Tauri (119 Tau) is a red supergiant in Taurus. It is placed at its catalogue position, 658 parsecs from the Sun, and shown as a sphere of the published diameter carrying the two images its authors reconstructed from VLTI/PIONIER data and deposited at the CDS. Nothing is reconstructed in this repository: the images are cast as published.

## Sources

**PIONIER images.** The CDS catalogue [J/A+A/614/A12](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/614/A12) holds the mean SQUEEZE images of the November 2016 and December 2016 datasets and their standard-deviation maps: 32 by 32 pixels of 0.5 mas, north up, east left. The paper merges all six H-band channels and reports reduced chi-squared 1.53 and 2.08 against its own reduction. The December image is the default dataset. The two images share one entry in the dataset selector ([dataset groups](../../../docs/reader-text.md#dataset-groups)).

**Placement.** The ICRS position, proper motion and parallax are SIMBAD's, from Gaia DR3: parallax 1.52 ± 0.27 mas, 658 pc. Montargès et al. (2018) use the Hipparcos 1.82 ± 0.26 mas (549 pc). The radial velocity, 23.75 ± 0.44 km/s, is Famaey et al. (2005, A&A 430, 165). The display GM uses the paper's current mass of 14.37 solar masses.

**Radius.** Montargès et al. (2018, [A&A 614, A12](https://doi.org/10.1051/0004-6361/201731471)) fit a power-law limb-darkened disc of 10.18 ± 0.07 mas at 1.62 µm to the December 2016 data (10.09 ± 0.09 mas in November). At the Gaia distance that is 720 solar radii; the paper's 593 solar radii come from the Hipparcos distance. `packages/bake/authoring/ce-tauri/author.mts` writes the reference sphere.

**Colour.** The colour dataset is CE Tauri's Crimean photoelectric spectrum of 24 October 1982, weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): #ffa64f. The file and full citation are in [stellar-color.json](source/photometry/stellar-color.json), and [stellar-spectra/author.mts](../../../packages/telescope-cli/authoring/stellar-spectra/author.mts) writes the colour; `--check` recomputes it.

**Limb.** The disc is dimmed toward the limb by the quadratic law Neilson & Lester (2013), A&A 554, A98 compute from spherical ATLAS (SATLAS) model atmospheres for the Johnson V band at 3,801 K and log g -0.12 (u1 1.111, u2 -0.000). The law reaches zero at 99.5% of the radius.

**Rotation: none measured.** The display axis is on celestial north, the `cssearth-display-orientation@1` convention used for π¹ Gruis and Antares.

The [navigation marker](source/preparation/navigation.json) is a photosphere crop of the December reconstruction, placed from the matching frame in [the raster recipe](source/preparation/raster.json). It omits off-limb emission and reconstruction background.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

## Evidence

- `tests/objects/unit/ce-tauri/reconstruction.test.mts` fits the published images to the public calibrated PIONIER files in the OiDB, channel by channel. The November image fits the November nights at reduced chi-squared 17.8 on squared visibilities and 35 on closure phases. The December image fits 23 December at 14.4 and 3.0. Mirroring or turning the November image makes the fit several times worse, which pins its orientation. A uniform disc of the published diameter fits worse still.
- `tests/objects/unit/ce-tauri/camera.test.mts` recomputes every camera field of both datasets and checks the disc centres are the images' flux centroids.
- Preparation accepted 293 of 325 pixels with geometry in each image; 2.3 and 2.6 percent of the flux lies outside the disc and is drawn on the off-limb plate.
- [`source/reference/rendered-default-view.png`](source/reference/rendered-default-view.png) shows `/ce-tauri/` with the default camera.

## Known problems

**The public visibilities are not the authors'.** The OiDB files are the JMMC pipeline's automated calibration, not the reduction of the paper with its own calibrators. The published images fit them only at the chi-squared above, so the test pins that they are the right images in the right orientation, not that they fit these files. Reconstructing from these files with the pinned SQUEEZE code does not converge.

**Finer than the beam.** The images are shown at their published 0.5 mas pixels. The longest baseline gives a 1.8 mas beam, so the pattern inside the disc is the authors' super-resolved reconstruction; the paper measures its contrast at 5 to 6 percent.

**The axis is a convention.** Where the pole really points is unknown.

**The colour varies.** A second Crimean scan in February 1983 is paler (#ffb859), and Gaia XP gives #ffbe5f, though Gaia XP is unreliable this bright. CE Tau is a semi-regular variable, so which colour is typical is not settled.

**Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

**The sky is the Sun's.** The star field behind CE Tauri is the shared cube baked from the Sun's position.
