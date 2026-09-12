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
