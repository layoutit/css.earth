# Astronomy data ledger

`ledger.sqlite` owns the audit data and work status. [PROPOSALS.md](PROPOSALS.md) contains the 131 proposed work scopes and their acceptance conditions. IDs are permanent. There is one database, no database service and no ORM.

The ledger covers PSI PDS4, USGS, Photojournal, OPUS, the University of Maryland Small Bodies Node, JAXA DARTS and NASA Solar System Treks. It changes no application or prepared assets. This directory holds the data and this document; the browser, slicer, verifier and collectors are `@cssearth/bake/sources` and its `packages/bake/cli/astronomy-data-*.mts` commands.

## Query the ledger

From the repository root, with the project's supported Node version:

```sh
node packages/bake/cli/astronomy-data-browse.mts
node packages/bake/cli/astronomy-data-slice.mts --source=opus --target=Mimas --format=json
node packages/bake/cli/astronomy-data-slice.mts --proposal=111 --format=tsv
sqlite3 -header -column src/sources/astronomy-data/ledger.sqlite \
  'SELECT id,title,status,next_step,blocker,pr_url FROM proposals ORDER BY priority,CAST(id AS INTEGER);'
```

`astronomy-data-browse.mts` opens the ledger read-only in [Datasette](https://datasette.io/) at `http://127.0.0.1:8001/-/dashboards/overview`; `PORT` changes the port. The first run installs the pinned packages in `datasette/requirements.txt` into the ignored `output/ledger-venv`. Every table and view can be filtered, sorted and exported, and the `global_maps` view shows each map's preview by body, with whether the app uses it. `AUDIT_DB` selects another file for comparisons.

`bodies` and `dataset_bodies` file each record under the bodies it names. A Photojournal record that names a moon and its planet counts for the moon, and the Sun counts only when no other body is tagged. Kind and parent come from `packages/astronomy/data/bodies`.

| Table                 | Owns |
| --------------------- | ---- |
| `datasets`            | One row per dataset: stable source/id, title, target text, instrument, count, decision, reason, source URL, family; native metadata in `details_json` |
| `inventory`           | Listings that repeat datasets: OPUS volumes and geometry, Maryland holdings, DARTS collections and indexes; same columns |
| `bodies`              | Every body a dataset names: cssEarth id when cssEarth catalogues it, name, kind, parent, cssEarth package |
| `dataset_bodies`      | Dataset-to-body links with the name the source used; `role` is `parent` for a Photojournal tag of a tagged body's parent |
| `missions`            | Every spacecraft, telescope or programme an instrument belongs to, with other names (DARTS "KAGUYA" is also "SELENE") |
| `instruments`         | Every instrument, keyed by mission (`rosetta/osinac`, `mro/hirise`): one row even when archives spell it differently |
| `dataset_instruments` | Dataset-to-instrument links with the name the source used; USGS and PSI PDS4 state no instrument |
| `ledger_log`          | Each cleanup run: date, operation and the rules it applied |
| `proposals`           | Stable ID, title, priority, status, next step, blocker, implementation PR URL and update date |
| `dataset_proposals`   | Links between datasets and proposed work (`inventory_proposals` for inventory rows) |
| `evidence`            | Collection receipts, repository comparison, historical review and original OPUS labels as bytes |

Proposal status is one of `proposed`, `qualifying`, `blocked`, `in-progress`, `shipped`, `rejected` or `deferred`. A source row's `decision` describes that source; it is separate from a proposal's implementation status. A blank PR link means no implementation PR is recorded.

## Maintain it

Edit a proposal's status and next action in the database, and its scope in PROPOSALS.md. Preserve IDs and cite the implementation PR when work ships. Keep negative source decisions and their reopen conditions. For SQLite edits enable foreign keys and use a transaction:

```sql
PRAGMA foreign_keys=ON;
BEGIN;
-- UPDATE proposals SET status=..., next_step=..., blocker=...,
--   pr_url=..., updated_at=... WHERE id=...;
COMMIT;
```

Git stores the database as a binary file. Review changes through a text export and run the verifier:

```sh
sqlite3 src/sources/astronomy-data/ledger.sqlite .dump > /tmp/astronomy-data.sql
node packages/bake/cli/astronomy-data-verify.mts
```

To compare revisions, extract the old database with `git show` to `/tmp`, export both with `.dump` and diff them. Do not commit a second JSON or SQL copy. Resolve concurrent edits by applying the intended row changes to one database, then run the verifier. The verifier checks integrity, foreign keys, snapshot coverage, evidence, OPUS partition reconciliation, proposal joins, filters and exports. It establishes ledger consistency, not scientific acceptance.

Public collectors write to ignored scratch output and never replace the ledger:

```sh
OPUS_WORK_DIR=output/opus-refresh node packages/bake/cli/astronomy-data-collect-opus.mts
ARCHIVE_WORK_DIR=output/archive-refresh node packages/bake/cli/astronomy-data-collect-archives.mts umd
ARCHIVE_WORK_DIR=output/archive-refresh node packages/bake/cli/astronomy-data-collect-archives.mts darts
PHOTOJOURNAL_WORK_DIR=output/photojournal-refresh node packages/bake/cli/astronomy-data-collect-photojournal.mts
USGS_WORK_DIR=output/usgs-files node packages/bake/cli/astronomy-data-collect-usgs-files.mts
TARGETS_WORK_DIR=output/ledger-targets node packages/bake/cli/astronomy-data-collect-targets.mts
node packages/bake/cli/astronomy-data-apply-ledger-fixes.mts --dry-run   # then without --dry-run
node packages/bake/cli/astronomy-data-apply-structure.mts --dry-run     # rebuilds bodies and dataset_bodies
node packages/bake/cli/astronomy-data-collect-trek.mts --dry-run        # NASA Trek map layers; TREK_CACHE keeps pages
node packages/bake/cli/astronomy-data-build-instruments.mts --dry-run   # rebuilds missions and instruments
node packages/bake/cli/astronomy-data-mark-map-usage.mts --dry-run      # marks maps a body's manifest downloads
```

Photojournal has no map category, so an entry is chosen by a title naming a map, mosaic, globe, hemisphere, projection or atlas, or a caption stating a map projection or global map. USGS files are read from each product's Astropedia page. Rows collected without a target get the one their archive label states; rows whose source states none keep an empty target and a `targetNote`.

Use a new output directory for fresh retrievals. Review additions, removals, versions and changed metadata before a database transaction. Preserve decisions, proposal joins and work status; do not replace tables with a new scrape. Family rules in `collect/archive-review.ts` suggest review scopes, not scientific acceptance. Update the verifier's snapshot counts when accepting a new collection. Scratch HTML is never committed.

## Coverage and limits

The inventory populations are kept separate. Do not add them into a unique-dataset or observation count: an entry may be a version, mirror, bundle, collection, channel, session or container.

- OPUS's target and volume partitions each sum to 1,627,081 records across 40 instruments. Geometry matches do not prove detection or useful coverage. Native arrays were not decoded.
- Maryland collection follows the mission, target and datatype indexes and inventories the holdings root. It does not claim a recursive audit of every science file.
- DARTS collection reads every JSON-LD file in the published dataset and collection metadata directories. SLIM has mission metadata but no individual product.

## Opportunities and existing work

The added Maryland/DARTS scopes include [lunar magnetic maps](PROPOSALS.md#p111), [elemental measurements](PROPOSALS.md#p112), [radar profiles](PROPOSALS.md#p113), [Apollo seismology](PROPOSALS.md#p114), [Venus winds](PROPOSALS.md#p115), [Rosetta thermal observations](PROPOSALS.md#p117), [gas and dust](PROPOSALS.md#p118), [Lucy encounters](PROPOSALS.md#p129), [DART measurements](PROPOSALS.md#p130) and [EPOCh transit curves](PROPOSALS.md#p131). These are work scopes, not 131 ready datasets. Nix/Hydra registration, Nix color resolution and earlier photometric blockers remain unresolved unless new evidence meets the owning investigation's condition.
