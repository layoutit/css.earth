# Ganymede JIRAM source intake

**Status: needs source clarification; no converter or public chemistry lens qualified.**
The license is explicit and the release is small enough, but the footprint/quality
semantics below prevent a defensible mapped product from this table alone.

## Exact source

- [Figshare v2 dataset](https://doi.org/10.6084/m9.figshare.21710468.v2), Federico Tosi,
  published 9 November 2023. [Live API](https://api.figshare.com/v2/articles/21710468)
  explicitly declares [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Saved as `figshare-api.json` (7,971 bytes).
- [Band_depths_Ganymede_JM0340_4paper.txt](https://ndownloader.figshare.com/files/42131742),
  359,460 bytes, source MD5 `f044dc9dfd0155d775713bb4d57c700a` verified;
  SHA-256 `3e87c589c4396cb0ae3170e075059472168502a5819ac4d5afc71e9a5fcd521c`.
  Text contains Latin-1 `µ`; decode as Latin-1, preserving original bytes.
- [Primary paper](https://doi.org/10.1038/s41550-023-02107-5), Tosi et al.,
  Nature Astronomy 8, 82–93 (2024), published online 30 October 2023.
  The authors' [INAF record](https://openaccess.inaf.it/entities/publication/e300a090-5c24-4825-b586-c8fc6ff1d915)
  exposes an open-access preprint text through its public TEXT bundle:
  [73,877-byte text](https://openaccess.inaf.it/server/api/core/bitstreams/368cbf1a-ba8f-4e81-aa12-edc662419db3/content),
  MD5 `ba6a28110687f93dd45adeca4dd3b499`, SHA-256
  `9da88c1032f22da669b2088051b2771863d4455e3985bc335293b05c6270b96b`.
  Saved as `Tosi-preprint-inaf-extracted.txt` for this local audit only.

No JunoCam TIFF, full JIRAM spectral cube, PDF, renderer asset or build was downloaded/generated.
Direct source/metadata response bodies total about 450 KB, below the 1 MB bound.

## What is actually in the numeric table

All 1,179 data rows have **24 whitespace-separated fields**. The header's numbered
positions skip four numbers and misleadingly end at 28. The semantic sequence is:

| Actual 1-based positions | Meaning |
| --- | --- |
| 1–2 | Original filename; zero-based spatial sample |
| 3–10 | Dimensionless BD1…BD8 at 2.08, 2.54, 2.89, 3.00, 3.48, 3.58, 3.65, 4.25 µm |
| 11–14 | Planetocentric longitude corners 1…4, degrees east |
| 15–18 | Planetocentric latitude corners 1…4, degrees north |
| 19–20 | Declared pixel center longitude/latitude |
| 21–24 | Solar incidence, emission, phase (degrees), local solar time (hours) |

Files ending `165730`, `165800`, `165830`, `165900`, `165930` on 2021 day 158
contain respectively 163, 256, 256, 256 and 248 rows. Sample ranges are 0…162,
0…255, 0…255, 0…255 and 8…255. The five footprints are narrow separate strips:
327.92…329.64°E/27.73…27.80°N; 340.38…343.39°E/28.03…28.35°N;
354.77…358.81°E/28.76…29.51°N; 9.28…15.00°E/22.78…24.49°N;
27.71…40.26°E/14.23…19.36°N. No individual footprint crosses 0°.
Detailed native distributions and bounds are in `table-inspection.json`.

## Scientific and geometry gaps

The preprint Methods (numbered lines 348–358, 428–441 and 492–516) describe
selection below 75° incidence/emission, rejection of permanent instrument
artifacts, straylight correction, and `BD = (RC − RB) / RC` after a linear
continuum fit between band shoulders. The table contains final depths, not the
individual corrected spectra or per-row error bars. Its zero/one endpoints are
not defined as nodata, clipping or detection limits. Do not silently mask zeros
or interpret ones as confirmed complete absorption.

The preprint specifies 159, 241, 241, 241 and 237 spectra for slit averages
(1,119 in total), whereas the release has 1,179 rows. The text also prints a
contradictory total of 1,179. The per-row artifact rejection mask is absent.

Geometry was adjusted using limb fitting and JunoCam/JIRAM feature alignment.
The Methods describe beginning/end exposure corners, motion-smearing trapezoids,
and averaging overlapping contributions. The released table gives only four
corners without their exposure-time interpretation. Independently, **all 1,179
declared centers lie outside their own four-corner polygon** in the stated
corner order. This systematic mismatch requires clarification; neither silently
shifting corners nor replacing footprints with center-based disks is justified.

Concrete requests for source clarification: identify which released corner set
encodes the effective smeared footprint; explain center/corner timing or offset;
provide the exact rejected-sample mask and the meaning of depths exactly 0 or 1.

## Feasible follow-up, once clarified

A partial-footprint **4.25 µm CO₂ absorption** view and a cautiously named
**2.08 µm absorption** view could use the released values. The latter would not
be a unique salt-species or abundance map. Rasterize only verified observed
footprints, preserve holes, average overlap contributions explicitly with a
count/ownership receipt, and use a fixed display range across slits. Do not
connect separate slits, expand them for visibility or invent global coverage.
This would remain entirely offline preparation through the existing surface
contract. Current status remains unqualified.

A quick search found no additional primary dataset-reuse license evidence for
King's Zenodo 6390469 release; no Zenodo retry or license inference from the
paper was made. This intake does not change that source's unresolved status.
