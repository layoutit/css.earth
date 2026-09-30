# Nearby galaxy clusters

Seven retained catalogue-centre annotations share the application camera: Virgo,
Fornax, Hydra, Centaurus, Norma, Perseus, and Coma. Each sits at the measured distance of
its Cosmicflows-4 group, where the [Nearby Universe](../nearby-universe/README.md) draws its
member galaxies. Virgo and Fornax link to packages that add the members Cosmicflows-4 lacks
when the cluster is selected ([Virgo](../virgo-cluster/README.md), [Fornax](../fornax-cluster/README.md)).
They contain no synthetic member galaxies, luminous gas, or density volume.

## Sources

| Retained release | Use |
| --- | --- |
| MCXC-II, Sadibekova et al. (2024), CDS J/A+A/688/A187 | Seven named centres, redshifts, angular scale and R500 apertures |
| [Cosmicflows-4, Tully et al. (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Each cluster's group distance (table 3, DMzp) through the group of its brightest galaxy (table 2): Virgo 16.2 Mpc (M49's group), Fornax 19.7 (NGC 1399), Centaurus 40.3 (NGC 4696), Hydra 54.3 (NGC 3311), Norma 64.2 (ESO 137-006), Perseus 68.7 (NGC 1275), Coma 95.1 (NGC 4874) |

The [source manifest](source/manifest.json) pins all retained bytes and authored records. [Acknowledgments and terms](NOTICE.md) document unresolved upstream reuse terms. The [investigation ledger](investigations.json) consolidates the retained source decisions without claiming a new archive search.

## Evidence

The [cluster tests](../../../packages/bake/src/cluster-catalog/cluster-catalog.test.ts) compare catalogue selection and the independent published kpc/arcsec scale with the derived cosmology. The prepared inventory (`prepared-receipt.json`) pins the delivered catalogue. These checks cover data and derivation; they do not qualify a cluster image or density model.

## Known problems

A group distance averages its members' distance moduli; it is not a measurement of the X-ray centre's own distance. R500 is an analysis aperture, not a physical edge. The resource provides annotations only; the member dots are the Nearby Universe's and the linked packages'.

## Method

The canonical input is the full 2,221-row MCXC-II release by Sadibekova et al.
(2024), A&A 688 A187, mirrored by CDS as J/A+A/688/A187. The gzip table is checked in
with its size pinned; the parser's byte columns follow the release's
[ReadMe](https://cdsarc.cds.unistra.fr/ftp/J/A+A/688/A187/ReadMe). The source recipe
selects seven explicit MCXC identifiers; preparation fails for absent rows.
Publication and independent common-name cross-references are in the provenance.

RA/Dec are the catalogue's J2000 coordinates. Each distance is the recipe's
Cosmicflows-4 group's (`cf4Group`, the PGC number of the group's dominant galaxy),
read from the Nearby Universe's tracked table, so the circle sits where its members
are drawn. The redshift distances this package used before put Virgo 0.8 Mpc in front
of its own galaxies, about the size of its R500 circle. The published spectroscopic
redshift, integrated in the paper's flat cosmology (H0 = 70 km/s/Mpc, Ωm = 0.3), now
only checks the catalogue's independently tabulated kpc/arcsec scale. No uncertainty is
invented.

Outlines represent the published **R500 overdensity aperture**, converted from
proper Mpc to comoving metres with (1 + z). This is an X-ray-derived analysis
radius, not a measured cluster boundary. Navigation frames 1.5 times this aperture.
The shared navigation limit is 200 Mpc, covering the furthest selected centre
(Coma, about 98 Mpc) with room to orbit it.

Common installation and preparation are documented in the [shared contributor guide](../README.md).

`packages/bake/cli/prepare-cluster-catalog.mts src/objects/galaxy-clusters` prepares
the catalogue and its inventory. The prepared JSON includes every source reference used by the runtime. No source
table, coordinate conversion, cosmology integration, or geometry bake runs in the
browser. The sibling application's seven-name inventory was a discovery aid only;
none of its numerical data is canonical here.
