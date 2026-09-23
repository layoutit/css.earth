# ESPRESSO spectrum excerpt

`espresso-excerpt.fits` contains 16 consecutive samples (zero-based native indices 1708–1723) from ESO product [ADP.2024-03-08T10:41:06.519](https://dataportal.eso.org/dataPortal/file/ADP.2024-03-08T10:41:06.519), a combined ESPRESSO observation of HD 110067 on 2024-02-14. The full archive product is 17,841,600 bytes with 443,262 samples. Credit: ESO Science Archive / ESPRESSO; [ESO data-use policy](https://archive.eso.org/cms/eso-data/eso-data-access-policy.html).

The fixture is an excerpt, not the original archive product. Astropy 8.0.1 copied WAVE, FLUX, ERR and QUAL into a one-record binary table, retained their units and UTYPEs, set NELEM to 16, and copied the primary identity, spectrum category, calibration and frame keywords. Its first two samples have zero error; the remaining 14 supply usable values. ARCFILE identifies the parent product, not an independent archive file.

`astropy-reference.json` records the parent digest and sample counts as historical test evidence. Its numeric references were read independently with `astropy.io.fits`, using finite FLUX, finite positive ERR and QUAL=0. The TypeScript reader must reproduce every usable excerpt sample exactly. The complete parent has 440,029 usable samples and 3,233 excluded samples under that policy; the small fixture does not independently prove those full-file counts.

The decoder tests additionally cover invalid units, sample order, masks and gaps using synthetic records. The saved-session test serves this excerpt locally, binds it to captured ESO ObsCore structure, and checks the public exploration/get/outputs/family-operation path. It is a protocol replay, not a live archive search or a new calibration of the spectrum.

## UVES spectrum excerpt

`uves-hd189733-excerpt.fits` contains 16 consecutive samples (zero-based native indices 5000–5015) from the public UVES product [ADP.2020-06-09T07:00:12.910](https://dataportal.eso.org/dataPortal/file/ADP.2020-06-09T07:00:12.910) of HD 189733 A. The original file is 6,261,120 bytes, SHA-256 `1c574c6cc9005577e05a6fe6a039f0fdc89cdc6c849324015b3a02995afb404c`. Credit: ESO Science Archive / UVES; [ESO data-use policy](https://archive.eso.org/cms/eso-data/eso-data-access-policy.html).

Astropy 8.0.1 copied the native vectors and their units into a one-record excerpt. The excerpt retains the additional `FLUX_REDUCED` and `ERR_REDUCED` columns before the calibrated `FLUX` and `ERR` columns, as well as the archive's `VOCLASS=SPECTRUM v2.0` spelling. The TypeScript reader must select the calibrated columns by name and reproduce the independent Astropy values exactly. `ARCFILE` identifies the parent product, not the excerpt as an archive file.

The [reference](uves-astropy-reference.json) records full-product counts: 85,123 native samples, 83,919 usable under the F03 QUAL/FLUX/ERR policy, and 1,204 excluded. The fixture alone does not prove those full-file counts. UVES covers 373–500 nm here, so this product does not independently establish full visible-band stellar colour. Its `FLUXCAL=ABSOLUTE` is the archive's declaration, not an independently checked calibration.
