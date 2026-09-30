# Nearby galaxy catalogue

Scientific positions and labels for the complete **eligible galaxy rows in LVDB v1.1.1**, with Local Group membership recorded separately. This is a pinned catalogue snapshot, not a claim that every real galaxy has been discovered.

- **776** galaxies/candidates have usable sourced distances; **951** other source rows have explicit exclusion reasons. The whole snapshot has **1,727** rows, including star clusters and false positives.
- **142** retained objects have Local Group associations; **109** are confirmed galaxies. Search labels candidate rows "Candidate galaxy" and leaves them out of the Galaxies list.
- M31, M33, LMC and SMC link to detailed objects through authored mappings. The source MW row lacks a distance, so the existing Milky Way keeps its own registration as an unpositioned host; its 62 satellite references still resolve.
- Local Volume membership, `dwarf_local_field` and a 3 Mpc cut do not establish Local Group membership. The author's star-cluster and ambiguous compact-system tables are excluded; no confirmed galaxy is lost by that choice.

## Sources

| Retained release | Use |
| --- | --- |
| LVDB v1.1.1, Pace (2025) | Selected measurements, names, host links and bibliography |
| McConnachie (2012), October 2019 update | Published Local Group membership |
| Graczyk et al. (2020) | SMC distance and separate uncertainties |

- **Positions and structure:** [Pace (2025), Local Volume Database, DOI 10.33232/001c.144859](https://doi.org/10.33232/001c.144859), release [v1.1.1](https://github.com/apace7/local_volume_database/releases/tag/v1.1.1), commit `72dabf7862bf9e9f1cbf6846e8c1a684fdec904c` (12 August 2026). The release CSV supplies measurements and labels; the per-object YAML supplies aliases, host associations, references and false-positive flags. LVDB is CC0; this does not change the rights of its input papers.
- **Membership:** [McConnachie's author-hosted catalogue](https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/), citing [McConnachie (2012), AJ 144, 4](https://doi.org/10.1088/0004-6256/144/1/4). The **October 2019 Table 1** ([PDF](https://cadc-west-01.canfar.net/vault/files/PANDAS/NearbyGals/table1_OCT2019.pdf)) supplies G/A/L/N classes through a checked-in text transcription. The January 2021 FITS has **no membership column**. The 2012 table's columns are defined in the CDS [ReadMe](https://cdsarc.cds.unistra.fr/ftp/J/AJ/144/4/ReadMe).
- **SMC distance:** **62,440 pc**, with **470 pc statistical** and **810 pc systematic** uncertainty, from [Graczyk et al. (2020), ApJ 904, 13](https://doi.org/10.3847/1538-4357/abbb2b). This is the only distance override; it replaces the release's older Cioni (2000) estimate, and the error components are not combined.

The [source manifest](source/manifest.json) lists every input and authored record. [Acknowledgments and terms](NOTICE.md) keep upstream rights separate. The [investigation ledger](investigations.json) records source decisions. Bibliography keys resolve to citations from the LVDB bibliography; see [navigation identity and evidence](../../../docs/navigation-identity.md).

## Processing

`node packages/bake/cli/prepare-galaxy-catalog.mts src/objects/local-group` prepares the catalogue offline. Runtime reads only the prepared positions.

- Coordinates are Sun-origin ICRS Cartesian metres at JD TT 2461286.5, with no proper-motion propagation. Distance moduli are converted to parsecs directly, not from the CSV's rounded kpc column.
- Host-assigned, numerical-action, redshift/Hubble-law distances, confirmed clusters and false positives are excluded. A blank distance method stays `unspecified`.
- Membership uses 143 explicit name bindings to the updated table's 144 rows; Canis Major has no matching LVDB row. No coordinates are used to guess a match. G/A/L mean Milky Way, M31 or other Local Group association and N a nearby neighbour; mixed codes such as G/L keep the uncertainty. An unmatched field galaxy stays `uncertain`.
- Half-light radius is the projected **semi-major radius** at the adopted distance. Its errors carry angular-fit errors only. It is not a diameter or a hard edge.
- The four detailed galaxies have authored arrival framing radii of 25, 9, 5 and 4 kpc (M31, M33, LMC, SMC). These are not measured galaxy radii.

The command also writes `prepared/display-sample.json`. The [sampling recipe](source/presentation.json) picks 48 catalogue-only Local Group galaxies from 150 kpc cells, weighted by square-root counts. Dots start appearing at 120 Mpc and are fully visible at 30 Mpc; names and ovals follow between 40 and 12 Mpc, with at most twelve labels. Catalogue-only entries stay navigation destinations whether or not they are sampled.

## Evidence

The [catalogue tests](../../../packages/bake/src/galaxy-catalog/galaxy-catalog.test.ts) regenerate the catalogue, display sample and receipt and compare them byte for byte. They check coordinate axes independently, keep the four detailed galaxies' published directions and distances, and reject corrupted sources, coordinate-frame changes, radius-based membership and lost candidates. A pypdf 5.9.0 extraction checks the Table 1 transcription against the original PDF. These checks establish derivation, not visual or scientific acceptance.

## Known problems

- The display sample is incomplete by design and is not a density, completeness or mass map.
- Catalogue centres keep the authors' differing definitions of the Magellanic centres.
- Reuse terms for the retained non-LVDB papers and tables are unresolved.
