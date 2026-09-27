# Astronomy data ledger

`ledger.sqlite` owns the audit data and work status. [PROPOSALS.md](PROPOSALS.md)
contains the 131 proposed work scopes and their acceptance conditions. IDs are
permanent. There is one database, no database service and no ORM.

The ledger covers PSI PDS4, USGS, Photojournal, OPUS, the University of Maryland
Small Bodies Node, and JAXA DARTS. It changes no application or prepared assets.

## Query the ledger

From the repository root, with the project's supported Node version:

```sh
node tools/sources/astronomy-data/serve.mts
node tools/sources/astronomy-data/slice.mts --source=opus --target=Mimas --format=json
node tools/sources/astronomy-data/slice.mts --proposal=111 --format=tsv
sqlite3 -header -column tools/sources/astronomy-data/ledger.sqlite \
  'SELECT id,title,status,next_step,blocker,pr_url FROM proposals ORDER BY priority,CAST(id AS INTEGER);'
```

The viewer runs at `http://127.0.0.1:4319`; `PORT` changes the port. Filters cover
source, target, instrument, decision, proposal and text. Exports contain every
matching row, independently of pagination. An empty source filter searches all
sources. Proposal pages read current work status from SQLite on each request;
restart the viewer after changing dataset rows. `AUDIT_DB` selects another file
for comparisons. Open `ledger.sqlite` in a SQLite browser for direct editing.

| Table               | Owns                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `datasets`          | Stable source/id, title, target, instrument, count, decision, reason, source URL; native metadata and retrieval records in `details_json` |
| `proposals`         | Stable ID, title, priority, status, next step, blocker, implementation PR URL and update date                                             |
| `dataset_proposals` | Many-to-many links between records and proposed work                                                                                      |
| `evidence`          | Collection receipts, repository comparison, historical review, and 23 original OPUS labels as bytes                                       |

Use `proposed`, `qualifying`, `blocked`, `in-progress`, `shipped`, `rejected` or
`deferred` for proposal status. A source row's `decision` describes that source;
it is separate from the implementation status of a proposal. Blank PR links mean
no implementation PR is recorded. The audit PR itself is not an implementation.

## Maintain it

Edit a proposal's status and next action in the database, and edit its scope in
PROPOSALS.md. Preserve IDs and cite the implementation PR when work ships. Keep
negative source decisions and their reopen conditions. For SQLite edits enable
foreign keys and use a transaction:

```sql
PRAGMA foreign_keys=ON;
BEGIN;
-- UPDATE proposals SET status=..., next_step=..., blocker=...,
--   pr_url=..., updated_at=... WHERE id=...;
COMMIT;
```

Git stores the database as a binary file. Review changes through a text export:

```sh
sqlite3 tools/sources/astronomy-data/ledger.sqlite .dump > /tmp/astronomy-data.sql
node tools/sources/astronomy-data/verify.mts
```

For a revision comparison, extract the old database with `git show` to `/tmp`,
export both with `.dump`, and diff the exports. Do not commit a second JSON/SQL
copy. Resolve concurrent edits by applying the intended row changes to one
chosen database, then run the verifier; do not choose an entire binary version
without accounting for the other edits.

Public collectors write to ignored scratch output and never replace the ledger:

```sh
OPUS_WORK_DIR=output/opus-refresh node tools/sources/astronomy-data/collect-opus.mts
ARCHIVE_WORK_DIR=output/archive-refresh node tools/sources/astronomy-data/collect-archives.mts umd
ARCHIVE_WORK_DIR=output/archive-refresh node tools/sources/astronomy-data/collect-archives.mts darts
PHOTOJOURNAL_WORK_DIR=output/photojournal-refresh node tools/sources/astronomy-data/collect-photojournal.mts
USGS_WORK_DIR=output/usgs-files node tools/sources/astronomy-data/collect-usgs-files.mts
TARGETS_WORK_DIR=output/ledger-targets node tools/sources/astronomy-data/collect-targets.mts
node tools/sources/astronomy-data/apply-ledger-fixes.mts --dry-run   # then without --dry-run
```

- **Photojournal.** The site has no map category, so an entry is chosen by what it says about itself: a title naming a
  map, mosaic, globe, hemisphere, projection or atlas (plurals included), or a caption stating a map projection or a
  global map or mosaic. Each row keeps its downloadable files with their pixel sizes and the caption phrases that chose
  it. New rows get a decision and a reason built from their own evidence (`collect/photojournal-review.mts`).
- **USGS.** Each product's files are read from its own Astropedia page. A row's reason says what that page offers.
- **Targets.** Rows collected without a target get the one their archive label states: PDS4 `<Target_Identification>`,
  or PDS3 `TARGET_NAME` in `catalog/dataset.cat`, kept as stated (for example `CHECKOUT`). Rows whose source states
  none keep an empty target and a `targetNote` saying so.

Use a new output directory for fresh retrievals. Review additions, removals,
versions and changed source metadata before a database transaction. Preserve
our decisions, proposal joins and work status; do not replace tables with a new
scrape. Family rules in `collect/archive-review.mts` suggest review scopes, not
scientific acceptance. Update the retained coverage receipt and verifier's
snapshot counts when accepting a new collection. Scratch HTML is never committed.

## Coverage and limits

The 27 September 2026 snapshot keeps different inventory populations separate. Rows without a target carry a `targetNote` saying why:

| Source population               |  Rows | What was checked                                                                                                                     |
| ------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------ |
| OPUS instrument/target slices   |   549 | Exact queries, metadata samples and explicit screening decisions                                                                     |
| OPUS instrument/volume entries  |   990 | Catalogue inventory; 985 distinct volumes/bundles                                                                                    |
| OPUS geometry-index memberships |   221 | Overlapping geometry entries, not detections                                                                                         |
| Photojournal                    | 2,593 | 717 earlier individual reviews retained; 1,876 added by title or caption, each with its own evidence; files and pixel sizes recorded |
| PSI PDS4                        |   189 | Earlier bundle review and proposal links retained; 186 targets read from the bundle labels                                           |
| USGS                            | 1,643 | Earlier catalogue review retained; every product page's files recorded; one missed ISIS cube reopened                                |
| Maryland indexed descriptions   | 3,880 | Every linked description requested; 3,878 parsed, two HTTP 404s; 466 targets read from PDS3/PDS4 labels                              |
| Maryland root holdings          | 5,110 | Directory inventory; 1,239 have no description in the audited indexes                                                                |
| DARTS dataset directory         |   360 | Every published science metadata entry parsed, including one typed Observation                                                       |
| DARTS collection directory      |    46 | Mission/collection metadata, separate from dataset entries                                                                           |
| DARTS catalogue documents       |     2 | DataCatalog and ItemList containers                                                                                                  |

Do not add these into a unique-dataset or observation count. An entry may be a
version, mirror, bundle, collection, channel, session or container. The database
retains each provider's identifiers and links so a work slice can reconcile them.

OPUS's target and volume partitions each sum to 1,627,081 records across 40
instruments. VIMS VIS/IR entries can share the same QUBE. Geometry matches do
not prove detection or useful coverage. There were 23 focused native-label
inspections; this is not manual review of every OPUS observation. Native image,
cube and time-series arrays were not decoded in that pass.

Maryland collection starts with the mission, target and datatype indexes and
follows their internal catalogue pages. It also inventories the holdings root.
It does not claim a recursive audit of every science file. The failed description
URLs remain searchable, as do unindexed holdings. Abstracts, status, citations,
identifiers, source links and retrieval times are retained as data. Family rules
screen each record; native-product qualification remains proposed work.

DARTS collection reads every JSON-LD file in the published dataset and collection
metadata directories. Five products are marked in preparation, eight as old or
obsolete, and four provisional. SLIM has mission metadata but no individual
product in this dataset catalogue. That is a release lead, not calibrated imagery.

## Opportunities and existing work

The added Maryland/DARTS scopes include [lunar magnetic maps](PROPOSALS.md#p111),
[elemental measurements](PROPOSALS.md#p112), [radar profiles](PROPOSALS.md#p113),
[Apollo seismology](PROPOSALS.md#p114), [Venus winds](PROPOSALS.md#p115),
[Rosetta thermal observations](PROPOSALS.md#p117), [gas and dust](PROPOSALS.md#p118),
[Lucy encounters](PROPOSALS.md#p129), [DART measurements](PROPOSALS.md#p130), and
[EPOCh transit curves](PROPOSALS.md#p131). Related sources extend existing proposals
through database joins. These are work scopes, not 131 ready datasets.

The Maryland/DARTS comparison also read the Moon, Venus, Sun and 67P READMEs at
[`93517193d218`](https://github.com/layoutit/css.earth/tree/93517193d21885d253c0590cf37b21c94330b4af).
67P already uses VIRTIS derived maps, Venus already uses an Akatsuki UVI exposure,
and the Sun has prepared magnetic and solar-band maps. Those archives alone are
not new opportunities. The new scopes require additional measurements with
explicit dates, calibration and coverage. Mars stays deferred.

The OPUS repository baseline is
[`f1493dccc15d`](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3).
The earlier 95 proposals retain their comparison with
[`60ef02395df5`](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570).
Their older Enceladus “owned elsewhere” note is historical: its infrared mosaic
subsequently merged. The preserved repository comparison records that change.
Nix/Hydra registration, Nix color resolution and earlier photometric blockers
remain unresolved unless new evidence meets the owning investigation's condition.

## Evidence and validation

The original audit was consolidated without dropping its 4,309 exported records
or proposal joins. Native-label bytes retain their original hashes and URLs.
The database's size comes from retained per-record metadata and scientific labels;
it contains no science image payloads or downloaded webpages. Historical reviews
and collection receipts remain queryable in `evidence` instead of separate files.

`verify.mts` checks SQLite integrity and foreign keys, snapshot coverage, all
retained evidence hashes, OPUS partition reconciliation, label byte counts,
proposal writeups/joins, filters and exports. These checks establish ledger
consistency, not scientific acceptance of the proposed datasets.

The [browser capture](evidence/ledger-slice.jpg) records the SQLite migration viewer,
before its heading was renamed to Astronomy data ledger.
The `validation:sqlite-migration` evidence entry records the compared revision,
migration extent, commands and browser cases. Browser version and DPR were not
recorded; this is no claim of pixel parity.
It is a UI check; scientific decoding and rendered-body qualification belong to
subsequent implementation PRs.
