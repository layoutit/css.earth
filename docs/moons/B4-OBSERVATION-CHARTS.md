# B4 — Measured moon observations

Owner: Moons · Started 2026-09-09 · Branch `feat/moons-observation-charts`

Base: `c016fd31d711e204bab4521c82c7e2e192f6e0df`, merged [B3 PR #67](https://github.com/layoutit/cssEarth/pull/67).
The agreed cohort remains **nine existing moons**. No B3 research carry-forward is silently added or substituted.

## Source review

All nine dispositions below revisit the completed [body review](review-2026-09-08/BODY-REVIEWS.md).
An observation's whole-disk spectrum is a chart, not a mineral map on the rendered moon.

| Moon | Selected source or extraction route | Current interpretation and limits |
| --- | --- | --- |
| Epimetheus | Two immutable author CSVs, JWST program 1247 | 730 + 700 flux/error rows. Jy and µm verified against notebook; 2022-11-08. Ring stray light limits the short-wavelength coverage. |
| Telesto | Two immutable author CSVs, JWST program 1247 | 860 + 860 flux/error rows; 2022-11-10. Background artifacts and all negative samples remain; statistical errors do not cover all systematics. |
| Pandora | One immutable author CSV, JWST program 1247 | 700 flux/error rows. Extracted from the Epimetheus pointing on 2022-11-08; do not assign the separate Pandora pointing's time to these bytes. |
| Pallene | Two immutable author CSVs, JWST program 1247 | 860 + 860 flux/error rows; 2023-06-20. Very noisy long-wavelength samples require an honestly labeled detailed view as well as the full released range. |
| Ymir | Denk's four Cassini ISS light curves | 20, 94, 84 and 299 samples. Relative magnitude, author-folded rotational phase, distinct dates and solar phase angles. No per-point errors released; do not invent error bars or absolute magnitudes. |
| Methone | Author's 256-row Cassini VIMS table | Wavelength, brightness coefficient and error columns verified against notebook cells 13/17. Five 2012-05-20 cubes, about 58° solar phase. Author-defined channel gaps and model-dependent normalization stay explicit. |
| Himalia | JWST program 4028; bounded archive product review | Published final reflectance requires custom extraction, a solar standard and thermal subtraction. The arXiv source contains vector figure PDFs but no numerical tables. Investigate small calibrated archive tables before considering any reprocessing. |
| Albiorix | JWST program 3716; bounded archive product review | Paper's source archive has raster figures, no reduced numeric tables. Published relative reflectance drops a contaminated dither. An archive flux product must be assessed on its own calibration and quality flags. |
| Siarnaq | JWST program 3716; bounded archive product review | Same reduced-data gap as Albiorix. Observation 2023-11-22; do not turn a screenshot or fitted absorption model into released measurement samples. |

The seven program-1247 CSVs and Methone table are pinned to author revision
`2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab`.
The corresponding [Zenodo release](https://doi.org/10.5281/zenodo.10552220) declares CC BY 4.0.
Raw download hashes and independently read flux anchors are in [b4-observations](b4-observations/).

Primary references:

- [Hedman et al. 2024](https://doi.org/10.1029/2023JE008236) and [author repository](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/tree/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab): released flux tables, error definitions, observing windows and Methone coefficient normalization.
- [Denk's Ymir observation release](https://tilmanndenk.de/outersaturnianmoons/ymir/#4): light curves, dates, phase angles and relative-magnitude interpretation.
- [Hedman et al. 2020](https://arxiv.org/html/1912.09192v2): five Methone VIMS cube identities and the original mean-spectrum reduction.
- [Sharkey et al.](https://arxiv.org/html/2501.16484v2) and [MAST program-4028 dataset](https://doi.org/10.17909/pwcf-c575): Himalia reduction and acquisition provenance.
- [Belyakov and Brown 2025](https://arxiv.org/html/2503.20046v1) and [MAST program-3716 dataset](https://doi.org/10.17909/y22z-yt33): Albiorix and Siarnaq observations and reduction limitations.

## Implementation

Extend the existing object-content chart preparer. Strict table parsing checks source hashes,
columns, units, row counts and nonfinite values; spectral wavelengths must increase, while
rotational phase may wrap between exposures. Signed samples and uncertainties survive unit
conversion. A plot cannot silently clip its measurements or error bars. Instrument gaps keep
their original rows in the downloadable table.

The shared panel gains visible, body-owned captions and measurement downloads. Prepared PNGs
and CSVs are consumed through the existing chart switcher. Scene geometry and moon surface
assets are not rebuilt for these charts.

## Qualification in progress

Seven flux charts have been prepared serially from their pinned tables. The first run peaked
at 131,456 KiB process RSS (about 128 MiB). Ymir and Methone recipes are authored. Focused
parser tests are in development. No body is declared end-to-end qualified yet.

Outstanding: complete the three archive dispositions; finish visual review and readable
details for low-signal spectra; verify all source/asset references; integrate prepared content;
run bounded, serial package and browser checks. No new PR has been opened.

Workstation rule: one small job at a time. No broad application build, full renderer test run,
parallel agents or overlapping browsers. Browser evidence must isolate one body/view/DPR and
close its server/browser before the next. Aggregate and physical-mobile qualification remain
unproven unless separately completed in a suitable environment.
