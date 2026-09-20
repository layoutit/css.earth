# Telescope family examples

This directory pins one compact, reviewable public-path example for every F01–F18 family. `manifest.json` is the source of truth: every row records the real source URL and byte pin, exact CLI command, committed output pin, product-record/readback proof, owner, independent check, and scientific limit.

Each row carries `exampleProven: true` and `proposalBaseline.status: "complete"` because its family baseline is now executable through a public owner. The examples remain deliberately bounded: completeness applies to the recorded format profile and operations, not every format that could belong to the family.

| Family | Review artifact | Public path | What it proves |
| --- | --- | --- | --- |
| F01 | `artifacts/F01.csv` | `telescope export` | Native 2D image values |
| F02 | `artifacts/F02.json` | `telescope family-run` | Mixed time, Stokes and spectral slicing with FITS/WCS context |
| F03 | `artifacts/F03.csv` | `telescope family-run` | Standalone spectrum export |
| F04 | `artifacts/F04.json` | `telescope family-run` | Pinned slit-scan inspection |
| F05 | `artifacts/F05.csv` | `telescope family-run` | Discrete photometry export |
| F06 | `artifacts/F06.csv` | `telescope family-run` | Explicit time selection |
| F07 | `artifacts/F07.csv` | `telescope family-run` | Native dynamic-spectrum window |
| F08 | `artifacts/F08.json` | `telescope family-run` | Typed table inspection |
| F09 | `artifacts/F09.csv` | `telescope family-run` | Astrometry export |
| F10 | `artifacts/F10.csv` | `telescope family-run` | Selected event rows with lineage |
| F11 | `artifacts/F11.json` | `telescope family-run` | Selected UVFITS visibilities with package-owned UV preview |
| F12 | `artifacts/F12.json` | `telescope family-run` | OIFITS V2 diagnostics |
| F13 | `artifacts/F13.json` | `telescope family-run` | Declared Stokes spectrum and explicit polarization policy |
| F14 | `artifacts/F14.json` | `telescope family-run` | Native HEALPix NESTED pixel selection |
| F15 | `artifacts/F15.json` | `telescope family-run` | Native delay-Doppler profile |
| F16 | `artifacts/F16.json` | `telescope family-run` | Existing physical point-field inspection |
| F17 | `artifacts/F17.json` | `telescope family-run` | Pinned NEAR MSI raw/calibrated/label closure |
| F18 | `artifacts/F18.json` | `telescope family-run` | Exact compound-member enumeration |

Descriptor member paths are relative to each descriptor, so the examples contain no checkout-specific absolute paths. Runtime `output.product.json` receipts are deliberately not copied here; the manifest points at focused tests that reopen and verify those records.
