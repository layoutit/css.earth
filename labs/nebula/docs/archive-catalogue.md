# Archive image catalogue

[/catalogue?object=m42](http://127.0.0.1:4331/catalogue?object=m42) browses the **110 Messier objects** with small sky-survey thumbnails, apparent sizes and MAST, IRSA and ESO image candidates. **Largest on sky first** is the default order; Messier number and name are also available. Sizes use arcseconds (60″ = 1′); unknown sizes sort last. Search and object-type filters narrow the list, and arrow keys move between objects.

This is discovery: browsing neither adds reconstruction subjects nor downloads FITS files, removes stars or compiles clouds. The recognition thumbnails are small DSS2 colour survey cutouts, separate from the archive products below. Published product previews display inline when available; missing previews are not fabricated from a different observation.

**Source** opens a published record, or loads a directly linked FITS file in [IRSA Viewer](https://irsa.ipac.caltech.edu/onlinehelp/irsaviewer/irsaviewer/visualization.html). **View image** opens a published preview or the exact FITS in that viewer. **Download FITS** is the separate, explicit file action. The viewer fetches the public data to display its pixels; it does not automatically save a FITS file to the user's Downloads folder. Unresolved DataLink records open as a browser table, not as a purported image. These links use [Firefly's image URL API](https://github.com/Caltech-IPAC/firefly/blob/dev/src/firefly/js/api/webApiCommands/ImageCommands.js); external archive availability and viewer file-size limits still apply.

**Best available first** ranks image candidates across all selected archives together. It favors reported detail within the actual image field, wider apparent-object coverage and combined products, with a small preference for published previews. Support maps and clearly disjoint fields go last. Missing detail remains unreported; a tiny sharp crop cannot inherit the resolution-element count of the entire nebula. **Finest resolution** and **Widest field** remain alternative orders. Ranking uses the sourced display extent, without rewriting archive queries. These are metadata clues, not measured noise, saturation, visual quality, registration or exact coverage; inspect the image before processing it.

Browser verification exercised a real M42 Spitzer **Source** click until the FITS pixels appeared, and an IRSA **Source** click until its DataLink records appeared. Both produced zero browser downloads. This verifies the viewer handoff for those public products, not every archive's availability. The optional `browser-catalogue-fits` lab command repeats that live check against the local catalogue; the ordinary catalogue browser check remains read-only and never opens science files.

The selected object also shows sourced constellation and visual magnitude where reported. Approximate magnitudes retain their source qualification. Nebula classifications refer to the cloud when its supplementary source identifies it, while the underlying cluster-oriented SIMBAD record remains preserved.

## Start from a clean checkout

Run from the repository root with its supported Node version:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/src/run.ts acquire-messier-presentation
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

The [source record](../models/messier/README.md) explains identities, credits and angular-size qualifications. Source-backed supplementary nebula extents take precedence for display and sorting when the original SIMBAD entry describes the associated cluster. Every supplementary extent links to its source. These apparent sizes are reference estimates, not nebula crop boundaries or guaranteed coverage at every wavelength. A thumbnail's authored sky field never substitutes for an object-size measurement.

ESO and IRSA search image-footprint overlap. MAST currently searches **pointing centers inside a padded sky bounding box**, avoiding its slow spatial predicates. This can miss images whose footprints overlap the object but whose centers lie outside the box, and can include unrelated fields inside it. The archive list is therefore a candidate set requiring inspection.

## Storage and later detail regions

The tracked object catalogue lives in `models/messier/catalogue.json`. Query receipts and image records stay in ignored `.local/nebula-lab/catalogue/messier/`. The browser reads a compact index and hash-checks only the selected object's record files; changed or missing records are reported instead of silently mixed with another snapshot.

`models/messier/presentation.json` records thumbnail URLs/credits and supplementary size evidence independently of that catalogue's hash. The acquisition command restores the ignored tiny-image cache; browsing can use the published cutout URL when a local thumbnail is absent. Adding recognition imagery or display extents does not invalidate or rewrite the existing archive inventory. Re-querying larger sky fields remains an explicit inventory operation.

Keep high-resolution close-ups alongside wider context images. Their source identity, wavelength, sky footprint and provenance can support future composites and **named, nested zoom regions**, analogous to planetary features. Region authoring and automatic composites are not implemented. Two-dimensional footprints do not measure depth or establish a three-dimensional structure; later registration and model assumptions must remain explicit.
