# B10 independent Diviner source review

Reviewed 2026-09-09. Metadata/research and tiny scalar byte-range samples only; no full source download, preparation, or runtime qualification was performed by this reviewer.

## Array interpretation and implementation decisions

The three selected PDS IMG labels declare version 1.0, modification 2023-09-28, little-endian IEEE754 float32, zero byte offset, 17,920 north-to-south lines by 46,080 samples increasing east. Missing values are NaN. There is no DN scaling or declared numeric valid range. The labels specify 0–360°E, planetocentric latitude, Moon_2000 sphere with radius 1,737,400 m, equirectangular central meridian 180°, 128 pixels/degree.

- [Midnight bolometric label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/dghrm_tbol_m_70s70n_img.xml)
- [Anomaly label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/dghrm_tbol_anom_70s70n_img.xml)
- [Rock abundance label](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/data_derived_ghrm/img/dghrm_ra_sam_70s70n_img.xml)

Derived zero-based pixel-center formulas:

```text
longitudeEast = (column + 0.5) / 128
latitudeNorth = 70 - (row + 0.5) / 128
byteOffset = (row * 46080 + column) * 4
```

Thus the first pixel center is 0.00390625°E, 69.99609375°N. Conversion to a -180..180 texture requires an explicit half-width rotation. Merely assigning -180 as the west edge would misregister everything by 180°. Do not apply the old Moon RA source's ×0.001 scale to these float IMG values.

## Units, range, missing coverage

The [Diviner SIS](https://pds-geosciences.wustl.edu/lro/urn-nasa-pds-lro_diviner_derived1/document/Diviner_RDR_SIS.pdf), §11.1, gives temperatures in kelvin and rock abundance as an areal fraction between 0 and 1. Section 2.4.3 identifies the lunar mean-Earth/polar-axis reference frame. Section 11.2 distinguishes local midnight (`m`), slope-adjusted midnight (`sam`), and anomaly at slope-adjusted midnight (`anom`). Section 11.3 describes a ±180° global extent, but the individual product labels determine raster ordering.

**Implementation recommendation:** Preserve the native source values. For display, treat NaN and nonfinite samples as unavailable. Treat finite RA outside [0,1] as rejected, separately counted coverage, rather than silently converting negative values into measured zero abundance. Neither the reviewed labels, SIS, paper nor author README explains negative RA values or authorizes interpreting them physically. This rejection policy is our conservative application of the documented physical range, not an additional PDS missing-value code. Negative temperature anomalies are meaningful and must remain valid. Use a zero-centered diverging anomaly scale. Show unmapped polar caps and rejected cells as unavailable, independently from low values.

## Scientific meaning and independent external anchors

[Powell et al. 2023](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2022JE007532), §§2.4–3.3,4.1,4.3: Midnight values fit combined nighttime observations; they are not a contemporaneous snapshot. Slope-adjusted midnight accounts for east–west slope timing. Bolometric anomaly is observed minus modeled typical-regolith temperature at slope-adjusted midnight, including topographic corrections; positive values do not establish geothermal activity. Corrections remain imperfect, particularly at high latitudes. Rock abundance estimates the area fraction of thermally distinct, roughly metre-scale rocks using a two-component model, not rock counts or bulk mineral composition.

The paper reports effective equatorial resolution near 330 m longitudinally and 700 m latitudinally; 128 ppd is grid spacing, not isotropic native resolving power. It reports missing spatial bins of about 0.003% for brightness/bolometric temperature and about 0.16% for modeled quantities within the latitude envelope; measure this implementation's accepted coverage independently.

Useful paper anchors: flat nonrocky terrain is approximately 101 K at the equator and 83 K near 70°. Apollo 17 crater RA ordering is Steno-Apollo (~0.074), Powell/Sherlock (~0.034), Camelot (~0.014). These regional approximate values are not exact single-pixel assertions.

## Independent byte-range orientation check

`ra-orientation-range-check.json` records eight four-byte HTTP206 reads, including raw hex and exact offsets. Samples at the paper's crater coordinates support the product label's 0° west origin:

| Crater | Longitude E | Latitude N | PDS containing-bin RA | Incorrect -180° origin RA |
|---|---:|---:|---:|---:|
| Steno-Apollo | 30.794 | 20.145 | 0.09225715 | 0.00316957 |
| Powell | 30.763 | 20.160 | 0.03357376 | 0.00211349 |
| Sherlock | 30.813 | 20.184 | 0.02818383 | 0.00239332 |
| Camelot | 30.731 | 20.195 | 0.01039920 | 0.00270396 |

These establish orientation and numerical scale; they do not replace whole-file hashes, full-range scans, or source-to-browser registration evidence. Small-crater regional values can differ from a containing-bin sample, as the coordinates are rounded and the instrument response extends beyond one bin.

## Author release, compressed alternatives, reuse

The paper-linked [UCLA dataset](https://doi.org/10.25346/S6/LFAVXU) has current version 2.0 and an explicit CC0 1.0 license in the working [dataset API](https://dataverse.ucla.edu/api/datasets/:persistentId/?persistentId=doi:10.25346/S6/LFAVXU). Exact metadata and author README are saved alongside this review, with SHA-256 receipts. The author TIFFs are also approximately 3.329 GB each, so they offer no meaningful size reduction. Compressed JP2 alternatives quantize RA to 0.001 and temperatures/anomalies to 0.01 K; they are not lossless substitutes for float32 values. Preserve full float32 for subtle rock-abundance comparisons.

| Author TIFF | File ID | Bytes | Author MD5 |
|---|---:|---:|---|
| RA_SAM_70Sto70N.tif | 37397 | 3328870918 | 079fd1c1fa32b858ab8c8534be0ff122 |
| TBOL_M_70Sto70N.tif | 37289 | 3328841070 | 6aa3cc021b282cd46d6019ac9b97e424 |
| TBOL_ANOM_70Sto70N.tif | 37402 | 3328867130 | 0e0e81a5396f6263940c0a28232817c6 |

JP2 IDs: RA 37396 (316,212,712 bytes); midnight 37306 (894,050,270); anomaly 37399 (896,033,854). Download endpoint: `https://dataverse.ucla.edu/api/access/datafile/{id}`. Author README: RA = DN×0.001; midnight K = DN×0.01+100; anomaly K = DN×0.01. Do not assume author TIFF/JP2 raster ordering or whole-file equality with PDS from product names. The research article's publication license is separate from the dataset's CC0 license; generate visualizations from the data, with source attribution.
