# B4 — Measured moon observations

B4 adds **18 prepared observation views across all nine planned moons**, backed by
13 retained numerical source files. Charts expose observing dates, physical quantities,
uncertainties, original-source links and downloadable measurements. Negative values,
noise, instrument gaps and quality flags remain explicit.

Draft [PR #70](https://github.com/layoutit/cssEarth/pull/70); full application scene conformance remains unverified.

Owner: Moons · Branch `feat/moons-observation-charts` · Started 2026-09-09.
Started from merged [B3 PR #67](https://github.com/layoutit/cssEarth/pull/67),
`c016fd31d711e204bab4521c82c7e2e192f6e0df`. Integrated the shared-card update from
[PR #69](https://github.com/layoutit/cssEarth/pull/69),
`ef2d27b2da3e774b2410f216b0e6024b972ee39a`.
The six B3 research carry-forwards remain unscheduled.

## Source review and delivered scope

Every disposition revisits the completed [body review](review-2026-09-08/BODY-REVIEWS.md).
These whole-disk measurements do not establish spatial mineral maps or new terrain.

| Moon | Views | Retained measurements | Interpretation and limits |
| --- | ---: | --- | --- |
| Himalia | 2 | MAST program 4028; G235M and G395M X1D FITS, 1,425 + 1,341 rows | 2024-01-31 calibrated point-source flux density, propagated errors. No solar division or thermal subtraction; these are archive extractions, not the paper's final reflectance curves. |
| Epimetheus | 2 | Two author CSVs, JWST program 1247; 730 + 700 rows | 2022-11-08. Separate dithers retain negative samples and outliers. Short-wavelength coverage is limited by ring stray light. |
| Telesto | 2 | Two author CSVs, JWST program 1247; 860 + 860 rows | 2022-11-10. Background artifacts remain; below 1.3 µm, residual stray light is possible. Statistical errors exclude some systematics. |
| Pandora | 1 | One author CSV, JWST program 1247; 700 rows | Extracted from the Epimetheus pointing on 2022-11-08, 22:15–22:29 UT. It is not assigned the separate Pandora pointing's time. |
| Ymir | 4 | Denk's four Cassini ISS sequences; 20, 94, 84 and 299 rows | Relative magnitude versus author-folded rotational phase. Separate dates and solar phase angles. Brighter is upward; no per-point errors were released. |
| Albiorix | 1 | MAST program 3716 PRISM X1D FITS; 941 rows, 940 valid | 2023-11-22 archive flux. The combined product includes a dither reported to contain a background source. The possible contamination is visible in the caption. |
| Siarnaq | 1 | MAST program 3716 PRISM X1D FITS; 941 rows, 940 valid | 2023-11-22 archive flux with extraction/background limitations. The FITS target name is SIARNAQ despite the archive catalogue's SIONARQ spelling. |
| Methone | 1 | Author's 256-row Cassini VIMS table | Mean of five 2012-05-20 cubes, about 58° phase. The 2024 release uses a model-normalized brightness coefficient. Three channel gaps follow the author notebook. |
| Pallene | 4 | Two author CSVs, JWST program 1247; 860 + 860 rows | 2023-06-20. Each dither has a full-range view and an explicit 1.3–2.4 µm detail. Noisy long wavelengths are retained in full views and all CSV downloads. |

The 13 inputs contain **10,971 source rows**; repeated detail views reuse their
original inputs. Four FITS products total about 1.2 MB. No large spectral cubes or
new JWST reduction pipeline were needed.

Body-owned `source/OBSERVATIONS.md` files record input hashes, sample counts, axes,
calibration, exclusions and interpretation. Manifests and acquisition recipes retain
exact source identities. The seven program-1247 CSVs and Methone table are pinned to
revision `2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab` of the author's repository;
the corresponding [Zenodo release](https://doi.org/10.5281/zenodo.10552220) declares CC BY 4.0.
Public archive data use is documented by [MAST](https://archive.stsci.edu/publishing/data-use).
Credits include the observing teams, NASA/ESA/CSA JWST, STScI/MAST and Cassini contributors
as appropriate to each input.

### Why the archive FITS files matter

Himalia, Albiorix and Siarnaq's paper source archives contain figures without final
numeric reflectance tables. B4 uses the small public calibrated X1D products on their
own terms. It does not digitize figures or present archive flux as author-reduced
reflectance. Each recipe pins target, observation date, pipeline version 2.0.1 and
CRDS context `jwst_1535.pmap`.

The MAST spectral JSON service returned values inconsistent with the retrieved FITS
files. For example, Albiorix's first flux was approximately 8.0491 µJy in that service
but 19.4662 µJy in the retained FITS. B4 rejects that service as a numerical input.
The FITS reader validates point-source extraction and units and correctly applies
the unsigned offset to the signed DQ column. Any nonzero quality flag removes the
sample from the plot while preserving its row and flags in the CSV.

### Primary references

- [Hedman et al. 2024](https://doi.org/10.1029/2023JE008236) and the [immutable author release](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/tree/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab): numerical flux/error tables, observing times and Methone normalization.
- [Denk's Ymir release](https://tilmanndenk.de/outersaturnianmoons/ymir/#4): light curves, observing sequences, relative magnitudes and the 11.92 ± 0.03 hour folding period.
- [Hedman et al. 2020](https://arxiv.org/html/1912.09192v2): Methone's five VIMS cubes and original mean-spectrum reduction.
- [Sharkey et al.](https://arxiv.org/html/2501.16484v2) and [MAST program 4028](https://doi.org/10.17909/pwcf-c575): Himalia observations and final-reflectance reduction requirements.
- [Belyakov and Brown 2025](https://arxiv.org/html/2503.20046v1) and [MAST program 3716](https://doi.org/10.17909/y22z-yt33): Albiorix/Siarnaq observations, thermal contribution and contaminated-dither rejection.

## Shared implementation

`tools/objects/content/observations.ts` reads bounded, hash-pinned numeric tables.
`jwst-spectrum.ts` reads the selected scalar FITS extraction table; it does not run
a telescope pipeline. Independent source anchors cover all 13 files. Parsing rejects
changed hashes, ambiguous columns/units, invalid errors, unexpected sample counts
and nonfinite valid measurements. Spectral wavelengths increase; rotational phase
may wrap. Explicit axes must include every plotted measurement and its uncertainty.

The generic chart preparer emits 18 PNGs and 18 CSVs. Jy becomes µJy through a single
1,000,000 multiplier applied equally to flux and uncertainty. Signed samples are not
smoothed or fitted. CSVs retain source-row indices, quality flags where present and
whether a sample lies outside the selected plot or an instrument-valid range.

The shared information panel supports body-owned captions, source links, downloads
and explicit chart visibility. B4 opts these nine packages into visible charts;
existing hidden chart panels retain their current behavior. The common chart switcher
retains its image elements and changes only the selected slide. Charts use prepared
PNGs through the existing image/content asset path. No runtime chart geometry or
scene graphics API is added.

PNG **and CSV** outputs are included in the actual runtime asset inventory and source
lineage. Scene transports match the integrated main pins and are restored by the
existing JSON serializer; the moon geometry and surface preparation are unchanged.

## Qualification and workstation limits

Focused numerical, provenance, runtime-manifest and chart-order tests pass: **29/29**.
The reader and changed public chart types pass a focused TypeScript check. The
[closure audit](b4-observations/audit.mjs) checks every new measured input, recipe pin,
generated chart content, PNG/CSV lineage, local runtime asset and existing scene
transport. It does not claim a fresh acquisition of historical surface sources.

Browser evidence exercises all **18 views × 2 viewports/densities = 36 cases** using
actual Astro-rendered route markup/styles and the unchanged production chart/tab
controllers. Desktop is 1440×1000 at DPR 1; narrow layout is 390×844 at DPR 2. Checks
include visible charts, caption/source links, a real CSV download and byte comparison,
image response hashes, chart/tab cycling and retained image/card identity.

**Full application scene conformance remains unproven.** Two full-application starts
were stopped at the 2.5 GiB process-tree threshold. Qualification was adapted to render
one route with Astro, close it, then inspect its real information panel in a separate
small static server and Chrome lifetime. The scene engine is deliberately absent from
these panel captures; the blank background is not a rendered moon. No aggregate build,
full renderer suite, device-wide changes or physical-mobile claim is made.

Replay one body at a time:

```sh
python3 docs/moons/b4-observations/browser-serial.py himalia
```

The runner limits route rendering to 2.5 GiB and each browser case to 1.5 GiB, and stops
if the global free-memory signal falls below 30%. These are polled stop thresholds,
not instantaneous allocation caps. It uses normal Node, `nice -n 10`, no heap override,
no agents and no overlapping builds or browsers. It closes its owned server/browser
before proceeding. Run no other heavy task alongside it.

The 36 new assets (1,796,009 bytes) are published at their content-addressed R2 URLs.
Every URL passed a fresh HEAD request and GET byte/hash check. [Publication evidence](b4-observations/fresh-publication.json) covers these new files; old scene assets were verified locally.

To reproduce the small chart outputs and run their closure check after dependencies
and the selected bodies' existing assets have been restored:

```sh
node docs/moons/b4-observations/prepare-focused.mjs
node docs/moons/b4-observations/audit.mjs
```

[Visual index](b4-observations/VISUAL-REVIEW.md) · [Browser cases](b4-observations/browser-summary.json) · [Closure](b4-observations/closure.json)

Final evidence is recorded in `b4-observations/`: numeric anchors, preparation hashes,
closure, browser summary/captures, resource stops, and publication/fresh-download receipts.
Aggregate readiness remains false until broader qualification is performed elsewhere.

Runtime chart cost: PNGs are 32–67 KB each, 43–183 KB per moon (842 KB across all nine). CSVs total 955 KB and are fetched on download. Each 1080×696 RGBA image represents about 2.9 MiB of decoded pixels; the largest four-chart set is about 11.5 MiB before browser overhead. No plotting computation or chart animation runs in the browser.
