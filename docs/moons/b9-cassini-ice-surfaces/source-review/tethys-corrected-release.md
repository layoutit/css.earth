# Tethys: Filacchione 2022 corrected-map release review

Reviewed 2026-09-09 on `feat/moons-cassini-ice-surfaces`. This is a bounded source search, not surface preparation or qualification. Body geometry, scene topology, renderer and shared shell are outside this work.

**Disposition: numerical correction coefficients found; corrected surface arrays remain unresolved.** The publisher hosts real ASCII supplements, but this search did not establish a downloadable albedo/band-depth map artifact. Do not describe the maps as nonexistent or recreate their numerical values from published color figures.

## Exact artifacts recovered

| Publisher artifact | Verified contents | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| [mmc3.txt](https://ars.els-cdn.com/content/image/1-s2.0-S0019103521004504-mmc3.txt) | Table 4: Tethys photometric coefficients | 6,886 | `17196f487b89a3cd11225a71c6c04c7ebf90074fa298c2c9ef981b62f6425a2f` |
| [mmc1.txt](https://ars.els-cdn.com/content/image/1-s2.0-S0019103521004504-mmc1.txt) | Table 2: Mimas coefficients; confirms supplement naming sequence | 6,858 | `8c46a5596996daf0188f18bba26ff4f8885e667bbc1ce4cb59e19e55dd204c59` |

Original bytes are retained in `tethys-corrected/`. Each table has 65 ascending wavelength rows from 350 to 5040 nm, with eight fields: wavelength, a0/error, a1/error, a2/error and fit chi-square. They contain no geographic coordinates, pixel values, masks or footprint metadata. Tethys at 549 nm gives a0=0.736281, a1=-0.00310144 and a2=-0.0000141087. Headers retain draft placeholders (`DOI: XX`, volume/pages XX); the exact article PII in the publisher URL and table/body identity bind the files, rather than those placeholders.

Requests with `User-Agent: cssEarth-source-review/1.0` returned HTTP 200. The default Python user agent returned 403 for the same TXT URL. This difference is recorded as transport behavior, not an access or reuse entitlement.

## Why the corrected maps remain a useful candidate

The [primary paper, sections 3–7](https://arxiv.org/html/2111.15541v1), identifies the maps as digital supplementary material. Its RC17-calibrated spectra receive a wavelength-dependent photometric correction before median aggregation on 0.5° geographic bins. That sampling is not a claim that every source observation resolves 4.7 km. Observation filtering leaves polar gaps, and ellipsoidal geometry can leave local topographic photometric residuals. The paper explicitly excludes Iapetus from this average correction because of its strong bright/dark dichotomy.

These coefficients are not evidence that the released maps have been reproduced. Applying them to another calibration version, including RC19, requires a justified compatibility check; they must not be transferred to Iapetus or Phoebe. Actual map bytes and labels would still need to establish axes, registration, missing-data encoding, wavelengths and the meaning of each band-depth field before use.

## Search evidence and limits

- The [INAF ORIGINAL bundle listing](https://openaccess.inaf.it/server/api/core/bundles/7c1a6165-9012-49ec-83fa-9d3663492bff/bitstreams) has exactly two items: a 3,819,373-byte open preprint PDF and a 2,110,696-byte restricted publisher PDF. Neither is a numerical map; neither was downloaded here. The complete one-page listing is pinned as `inaf-original-bitstreams.json`.
- [Crossref metadata](https://api.crossref.org/works/10.1016/j.icarus.2021.114803) has an empty relation object and article text-mining links. [DataCite's related-identifier query](https://api.datacite.org/dois?query=relatedIdentifiers.relatedIdentifier:10.1016%2Fj.icarus.2021.114803&page%5Bsize%5D=20) returns only the arXiv paper DOI. These are discovery limits, not proof of missing supplements.
- The [Elsevier attachment-metadata endpoint](https://api.elsevier.com/content/object/eid/1-s2.0-S0019103521004504) returned only article coredata. Its omission of attachment records is inconclusive: the two TXT supplements above nevertheless exist.
- ScienceDirect article HTML returned 403. A bounded set of adjacent-name HEAD probes (`mmc6` through `mmc10`, TXT/ZIP, plus `mmc6` DAT/CSV/PDF) returned 404. These were candidate URL probes, not publisher-advertised filenames or an exhaustive inventory. Their exact URLs/statuses are retained in the probe receipts.
- [Coauthor Roger Clark's publication list](https://www.clarkvision.com/rnc/publist.html) links this work to its DOI without a separate data release. The [DLR record](https://elib.dlr.de/147913/) reports no hosted full text. Searches of author releases and indexed Mendeley/Zenodo/Figshare pages produced no exact numerical-map artifact for this paper.

No explicit reusable dataset license was established for the coefficients or unresolved maps. The TXT files have no license statement; Crossref's article-version/TDM licenses and INAF's `open.access` status do not establish a map-specific CC license. Treat reuse qualification as unresolved, separately from public downloadability.

## B9 decision

Carry the corrected map release as **unresolved, not selected**. The next useful evidence would be a publisher attachment manifest or an author-supplied public data URL with map documentation and reuse terms. No author contact was sent. B9 can continue qualifying its independently selected native observations; those must retain their own calibration, photometry and partial-coverage claims rather than inherit the paper's corrected-map claim.

All retained metadata and two small coefficient tables total 70,671 bytes before the manifest. See `tethys-corrected/evidence-manifest.json` for individual SHA-256 pins. No raster/cube, browser, build or preparation work ran in this review.
