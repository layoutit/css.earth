# Archive image catalogue

The **Papers** tab adds the [object bibliography](paper-catalogue.md): SIMBAD-linked references, abstracts, topic/year filters and publisher/ADS links for all 110 objects. Its acquisition and cache are independent of image discovery.

[/catalogue?object=m42](http://127.0.0.1:4331/catalogue?object=m42) browses the **110 Messier objects** with small sky-survey thumbnails, apparent sizes and MAST, IRSA and ESO image candidates. **Largest on sky first** is the default order; Messier number and name are also available. Sizes use arcseconds (60″ = 1′); unknown sizes sort last. Search and object-type filters narrow the list, and arrow keys move between objects.

**Survey images** is the default: DSS2 optical, WISE infrared and 2MASS near infrared appear as real, centered colour mosaics. All three use the selected object's ICRS center, north up, the same tangent projection and a common field with 25% margin around the reference major diameter. Unknown size uses a labeled 1° field; fields are bounded to 0.03–20°. **View image** opens a 2048px JPEG inside the lab, with loading, failure and retry states. Output pixels do not increase the survey's native resolution. No FITS download or reconstruction starts when browsing.

These are separate survey products, **not previews of individual archive exposures**. Their stretches can saturate bright cores, and source mosaics can contain seams or artifacts. For example, the WISE view of M24 has conspicuous atlas seams. Different bands emphasize different structures; 2MASS often shows mostly stars. M24 itself is a stellar window through foreground dust, not an emission nebula ([NASA explanation](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-24/)). Inspect before accepting a source for processing. Survey credits, colour channels and the cutout method are recorded in the [source account](../models/messier/README.md#centered-survey-images).

**Archive records** retains the complete cached search results separately. **Metadata order** is triage, never a visual-quality ranking. Supported ICRS/J2000 polygon footprints are projected about the target: records missing its center are demoted, and reference-extent coverage requires the whole major-radius circle to fit. Rotated fields and RA wrap are handled. Unknown/unsupported footprints remain unverified; overlapping a search cone does not establish complete coverage. Reported sampling, dimensions and combined-product status only help order records after those exclusions. Support maps remain last. Finest resolution and widest field are alternative metadata orders.

**Source record** opens published metadata, which may have no image. **View FITS** opens the exact science file in [IRSA Viewer](https://irsa.ipac.caltech.edu/onlinehelp/irsaviewer/irsaviewer/visualization.html). **File listing** explicitly denotes unresolved DataLink metadata; it is not an image preview. **Download FITS** remains a separate explicit action. Large files and external archive failures can prevent viewer loading. The earlier live FITS/DataLink handoff check established routing only; it did **not** establish visible nebular structure or suitability.

Validation for this correction uses the actual reported SPS_17782 footprint against M31, the selected-object cache/hash checks, and browser loading of the three survey previews and enlarged JPEGs for M31, M24 and M42. Screenshots must be inspected separately from successful image decoding; neither proves all catalogue objects are suitable reconstruction targets. `browser-catalogue-surveys` repeats the live survey check, including service failure/retry and zero downloads/processing. `browser-catalogue-fits` is an optional external-service routing check.

The selected object also shows sourced constellation and visual magnitude where reported. Approximate magnitudes retain their source qualification. Nebula classifications refer to the cloud when its supplementary source identifies it, while the underlying cluster-oriented SIMBAD record remains preserved.

## Start from a clean checkout

Run from the repository root with its supported Node version:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/run.mts acquire-messier-presentation
node --experimental-strip-types labs/nebula/run.mts acquire-messier
node --experimental-strip-types labs/nebula/run.mts enrich-messier-catalogue --object=m42 --max-images=3
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
| Fine / Coarse / Unknown sampling | Provisional sampling from reported angular resolution relative to catalogue extent. These do not measure useful image structure. |
| FOV / footprint | Reported angular coverage, retained with the image center for later registration. A close-up remains useful even when it covers only part of the object. |
| Advertised size | Metadata estimates, not downloaded bytes. Missing sizes remain unknown. Deduplicated totals are lower bounds when sizes or queries are incomplete. MAST's inconsistent size metadata stays unknown until a per-file header check resolves it. |

The [source record](../models/messier/README.md) explains identities, credits and angular-size qualifications. Source-backed supplementary nebula extents take precedence for display and sorting when the original SIMBAD entry describes the associated cluster. Every supplementary extent links to its source. These apparent sizes are reference estimates, not nebula crop boundaries or guaranteed coverage at every wavelength. A thumbnail's authored sky field never substitutes for an object-size measurement.

ESO and IRSA search image-footprint overlap. MAST currently searches **pointing centers inside a padded sky bounding box**, avoiding its slow spatial predicates. This can miss images whose footprints overlap the object but whose centers lie outside the box, and can include unrelated fields inside it. The archive list is therefore a candidate set requiring inspection.

## Storage and later detail regions

The tracked object catalogue lives in `models/messier/catalogue.json`. Query receipts and image records stay in ignored `.local/nebula-lab/catalogue/messier/`. The browser reads a compact index and hash-checks only the selected object's record files; changed or missing records are reported instead of silently mixed with another snapshot.

`models/messier/presentation.json` records thumbnail URLs/credits and supplementary size evidence independently of that catalogue's hash. The acquisition command restores the ignored tiny-image cache; browsing can use the published cutout URL when a local thumbnail is absent. Adding recognition imagery or display extents does not invalidate or rewrite the existing archive inventory. Re-querying larger sky fields remains an explicit inventory operation.

Keep high-resolution close-ups alongside wider context images. Their source identity, wavelength, sky footprint and provenance can support future composites and **named, nested zoom regions**, analogous to planetary features. Region authoring and automatic composites are not implemented. Two-dimensional footprints do not measure depth or establish a three-dimensional structure; later registration and model assumptions must remain explicit.
