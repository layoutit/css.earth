# Nearby galaxy field

The retained renderer displays 1,800 catalogue positions in eight CSS shadow batches and 160 prepared galaxy-count clouds. Clouds describe concentrations of catalogue entries, not gas or measured mass density. No generated images or catalogues are committed.

## Scientific inputs

All three input tables are downloaded directly from CDS/VizieR. `source/catalogue.json` records the ADQL queries, table identities, response hashes, row counts and download URLs.

| Input | Use |
| --- | --- |
| [Cosmicflows-4, Tully et al. (2023), J/ApJ/944/94/table2](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) | Equatorial coordinates and individual distance moduli for 55,877 galaxies. |
| [HYPERLEDA I, Paturel et al. (2003), VII/237/pgc](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/237) | The 50,000 largest angular-diameter catalogue entries; coordinates, PGC identities and morphology. |
| [HYPERLEDA II, Paturel et al. (2003), VII/238/hidat](https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/238) | HI radial velocities for fallback distance estimates. |

Join by PGC identity. CF4 distance is `10^((DM−25)/5)` Mpc. Otherwise use positive `VHI/70` Mpc; this Hubble-law estimate has no peculiar-velocity correction. Convert equatorial coordinates to Cartesian positions without an extra rotation. Only positions between 3 and 200 Mpc enter this field. The existing Local Group catalogue supplies nearby detailed objects independently.

No measured luminosities are imported. Point exposure, morphology colors, count-cloud smoothing and the denser-region sampling preference are authored visualization choices. Selection effects and survey gaps must not be interpreted as real cosmic voids. Source terms remain those of the original tables; CDS/VizieR is the distributor.

## Reproduce locally

From a clean checkout:

```sh
pnpm install
pnpm prepare:galaxy-field
pnpm dev
```

Installation, development startup and production builds run the same bake.
Acquisition downloads missing CDS tables and verifies cached responses against
pinned hashes. Inputs live in `.local/galaxy-field/sources`; generated runtime
assets live in this object's ignored `prepared/` directory. Vite publishes the
point manifest and shared cloud texture as hashed production assets. Neither
source downloads nor generated images need to be committed.

## Experiment outcome

The rejected XYZ, multi-direction image planes and spatial-chunk experiments were removed from the Nebula Lab. At near-field zoom they introduced visible depth quantization, crossfade disagreement or diffuse point cores. The retained approach projects actual point positions, with prepared covariance clouds behind them. The 170-element count is a DOM bound, not a guarantee of GPU paint cost or frame rate.
