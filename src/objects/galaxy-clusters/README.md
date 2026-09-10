# Nearby galaxy clusters

Seven retained catalogue-centre annotations share the application camera: Virgo,
Fornax, Hydra, Centaurus, Norma, Perseus, and Coma. They contain no synthetic member
galaxies, luminous gas, or density volume.

The canonical input is the full 2,221-row MCXC-II release by Sadibekova et al.
(2024), A&A 688 A187, mirrored by CDS as J/A+A/688/A187. The gzip table and its
byte-column ReadMe are checked in with SHA-256 and size pins. The source recipe
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

From the repository root:

```sh
pnpm install --ignore-scripts
pnpm build:astronomy
pnpm build:catalog
pnpm build:preparation
node tools/objects/dist/prepare-cluster-catalog.js src/objects/galaxy-clusters
```

The prepared JSON includes every source reference used by the runtime. No source
table, coordinate conversion, cosmology integration, or geometry bake runs in the
browser. The sibling application's seven-name inventory was a discovery aid only;
none of its numerical data is canonical here.
