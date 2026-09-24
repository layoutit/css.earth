# Nearby galaxy clusters

Seven retained catalogue-centre annotations share the application camera: Virgo,
Fornax, Hydra, Centaurus, Norma, Perseus, and Coma. They contain no synthetic member
galaxies, luminous gas, or density volume.

## Sources

| Retained release | Use |
| --- | --- |
| MCXC-II, Sadibekova et al. (2024), CDS J/A+A/688/A187 | Seven named centres, redshifts, angular scale and R500 apertures |

The [source manifest](source/manifest.json) pins all retained bytes and authored records. [Acknowledgments and terms](NOTICE.md) document unresolved upstream reuse terms. The [investigation ledger](investigations.json) consolidates the retained source decisions without claiming a new archive search.

## Evidence

The [cluster tests](../../preparation/cluster-catalog/cluster-catalog.test.ts) compare catalogue selection and the independent published kpc/arcsec scale with the derived cosmology. The prepared inventory (`prepared-receipt.json`) pins the delivered catalogue. These checks cover data and derivation; they do not qualify a cluster image or density model.

## Known problems

Redshift-derived positions are sensitive to peculiar velocities, especially for nearby Virgo and Fornax. R500 is an analysis aperture, not a physical edge. The resource provides annotations only. No fresh browser qualification is claimed by these metadata changes.

## Method

The canonical input is the full 2,221-row MCXC-II release by Sadibekova et al.
(2024), A&A 688 A187, mirrored by CDS as J/A+A/688/A187. The gzip table is checked in
with its size pinned; the parser's byte columns follow the release's
[ReadMe](https://cdsarc.cds.unistra.fr/ftp/J/A+A/688/A187/ReadMe). The source recipe
selects seven explicit MCXC identifiers; preparation fails for absent rows.
Publication and independent common-name cross-references are in the provenance.

RA/Dec are the catalogue's J2000 coordinates. Distances are **modelled comoving
distances**, integrating the published spectroscopic redshift in the paper's flat
cosmology, H0 = 70 km/s/Mpc and Ωm = 0.3. The catalogue's independently tabulated
kpc/arcsec scale checks the integration and units. Peculiar velocities are not
corrected: particularly for Virgo and Fornax, these are not redshift-independent
local distance measurements. No uncertainty is invented.

Outlines represent the published **R500 overdensity aperture**, converted from
proper Mpc to comoving metres with (1 + z). This is an X-ray-derived analysis
radius, not a measured cluster boundary. Navigation frames 1.5 times this aperture.
The shared navigation limit is 200 Mpc, covering the furthest selected centre
(Coma, about 98 Mpc) with room to orbit it.

Common installation and preparation are documented in the [shared contributor guide](../README.md).

The prepared JSON includes every source reference used by the runtime. No source
table, coordinate conversion, cosmology integration, or geometry bake runs in the
browser. The sibling application's seven-name inventory was a discovery aid only;
none of its numerical data is canonical here.
