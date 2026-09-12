# Archive image catalogue

[/catalogue?object=m42](http://127.0.0.1:4331/catalogue?object=m42) searches the **110 Messier objects** and browses their MAST, IRSA and ESO image candidates. This is metadata discovery: it neither adds reconstruction subjects nor downloads FITS files, removes stars or compiles clouds. Source, Preview and Data links open separately.

## Start from a clean checkout

Run from the repository root with its supported Node version:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm lab:nebula:catalogue
pnpm lab:nebula:catalogue:enrich --object=m42 --max-images=3
pnpm lab:nebula
```

If the lab is already running, leave it running: collect metadata in another terminal and press **Reload snapshot** in the catalogue. The catalogue link opens separately, preserving the cloud workspace and its camera.

The inventory command resumes saved queries. Optional arguments select an object (`--object=m42`), an archive (`--provider=eso`), failed queries (`--retry-errors`) or a fresh search (`--refresh`). The default first pass retains at most **2,000 records per object/archive**; `--max-records` changes that limit. Raising the limit requires `--refresh` for existing results. Failures remain recorded; pending or failed selected queries produce exit code 2, while the usable snapshot remains available.

The optional enrichment command checks at most three representative records per archive for M42. Run it only after acquisition finishes. It reads published DataLink/observation metadata and file headers to resolve previews, download links and sizes; it never downloads science pixels. Repeat `--object` to select other targets. Provider failures remain visible in the saved receipts and produce exit code 2; they do not discard the inventory. ESO DataLink returned internal errors during the initial check, while MAST and IRSA resolved selected records.

## What the results mean

| Field | Interpretation |
| --- | --- |
| Query complete | The selected bounded metadata query returned all its rows. It does **not** establish exhaustive archive coverage. |
| Partial result | The query exceeded a row/service limit. Its total matching count and size may be unknown. |
| Detail / Context / Unrated | Provisional roles from reported angular resolution relative to catalogue extent. Missing resolution is unrated; none is visual acceptance. |
| FOV / footprint | Reported angular coverage, retained with the image center for later registration. A close-up remains useful even when it covers only part of the object. |
| Advertised size | Metadata estimates, not downloaded bytes. Missing sizes remain unknown. Deduplicated totals are lower bounds when sizes or queries are incomplete. MAST's inconsistent size metadata stays unknown until a per-file header check resolves it. |

The [SIMBAD source record](../models/messier/README.md) explains identities, credits and angular-size qualifications. Catalogue extents are search hints, not nebula crop boundaries; some named nebula entries identify their associated cluster.

ESO and IRSA search image-footprint overlap. MAST currently searches **pointing centers inside a padded sky bounding box**, avoiding its slow spatial predicates. This can miss images whose footprints overlap the object but whose centers lie outside the box, and can include unrelated fields inside it. The archive list is therefore a candidate set requiring inspection.

## Storage and later detail regions

The tracked object catalogue lives in `models/messier/catalogue.json`. Query receipts and image records stay in ignored `.local/nebula-lab/catalogue/messier/`. The browser reads a compact index and hash-checks only the selected object's record files; changed or missing records are reported instead of silently mixed with another snapshot.

Keep high-resolution close-ups alongside wider context images. Their source identity, wavelength, sky footprint and provenance can support future composites and **named, nested zoom regions**, analogous to planetary features. Region authoring and automatic composites are not implemented. Two-dimensional footprints do not measure depth or establish a three-dimensional structure; later registration and model assumptions must remain explicit.
