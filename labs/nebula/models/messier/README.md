# Messier discovery inventory

[catalogue.json](catalogue.json) contains exactly one entry for each **M1–M110**. It is metadata for finding archive observations, not a collection of downloaded images or prepared nebulae. Browse/import decisions do not authorize processing.

## Sources and interpretation

- **Identities, aliases, ICRS/J2000 centers and reported angular axes:** [CDS SIMBAD](https://simbad.unistra.fr/simbad/), acquired through two recorded TAP queries. Each response has an exact URL, query, retrieval time, byte count and SHA-256. Alias selection retains common names and NGC/IC designations, not every survey identifier.
- **Types:** broad discovery categories follow the [SIMBAD hierarchy](https://simbad.cds.unistra.fr/Pages/guide/otypes_desc.htx); `sourceType` preserves the original code. An active galaxy remains in the galaxy category. Source bibliographic references and quality flags remain beside the coordinates and angular axes.
- **Sizes:** 104 entries have reported axes; M8, M40, M43, M73, M78 and M82 have no axes in this snapshot. `null` means unknown. SIMBAD combines heterogeneous measurements, wavelengths and apertures: these are discovery hints, **not reliable image crop boundaries or physical dimensions**. A source image needs its own WCS and full-footprint check.
- **Rights:** SIMBAD states **ODbL** on its service page. Preserve the data attribution and [ODbL 1.0 terms](https://opendatacommons.org/licenses/odbl/1-0/); the repository's software license does not replace source-data terms. This inventory uses SIMBAD, operated at CDS, Strasbourg, France; cite [Wenger et al. (2000)](https://doi.org/10.1051/aas:2000332). Paper and NASA pages are linked metadata references; their images and article text are not imported.

## Identity qualifications

| Entry | Preserved interpretation |
|---|---|
| M8, M16, M17, M20 | SIMBAD resolves an open-cluster entry associated with the named nebula. Its reported axes do not necessarily encompass the surrounding cloud. |
| M40 | An optical pair of unrelated stars, from [Merrifield et al. (2016)](https://arxiv.org/abs/1612.00834). SIMBAD's `?` code and nominal center remain recorded. |
| M73 | An asterism, from [Odenkirchen & Soubiran (2002)](https://arxiv.org/abs/astro-ph/0111601). The `err` source code does not remove this historical Messier entry. |
| M76 | NGC 650 and NGC 651 are aliases of one target. |
| M102 | Adopts SIMBAD's NGC 5866 identification and the [NASA Hubble M102 entry](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/). The historical identification remains disputed: [NASA's older HEASARC table](https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html) has 109 entries and omits M102 as a duplicate of M101. |

## Refresh and verification

With the repository checked out and its supported Node version installed, run from its root:

```sh
node labs/nebula/src/catalogue/acquire-messier.ts
```

The command fetches only the two small metadata responses, validates every row and atomically updates this inventory. It rejects missing/duplicate/out-of-range Messier numbers, unexpected columns/units/coordinate frames, invalid numbers and unrecognized source types. Raw responses and retrieval time stay in ignored `.local/nebula-lab/catalogue/messier/`. `--cached` replays those saved responses without network access; a fresh query can change as SIMBAD is updated, so inspect its diff before accepting a new snapshot.

Verified acquisition: **110 unique targets, complete M1–M110 sequence, 110 finite sky centers, 104 reported major axes**. No science image acquisition or reconstruction was performed by this command. Angular sizes remain unvalidated as full-object image coverage.

## Resolve representative archive links

Run with **one writer only**: let inventory acquisition finish or stop it before enrichment. This command selects at most three candidates per provider by default, spreads selections across instrument/band/collection groups, and requires explicit object IDs. It retrieves small DataLink/MAST metadata responses and sends HEAD requests for file size and preview availability. It never downloads FITS images or starts processing.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node labs/nebula/src/run.ts inventory-messier --object=m42
node labs/nebula/src/run.ts enrich-messier-catalogue --object=m42 --max-images=3
```

Repeat `--object` to name another target; `--max-images` accepts 1–12 per object/provider. The command preserves discovery identities and receipts, updates overlapping-target copies together, recomputes known/unknown storage counts, and atomically replaces each changed page followed by the compact index. It rejects an index changed by another writer during enrichment. `MESSIER_ENRICHMENT_SAVED` reports verified preview, resolved file and failure counts; failures remain in each image's metadata evidence. A MAST thumbnail can represent its parent observation rather than the exact FITS file, and HEAD checks do not validate pixel content. Unsupported or unavailable previews remain unknown.

## Recognition previews and apparent extents

[presentation.json](presentation.json) is a separate presentation supplement: **110 north-up ICRS DSS2 colour cutouts, 192×192 pixels, 1,087,190 bytes in total**. These are genuine survey images for recognizing targets, not native science observations or reconstruction inputs. The existing SIMBAD catalogue and archive inventory hashes are unchanged. Local JPEGs stay ignored; the supplement pins their exact service URLs, hashes and decoded dimensions. A clean checkout can display the remote URLs while restoring its local cache:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node labs/nebula/src/run.ts acquire-messier-presentation
pnpm lab:nebula
```

The acquisition command requests only bounded JPEG thumbnails, four concurrently. It verifies the complete decoded image and its SHA256, reuses valid cached files and rejects changed published pixels. `--object=m42` restricts restoration to one object; repeat it for more. `MESSIER_PRESENTATION_SAVED` reports the actual results. The verified replay restored **110 cached images with zero downloads and zero failures**. Source changes require deliberate inspection and repinning; the command does not overwrite the catalogue or archive inventory.

- **Image source:** [CDS DSS2 colour HiPS properties](https://alasky.cds.unistra.fr/DSS/DSSColor/properties), DOI [10.26093/cds/aladin/ht9n-7r](https://doi.org/10.26093/cds/aladin/ht9n-7r), through [HiPS2FITS](https://alasky.cds.unistra.fr/hips-image-services/hips2fits). DSS2 photographic red/blue plates provide the RGB composite; its green channel is their mean. This is not calibrated multiband photometry. Credit: Digitized Sky Survey, STScI/NASA; colour composition and HiPS by CDS. The HiPS properties declare ODbL-1.0; the underlying plates retain the [STScI-listed copyright provisions](https://archive.stsci.edu/dss/copyright.html), not a blanket public-domain license. The complete survey acknowledgment is preserved in [the source properties](presentation-sources/dss2-properties.txt).
- **Historical apparent extents:** [NASA/GSFC HEASARC Messier table](https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html), mainly Hirshfeld & Sinnott's *Sky Catalog 2000.0*, Volume 2 (1985). Its 109 rows omit M102; they supplement, never replace, our 110 identifiers. Source bytes are retained in [the query response](presentation-sources/facts.xml). Cluster rows provide historical visible extents, distinct from SIMBAD's sometimes much larger membership footprints. M8/M17/M20 use the diffuse-nebula dimensions, with M43/M78/M82 filling previously unknown axes. All remain approximate historical measures, not common isophotal boundaries.
- **M16:** [Sharpless (1959), CDS VII/20](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/20), Sh 2-49, reports a **90′ maximum H II-region diameter**. This describes the extended Eagle region, not the associated 7′ cluster or a circular boundary. The [retrieved row](presentation-sources/sharpless.tsv) preserves its original units and frame; its B1900 center is not substituted for the existing ICRS coordinates.
- **M40/M73:** M40's **50″ optical-pair separation** is explicitly labeled as such; it is not a nebula diameter. M73's extent stays unknown because the selected source reports none. Thumbnail field of view is authored framing, never substituted as a measured size.
- **Optional facts:** HEASARC supplies constellation and historical apparent V magnitude for 109 entries. `:` marks an approximate magnitude; `*` marks an originally rounded whole-number magnitude. Neither is a numerical error estimate. M102 has no invented HEASARC row.

Default thumbnail framing uses 1.4×the adopted major apparent extent, with a 180″ minimum; an unknown extent uses an authored 1680″ preview. Sorting uses the documented object extent separately. All source URLs, retrieval times and response hashes are in the supplement. Three focused tests validate the complete presentation, pin/path guards and damaged/changed image rejection; live acquisition decoded and hash-checked every cached JPEG.

## Centered survey images

The catalogue gallery uses CDS HiPS colour products through the [HiPS2FITS JPEG cutout service](https://alasky.cds.unistra.fr/hips-image-services/hips2fits). The survey identifiers, source links and credits are owned by the lab catalogue's survey definitions; the sky window comes from the existing sourced object center and display extent. These are visual discovery products, not photometrically calibrated reconstruction inputs. The browser requests only the selected object's 512px previews and an explicitly opened 2048px view. No generated mosaics are committed.

| Product | Published mapping and provenance |
| --- | --- |
| `CDS/P/DSS2/color` | Red/blue photographic plates, with green from their mean; STScI/NASA with Palomar and UK Schmidt plates; colour/HiPS processing CDS. [Published properties and full plate acknowledgement](https://alasky.cds.unistra.fr/DSS/DSSColor/properties), [survey source](https://archive.stsci.edu/dss/). The existing DSS acknowledgement above also applies. |
| `CDS/P/allWISE/color` | Red W4 (22μm), green W2 (4.6μm), blue W1 (3.4μm), from atlas imagery. NASA-funded WISE/NEOWISE; UCLA, JPL-Caltech and IPAC; CDS colour/HiPS product. [Published properties and acknowledgement](https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1/properties), [IRSA mission and release documentation](https://irsa.ipac.caltech.edu/Missions/wise.html). Atlas seams can be conspicuous, including around M24. |
| `CDS/P/2MASS/color` | Near-infrared J/H/Ks colour; University of Massachusetts and IPAC/Caltech, funded by NASA and NSF; CDS colour/HiPS product. [Published properties](https://alasky.cds.unistra.fr/2MASS/Color/properties), [IRSA source and acknowledgement](https://irsa.ipac.caltech.edu/Missions/2mass.html). Strong stellar signal does not imply visible diffuse gas. |

All views use TAN/ICRS, zero rotation and the same center/field. This provides a shared sky comparison, not a fitted registration or a guarantee of complete faint-emission coverage. Display size is not native resolution. Retain original calibrated products and source-specific registration/acceptance before any later star removal or volume baking.

## Object bibliography

The [Papers catalogue](../../docs/paper-catalogue.md) acquires SIMBAD object-linked references through `ident → has_ref → ref`, preserving titles, journals, years, DOIs, available abstracts and article object names. It retains source-query receipts and catalogue/object integrity checks in ignored compressed caches. Topic/title hints are discovery aids, not accepted reconstruction evidence. The guide records the source credit, database terms, current snapshot counts, reproducible acquisition command and verification scope.
