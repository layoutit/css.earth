# ESPRESSO spectrum excerpt

`espresso-excerpt.fits` contains 16 consecutive samples (zero-based native indices 1708–1723) from ESO product [ADP.2024-03-08T10:41:06.519](https://dataportal.eso.org/dataPortal/file/ADP.2024-03-08T10:41:06.519), a combined ESPRESSO observation of HD 110067 on 2024-02-14. The full archive product is 17,841,600 bytes with 443,262 samples. Credit: ESO Science Archive / ESPRESSO; [ESO data-use policy](https://archive.eso.org/cms/eso-data/eso-data-access-policy.html).

The fixture is an excerpt, not the original archive product. Astropy 8.0.1 copied WAVE, FLUX, ERR and QUAL into a one-record binary table, retained their units and UTYPEs, set NELEM to 16, and copied the primary identity, spectrum category, calibration and frame keywords. Its first two samples have zero error; the remaining 14 supply usable values. ARCFILE identifies the parent product, not an independent archive file.

`astropy-reference.json` records the parent digest and sample counts as historical test evidence. Its numeric references were read independently with `astropy.io.fits`, using finite FLUX, finite positive ERR and QUAL=0. The TypeScript reader must reproduce every usable excerpt sample exactly. The complete parent has 440,029 usable samples and 3,233 excluded samples under that policy; the small fixture does not independently prove those full-file counts.

The decoder tests additionally cover invalid units, sample order, masks and gaps using synthetic records. The saved-session test serves this excerpt locally, binds it to captured ESO ObsCore structure, and checks the public exploration/get/outputs/family-operation path. It is a protocol replay, not a live archive search or a new calibration of the spectrum.
