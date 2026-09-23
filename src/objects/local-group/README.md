# Nearby galaxy catalogue

Scientific positions and labels for the complete **eligible galaxy rows in LVDB
v1.1.1**, with Local Group membership recorded separately. This is a pinned
catalogue snapshot, not a claim that every real galaxy has been discovered.

- **776** galaxies/candidates have usable sourced distances; **951** other source
  rows have explicit exclusion reasons.
- **142** retained objects have Local Group associations; **109** are confirmed
  galaxies. Candidate status remains available to the renderer.
- M31, M33, LMC and SMC link to detailed objects through authored mappings. The
  source MW row lacks a distance; the existing Milky Way keeps its own registration
  and is retained as an unpositioned physical host without invented catalogue coordinates. Its 62 satellite references resolve independently of scene hosting.
- The entire source snapshot has **1,727** rows, including star clusters and
  false positives. Local Volume membership, `dwarf_local_field`, and a 3 Mpc cut
  do not establish Local Group membership.
- The author's star-cluster and ambiguous compact-system tables remain excluded;
  no confirmed galaxy is omitted by that table selection. Uncertain galaxy-table
  rows retain candidate status.

## Sources

| Retained release | Use |
| --- | --- |
| LVDB v1.1.1, Pace (2025) | Selected measurements, names, host links and bibliography |
| McConnachie (2012), October 2019 update | Published Local Group membership |
| Graczyk et al. (2020) | SMC distance and separate uncertainties |

The [source manifest](source/manifest.json) inventories every retained input and authored record. [Acknowledgments and terms](NOTICE.md) keep upstream rights separate. The [investigation ledger](investigations.json) records source decisions; its initial entries consolidate the existing records, not a new archive search.

## Evidence

The [catalogue tests](../../preparation/galaxy-catalog/galaxy-catalog.test.ts) compare regenerated catalogue, display sample and output receipt byte-for-byte, check cardinal coordinate axes independently, and retain the four detailed galaxies' published directions and adopted distances. The prepared inventory (`prepared-receipt.json`) pins both delivered data files. These checks establish derivation and reproduction, not visual or scientific acceptance of a reconstruction.

## Known problems

The display sample is incomplete by design and is not a density measurement. Candidate classifications and source uncertainties remain in the full catalogue. Reuse terms for the retained non-LVDB papers and tables remain unresolved. No fresh browser qualification is claimed by these metadata changes.

## Scientific source details


The prepared catalogue retains the original bibliography keys and resolves them
to citations transcribed from the pinned LVDB bibliography. The separate pinned
SMC distance paper has an explicit key binding in `source/provenance.json`.
Distance, sky-position, half-light-radius and membership references must resolve
when the catalogue is read. Bibliography entries bind to canonical publication records in the shared Sources catalogue, where usage is indexed per measured quantity. Paper links do not inherit the bibliography file’s
byte hash. See [navigation identity and evidence](../../../docs/navigation-identity.md).

The position/structure compilation is [Pace (2025), Local Volume Database,
DOI 10.33232/001c.144859](https://doi.org/10.33232/001c.144859), release
[v1.1.1](https://github.com/apace7/local_volume_database/releases/tag/v1.1.1),
commit `72dabf7862bf9e9f1cbf6846e8c1a684fdec904c` (12 August 2026).
The exact original archive preserves per-object YAML and original paper references.
The independent release CSV supplies the selected measurements and labels; YAML
supplies aliases, host associations, source references and false-positive flags.
The original bibliography remains checked beside it. LVDB is CC0; this does not
change the rights of its scientific input papers.

Membership uses [McConnachie's author-hosted catalogue](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/),
citing [McConnachie (2012), AJ 144, 4](https://doi.org/10.1088/0004-6256/144/1/4).
The **October 2019 Table 1** supplies G/A/L/N classifications. The January 2021
FITS is preserved for audit and has **no membership column**. The original 2012
machine-readable table and column definitions are also retained for comparison.
There are 143 explicit name bindings to the updated table's 144 rows; Canis Major
has no matching LVDB release row. No coordinates are used to guess this match.

G/A/L denote Milky Way, M31, or other Local Group association; N denotes a nearby
neighbor. Mixed codes such as G/L preserve uncertain satellite-versus-field
association. New LVDB satellite host chains supplement the older table. An
unmatched field galaxy remains `uncertain`; it is not silently included in the LG.

The only distance override is the SMC: **62,440 pc**, with **470 pc statistical**
and **810 pc systematic** uncertainty, from [Graczyk et al. (2020), ApJ 904, 13](https://doi.org/10.3847/1538-4357/abbb2b).
This replaces the release's older Cioni (2000) estimate. The unchanged paper is
checked in; error components are not silently combined. Catalogue centers are
retained, including the authors' differing definitions of Magellanic centers.

## Meaning and limits

Coordinates are Sun-origin ICRS Cartesian metres. The shared navigation epoch is
JD TT 2461286.5; no proper-motion propagation is claimed. Distance moduli convert
to parsecs before astrometry is prepared, avoiding the CSV's rounded kpc column.
Derived values use 12 significant digits for platform-independent serialization,
far below the published distance uncertainties.

Host-assigned distances, numerical-action model distances, redshift/Hubble-law
distances, confirmed clusters and false positives are excluded. A blank distance
method remains `unspecified` with its original citation; it is not relabeled as
a geometric measurement. Candidates with sourced distances remain candidates.

Half-light radius is the projected **semi-major radius**, converted from the
catalogue's angular measurement at the adopted distance. Reported radius errors
transport angular-fit errors only; distance errors remain separate. A half-light
radius is neither a full diameter nor a physical hard edge. Disk inclination and
image extent are separate detailed-object inputs, not inferred from ellipticity.

The four detailed galaxies have authored navigation framing radii in the recipe
(25, 9, 5 and 4 kpc for M31, M33, LMC and SMC). These choose a useful arrival
view; they are not measured galaxy radii. Transparent image-quad corners do not
determine the arrival distance.

All preparation is offline TypeScript. Runtime consumes the prepared positions;
it does not read the CSV, YAML, PDF, archive or original papers. Recipe mappings
own specific galaxy identifiers; shared preparation contains no object-id dispatch.

## Reproduction evidence

All source bytes are checked in. The retained pypdf 5.9.0 extraction receipt checks the original PDF-to-text transcription. The catalogue tests regenerate the declared outputs and compare them byte-for-byte. Common installation and preparation are documented in the [shared contributor guide](../README.md).

`provenance.json` records original download URLs, SHA-256 digests and sizes.
Redownloading is optional; replacing any checked source requires deliberate pin
updates and a new preparation receipt. The tests reject corrupted source bytes,
duplicate consumed YAML fields, coordinate-frame changes, radius-based membership,
lost candidates, and a changed canonical rebake.

### Sparse context display

`node tools/objects/dist/prepare-galaxy-catalog.js src/objects/local-group` also writes `prepared/display-sample.json`.
The [sampling recipe](source/presentation.json) selects 48 catalogue-only Local Group galaxies using 150 kpc spatial cells,
weighted by square-root galaxy counts. This balances dense and sparse cells but
does not guarantee representation of every occupied cell. Positions and scientific source references
remain those in the validated catalogue. The four galaxies with imagery are
retained separately. This is a display sample, not a completeness or mass map.

Dots begin appearing at 120 Mpc and reach full visibility at 30 Mpc on approach.
Names and ovals follow between 40 and 12 Mpc; collision handling limits labels
to twelve. Images still use their projected-size visibility. Catalogue-only
entries remain prepared-focus navigation destinations, independently of this display selection. The distant galaxy field remains
visible behind the transition.
