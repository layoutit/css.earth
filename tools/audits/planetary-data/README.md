# Planetary data opportunities

The audit joins PSI's PDS4 tree, the USGS catalogue, 717 individually reviewed
Photojournal entries, and OPUS. The [110 proposals](proposals/README.md) include
15 OPUS additions and OPUS extensions to 27 earlier proposals. They are work
scopes with acceptance conditions, not 110 ready datasets.

## OPUS findings

The OPUS snapshot was collected on 27 September 2026 and compared with cssEarth
at [`f1493dccc15d`](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3).
Every published instrument/volume entry and every intended-target/instrument
slice has an exact query and metadata sample. [The review table](opus-review.md)
gives the disposition and proposal links for each target slice.

| Check | Result |
| --- | ---: |
| OPUS record count | 1,627,081 |
| Instruments | 40 |
| Distinct intended-target values, including calibration/unknown tags | 208 |
| Instrument/target slices | 549 |
| Instrument/volume entries | 990 |
| Distinct volumes/bundles | 985 |
| Sum of all target slices | 1,627,081 |
| Sum of all instrument/volume entries | 1,627,081 |
| Focused native product-label inspections | 23 |

The two independent catalogue partitions reconcile exactly. They establish
inventory coverage. They **do not** establish that every individual observation
has been scientifically reviewed. An OPUS record can be a detector channel,
derived cube or composite; records are not necessarily independent exposures
or files. In particular, the VIMS VIS and IR records can name the same QUBE.

The clearest additional work is:

- [Saturn ring profiles](proposals/96-saturn-ring-opacity.md),
  [Uranus ring profiles](proposals/97-uranus-ring-opacity.md) and
  [Neptune ring measurements](proposals/98-neptune-ring-measurements.md).
  Native tables distinguish optical depth, opacity, signal and uncertainty.
- [Additional Saturn-moon infrared data](proposals/99-saturn-moon-vims.md).
  Mimas and Hyperion are the main missing cases; Dione and several other moons
  already have infrared views.
- [Ultraviolet Saturn-moon spectra](proposals/100-saturn-moon-ultraviolet.md)
  and [Jupiter-moon spectra](proposals/101-galilean-ultraviolet.md), with
  surface reflection kept separate from atmospheric emission.
- [Observed giant-planet spectra](proposals/108-giant-planet-measured-spectra.md)
  and [Uranus atmospheric occultation curves](proposals/110-uranus-atmospheric-occultations.md)
  for the existing prepared charts.

Labels changed several initial interpretations. The sharp Dione VIMS product
is a 64×352×1 cube: only one spatial line. The first Neptune PPS segment spans
42,500–49,999 km and does not reach the Adams arcs. MVIC SCI labels describe
calibrated DN that still require physical-unit conversion. The FOS Uranus
atmosphere product is normalized stellar flux versus time, not a temperature
profile. These limits remain in the proposals and the retained native labels.

## Existing work and blockers

The [repository comparison](evidence/repository-baseline.json) records selected
dataset controls and investigation decisions at the OPUS baseline. Enceladus's
infrared mosaic has merged since the earlier audit. Dione, Rhea, Tethys,
Iapetus and Phoebe already have VIMS views. All five major Uranian moons have
Voyager color. Proteus C1138920 is already selected. Arrokoth already uses
native LORRI and a derived MVIC cube.

The older [Photojournal review](photojournal-audit.md) and 95 proposals keep
their original revision, `60ef02395df5c466027b8a70214b09cbc1afc570`; their
Enceladus “owned elsewhere” decision is historical. The OPUS extension records
the newer state explicitly. The original USGS screen used an older baseline;
the prior ledger already reconciles the shipped Moon, Venus, Mercury, Bennu
and Eros work. This audit does not claim a fresh native-data audit of those sources.

Nix/Hydra registration, Nix color resolution and several moon photometric
limits remain blockers. An archive listing does not satisfy an investigation's
reopen condition. Three new proposal documents preserve those conditions
instead of treating the same available files as new qualified surfaces.

## Method and evidence

The [OPUS API guide](https://opus.pds-rings.seti.org/opus/__help/apiguide.html)
defines the metadata queries. The collection reads all instrument and target
facets, then the [published volume inventory](https://opus.pds-rings.seti.org/opus/__help/bundles.html).
Each volume is queried with an exact `bundleid` match and its instrument.
Two earliest catalogue samples are retained per target slice, and one per
volume. These samples establish locators and product types; they are not a
statistical sample of image quality. Selected candidates get a separate
geometry-aware or observing-mode query, full metadata, file links and native
label inspection.

The intended-target table partitions all records. The separate surface-geometry
facets overlap and can include unresolved bodies or predicted positions in a
field of view. Geometry-index membership is neither a detection nor a useful
surface footprint. Surface geometry is queried for the six instruments
advertised by OPUS: Cassini ISS/UVIS/VIMS, Galileo SSI, Voyager ISS and New
Horizons LORRI. Its absence for another instrument does not establish that
native geometry or SPICE support is absent.

The screening rules in `collect/review.mts` assign a disclosed disposition to
each instrument/target slice. The [TSV](evidence/opus-review.tsv) preserves
every result. This is catalogue screening, with 23 focused scientific-label
checks, **not a claim of manual review of 1.6 million observations**. Raw image,
cube and time-series arrays were not decoded or qualified in this OPUS pass.

- [OPUS evidence](evidence/opus.json): exact queries and retrieval times,
  counts, all slices, volume entries, metadata samples, focused products and
  native-label receipts.
- [Prior audits](evidence/previous-audits.json): all 717 Photojournal rows,
  189 PSI PDS4 bundle IDs, 1,643 USGS records and 95 proposal joins.
- `evidence/labels/`: the 23 scientific product labels, retaining the definitions
  that limit the proposed claims. Their original URLs and byte identities are
  in the OPUS evidence. No crawled website snapshots or science image payloads
  are committed.

The source target tags, missing values and aliases remain visible. `2014 MU69`
is identified as Arrokoth without erasing the original tag. A target tagged
“Star,” “Sun,” “Sky” or “Unknown” is not silently discarded: it may need an
occultation, calibration or field-geometry review. Mars remains individually
recorded and deferred under the requested scope.

## Slice the audit

From the repository root:

```sh
node tools/audits/planetary-data/serve.mts
node tools/audits/planetary-data/slice.mts --source=opus --target=Mimas --format=json
node tools/audits/planetary-data/slice.mts --source=opus --proposal=97 --format=tsv
node tools/audits/planetary-data/slice.mts --source=photojournal --target=europa --format=json
```

The local viewer uses port 4319 by default; set `PORT` if needed. It filters by
source, target, instrument, decision, proposal and text. URLs preserve filters.
JSON and copyable TSV contain every matching row, independently of pagination.
`opus-volumes` and `opus-geometry` are separate sources so their overlapping
counts cannot be mistaken for extra observations. Counts from different audit
sources must not be added into one “dataset” total.

The [inspected Mimas filter](evidence/mimas-slice.jpg) shows six instrument
slices. They contain 9,987 OPUS records in this snapshot.

## Reproduce and maintain

```sh
node tools/audits/planetary-data/verify.mts
node tools/audits/planetary-data/build.mts
OPUS_WORK_DIR=output/opus-refresh node tools/audits/planetary-data/collect-opus.mts
```

The first command checks retained evidence and joins offline. The second
regenerates the OPUS review and proposal extensions from retained evidence and
the authored `opus-proposals.json`. The last command makes a fresh public-API
collection in ignored output; requests use a resumable cache and at most four
concurrent workers. Use a new output directory for a new snapshot. Review
changes, new target values and scientific limits before replacing evidence.
Collection never overwrites the committed audit snapshot automatically.

Keep the [proposal scope](proposals/contract.md): shared renderer, camera,
shell and existing moon geometry; offline preparation; existing controls and
source labels. Implementation and pixel qualification belong to the subsequent
body PRs. This audit changes no application or prepared assets.
