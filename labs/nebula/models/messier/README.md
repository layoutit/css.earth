# Messier discovery inventory

[catalogue.json](catalogue.json) contains exactly one entry for each **M1–M110**. It is metadata for finding archive observations, not a collection of downloaded images or prepared nebulae. Browse/import decisions do not authorize processing.

## Sources and interpretation

- **Identities, aliases, ICRS/J2000 centres and angular axes:** [CDS SIMBAD](https://simbad.unistra.fr/simbad/), through two recorded TAP queries. Aliases keep common names and NGC/IC designations.
- **Types:** broad categories follow the [SIMBAD hierarchy](https://simbad.cds.unistra.fr/Pages/guide/otypes_desc.htx); `sourceType` keeps the original code.
- **Sizes:** 104 entries have reported axes; M8, M40, M43, M73, M78 and M82 have none, and `null` means unknown. SIMBAD combines heterogeneous measurements, so these are discovery hints, **not image crop boundaries or physical dimensions**. A source image needs its own WCS and full-footprint check.
- **Rights:** SIMBAD states **ODbL**. Preserve the data attribution and [ODbL 1.0 terms](https://opendatacommons.org/licenses/odbl/1-0/); the repository's software licence does not replace them. This inventory uses SIMBAD, operated at CDS, Strasbourg, France; cite [Wenger et al. (2000)](https://doi.org/10.1051/aas:2000332). Paper and NASA pages are linked references; their images and text are not imported.

| Entry | Preserved interpretation |
|---|---|
| M8, M16, M17, M20 | SIMBAD resolves an open-cluster entry associated with the named nebula. Its reported axes do not necessarily encompass the surrounding cloud. |
| M40 | An optical pair of unrelated stars, from [Merrifield et al. (2016)](https://arxiv.org/abs/1612.00834). SIMBAD's `?` code and nominal center remain recorded. |
| M73 | An asterism, from [Odenkirchen & Soubiran (2002)](https://arxiv.org/abs/astro-ph/0111601). The `err` source code does not remove this historical Messier entry. |
| M76 | NGC 650 and NGC 651 are aliases of one target. |
| M102 | Adopts SIMBAD's NGC 5866 identification and the [NASA Hubble M102 entry](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-102/). The historical identification remains disputed: [NASA's older HEASARC table](https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html) has 109 entries and omits M102 as a duplicate of M101. |

## Refresh the inventory

From the repository root with the supported Node version:

```sh
node labs/nebula/src/catalogue/acquire-messier.ts
```

The command fetches the two metadata responses, validates every row and atomically updates the inventory. Raw responses stay in ignored `.local/nebula-lab/catalogue/messier/`. `--cached` replays them offline. A fresh query can change as SIMBAD is updated, so inspect the diff before accepting it.

## Resolve archive links

Run with **one writer only**: let inventory acquisition finish or stop it first. The command picks at most three candidates per provider, spread across instrument, band and collection, for explicitly named objects. It reads small DataLink/MAST metadata and sends HEAD requests; it never downloads FITS images or starts processing.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node labs/nebula/src/run.ts inventory-messier --object=m42
node labs/nebula/src/run.ts enrich-messier-catalogue --object=m42 --max-images=3
```

Repeat `--object` for more targets; `--max-images` accepts 1–12 per object and provider. A MAST thumbnail can represent its parent observation rather than the exact FITS file, and HEAD checks do not validate pixels.

## Recognition previews and apparent extents

[presentation.json](presentation.json) adds 110 north-up ICRS DSS2 colour cutouts, 192×192 pixels, for recognising targets. They are not science observations or reconstruction inputs. Local JPEGs stay ignored; the supplement pins their service URLs and dimensions. To restore them:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node labs/nebula/src/run.ts acquire-messier-presentation
pnpm lab:nebula
```

`--object=m42` restricts restoration to one object. The command never overwrites the catalogue or archive inventory.

- **Image source:** [CDS DSS2 colour HiPS properties](https://alasky.cds.unistra.fr/DSS/DSSColor/properties), DOI [10.26093/cds/aladin/ht9n-7r](https://doi.org/10.26093/cds/aladin/ht9n-7r), through [HiPS2FITS](https://alasky.cds.unistra.fr/hips-image-services/hips2fits). Red and blue photographic plates make the RGB composite, with green as their mean; this is not calibrated photometry. Credit: Digitized Sky Survey, STScI/NASA; colour composition and HiPS by CDS. The HiPS properties declare ODbL-1.0; the plates keep the [STScI-listed copyright provisions](https://archive.stsci.edu/dss/copyright.html). The full acknowledgement is in [the source properties](presentation-sources/dss2-properties.txt).
- **Historical apparent extents:** the [NASA/GSFC HEASARC Messier table](https://heasarc.gsfc.nasa.gov/W3Browse/general-catalog/messier.html), mainly Hirshfeld & Sinnott's *Sky Catalog 2000.0*, Volume 2 (1985), kept in [the query response](presentation-sources/facts.xml). Its 109 rows omit M102. M8/M17/M20 use the diffuse-nebula dimensions, and M43/M78/M82 fill unknown axes. All are approximate historical measures.
- **M16:** [Sharpless (1959), CDS VII/20](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/20), Sh 2-49, reports a **90′ maximum H II-region diameter** for the extended Eagle region ([retrieved row](presentation-sources/sharpless.tsv)). Its B1900 centre is not substituted for the ICRS coordinates.
- **M40/M73:** M40's **50″ optical-pair separation** is labelled as such, not a nebula diameter. M73's extent stays unknown.
- **Optional facts:** HEASARC supplies constellation and historical V magnitude for 109 entries.

Thumbnail framing uses 1.4× the adopted major extent with a 180″ minimum, or an authored 1680″ preview when the extent is unknown. Thumbnail field of view is never used as a measured size.

## Centered survey images

The catalogue gallery uses CDS HiPS colour products through the [HiPS2FITS JPEG cutout service](https://alasky.cds.unistra.fr/hips-image-services/hips2fits), centred on each object at its display extent. No mosaics are committed.

| Product | Published mapping and provenance |
| --- | --- |
| `CDS/P/DSS2/color` | Red/blue photographic plates, with green from their mean; STScI/NASA with Palomar and UK Schmidt plates; colour/HiPS processing CDS. [Published properties and full plate acknowledgement](https://alasky.cds.unistra.fr/DSS/DSSColor/properties), [survey source](https://archive.stsci.edu/dss/). The existing DSS acknowledgement above also applies. |
| `CDS/P/allWISE/color` | Red W4 (22μm), green W2 (4.6μm), blue W1 (3.4μm), from atlas imagery. NASA-funded WISE/NEOWISE; UCLA, JPL-Caltech and IPAC; CDS colour/HiPS product. [Published properties and acknowledgement](https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1/properties), [IRSA mission and release documentation](https://irsa.ipac.caltech.edu/Missions/wise.html). Atlas seams can be conspicuous, including around M24. |
| `CDS/P/2MASS/color` | Near-infrared J/H/Ks colour; University of Massachusetts and IPAC/Caltech, funded by NASA and NSF; CDS colour/HiPS product. [Published properties](https://alasky.cds.unistra.fr/2MASS/Color/properties), [IRSA source and acknowledgement](https://irsa.ipac.caltech.edu/Missions/2mass.html). Strong stellar signal does not imply visible diffuse gas. |

All views use TAN/ICRS, zero rotation and the same centre and field. This gives a shared sky comparison, not a fitted registration or complete faint-emission coverage.

## Object bibliography

The [Papers catalogue](../../docs/paper-catalogue.md) collects SIMBAD object-linked references through `ident → has_ref → ref`, with titles, journals, years, DOIs and abstracts. Topic and title hints are discovery aids, not reconstruction evidence.
