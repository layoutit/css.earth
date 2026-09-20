# VO boundary fixtures

Captured on 2026-09-20 using the repository's pinned PyVO 1.9.1 during the independent review of PR #423 at `cbcad927220c95853260363c2a6a4cd8ff6002c8`.

| File | Provenance and supported claim |
| --- | --- |
| `alma-obscore.xml` | Original ALMA TAP response body. Two rows have distinct observation IDs but the same publisher ID. The nine-character MIME field is malformed. SHA-256 `ea9d3eda733a4299d5b98fb2110b2f0cf26e410fafc0fcbbeb5b84621f49226f`. |
| `eso-links.xml` | **PyVO reserialization, not original HTTP bytes.** ESO advertises a fixed dataset ID and CIRCLE but no BAND. SHA-256 `10aa66b0a724d8aab1cc0df7b28dfd7e09b8136baeed4720503ee7f4c4d4a80c`. |
| `eso-circle.fits` | Actual 290,880-byte response for ICRS circle 88.792938, 7.407063, radius 0.3/3600 degrees; 166×166 primary array. SHA-256 `fd2a2d371e121bb50f64d781ac57b60f2f76d2c25d71f1c6a5ab9b5e262def60`. This is a transfer/format fixture, not a calibration or region-coverage oracle. |
| `eso-obscore.xml` | Original ESO TAP response to `SELECT TOP 1 * FROM ivoa.ObsCore WHERE dataproduct_type='image' AND s_ra BETWEEN 88.78 AND 88.81 AND s_dec BETWEEN 7.39 AND 7.42`. Captured by the new boundary; reproduces zero-dimensional masked values. SHA-256 `0aee7b10fa96ed66c0de76da16f917e3674eb1fc1904660a422aa9f86ffb0a22`. |
| `psa-epn.xml` | Original PSA TAP response to `SELECT TOP 1 * FROM psa.epn_core WHERE target_name='Mars'`. Captured by the new boundary; tests EPN field metadata and missing values. SHA-256 `9ee97fdf5bd1a48e7701f556484d42943a33b9fc532a34d68fd360e440aa6b85`. |

Source services: [ALMA TAP](https://almascience.eso.org/tap), [ESO DataLink](https://archive.eso.org/datalink/links?ID=ivo://eso.org/ID?ADP.2026-08-19T13:19:07.647), [ESO SODA](https://dataportal.eso.org/dataPortal/soda/sync).

Tests may replace the ESO service endpoint with a local test server. Those responses are synthetic protocol fixtures and make no live-service claim. The ESO fixed-ID UCD `meta.id;meta.dataset` compatibility is limited to that documented declaration; missing parameters are never invented.
