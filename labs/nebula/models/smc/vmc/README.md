# SMC red-clump observations

See [the tubular-shape diagnostic and next inference steps](STRUCTURE-LIMITS.md) before interpreting this as physical structure.

This experimental density input uses 489,760 distinct red-clump tracers. Their sky positions are observed; their line-of-sight distances are standard-candle estimates. It does not use the earlier simulation or image-fitting transform.

The [pinned receipt](crossmatch-receipt.json) connects the public [Tatton et al. 2021 reddening catalogue](https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/504/2983/ReadMe) to ESO's public VMC DR5.1 PSF photometry. Of 561,813 published entries, 510,131 have an unambiguous counterpart within 0.5 arcsec; 5,440 have none within that radius and 46,242 have competing matches too close to distinguish. Matching separates the nearest and second distinct PSF source by at least 0.05 arcsec. Median separation is 0.092 arcsec and its 90th percentile is 0.169 arcsec.

All matched measurements are preserved. For density, repeated PSF IDs and cross-tile pairs within 0.3 arcsec form groups; the member with the smallest Ks uncertainty is retained. This removes 20,371 repeated measurements. Close pairs unresolved by this rule remain a limitation. Completeness and quality columns remain available; this is a selected tracer density, not stellar mass density.

## Distance calculation and limits

[Tatton et al.](https://doi.org/10.1093/mnras/staa3857), sections 3.3 and 5.2, supply the calculation: `Ks0 = Ks - 0.443 max(E(Y-Ks), 0)`, then `distanceKpc = 61 × 10^((Ks0 - 17.304)/5)`. The individual published reddening is used, not the spatially smoothed reddening.

This is not an exact reproduction of the paper's distance catalogue. [ESO DR5.1 release documentation](https://www.eso.org/rm/api/v1/public/releaseDescriptions/155), page 4, describes recalibration of the earlier PSF magnitudes onto CASU 1.5. Mean shifts are −0.007 mag in Ks and −0.022 mag in Y−Ks, with tile scatter 0.008 and 0.018 mag respectively. Individual original Ks offsets are not supplied. Public Ks measurements are used unchanged with the published reddening; the colour-offset diagnostics never alter distances.

The distance distribution includes intrinsic red-clump luminosity scatter, photometric errors, reddening uncertainty and population contamination. It has not been deconvolved into true geometric depth. Survey footprint, original selection and unmatched sources affect the inferred distribution. No image placement, cloud-size fitting, nonlinear warping or tidal-tail truncation is applied.

## Reproduction

From the repository root, install the dependencies, acquire the preserved CDS input, fetch the bounded 27-tile ESO selection, match and deduplicate. Large inputs and TSV outputs remain in the ignored local directory; source hashes and counts are in the receipt.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm -r --filter "./packages/**" build
mkdir -p .local/nebula-lab/smc-vmc
curl --fail --location https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/504/2983/rcsmcext.dat.gz --output .local/nebula-lab/smc-vmc/rcsmcext.dat.gz
node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/acquire-vmc-psf.ts
node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/prepare-vmc-red-clump.ts
node --experimental-strip-types labs/nebula/packages/lab/src/cli/commands/deduplicate-vmc-red-clump.ts
node labs/nebula/run.mts prepare-catalogue-density labs/nebula/models/smc/vmc/density.json
node labs/nebula/run.mts test catalogue-position red-clump-distance
pnpm lab:nebula
```

Formula tests cover the reference distance, reddening correction, negative-reddening floor and invalid values. Matching tests reject close ties and separations outside the search radius. The selected magnitudes (Ks 16–19, Y−Ks 0.4–1.4) bound acquisition rather than asserting a physical edge.

## Inspect the observed density

Open `/alignment?subject=smc-vmc`, select a registered SMC image, enable **Density overlay**, and use **Earth view**. The catalogue is a separate **SMC · VMC observed** workspace; the previous simulation and cached processing remain available. Image placement is unchanged. The same original physical sky frame is a coordinate basis only: simulation particles and the rejected fitted scale/rotation do not enter this bake.

The neutral volume includes every retained tracer. Unit-weighted deposition gives relative tracer number density, with a two-million-voxel budget, isotropic offline smoothing and 48 slabs per axis. Display exposure is authored; it does not change positions or distances. Stepped outer boundaries are the survey footprint. Sparse extreme photometric distances remain present and enlarge the full bounds; they are not evidence for an equally large physical nebula. The default Earth-view framing focuses on the SMC; **Fit** includes all bounds.

This is an observational-structure trial, not an accepted gas/dust reconstruction or a newly painted material. No image extrusion or new star-removal run is performed. Next compare independent tracer populations and distance uncertainties before assigning the photographed dust to this stellar distribution.
