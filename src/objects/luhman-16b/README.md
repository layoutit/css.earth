# Luhman 16 B

## Sources

Luhman 16 B is a brown dwarf, a failed star of 29.4 Jupiter masses, 2 parsecs from the Sun. With [Luhman 16 A](../luhman-16/README.md) it is the nearest known pair of brown dwarfs. Crossfield et al. (2014, Nature 505, 654) watched it spin for five hours with VLT/CRIRES and made the first map of a brown dwarf's clouds from how its spectral lines shifted as bright and dark patches crossed the disc (Doppler imaging). Ureshino et al. (2026, [arXiv:2605.08544](https://arxiv.org/abs/2605.08544)) refit those spectra with a fully Bayesian method that also gives each point's uncertainty. Their frozen release, [Zenodo 10.5281/zenodo.20024778](https://zenodo.org/records/20024778) (MIT), holds the maps; this package reads them unchanged.

**The lenses.**
- **Brightness.** The posterior mean map: relative surface brightness in the CO band head at 2.30 to 2.32 µm (CRIRES chip 2). The scale is inferno from the darkest to the brightest pixel, 0.00642 to 0.00902, as the paper's figure draws it.
- **Uncertainty.** The square root of the posterior variance map: one standard deviation at each point, 0.00123 to 0.00161, in viridis as in the paper.

The maps are HEALPix vectors of 768 pixels (NSIDE 8, RING order). [healpix-map.mts](../../../tools/objects/terrestrial-layers/healpix-map.mts) interpolates between pixel centres with astropy-healpix's bilinear interpolation. Every pixel centre keeps its deposited value and no point goes beyond its neighbours, so the pixel grid's edges disappear without inventing structure or lowering contrast. The paper's healpy figure draws the same pixels as flat tiles. In the authors' code the observer looks along +x, the spin is about +z, and a point's HEALPix longitude grows in the direction of rotation. So their longitude is this package's east longitude, and their pole is north.

**Spin.** The same fit gives the axis's tilt to the line of sight, 61.0 +14.3/−12.3°, and a rotation period of 4.828 h. The tilt is used; the axis's direction on the sky is unmeasured and set toward celestial north. The period is too uncertain to phase the map to today, so longitude 0 faces the Sun as a display convention.

**Orbit.** B circles A on the orbit of Bedin et al. (2024, Astronomische Nachrichten 345, e20230158), Table 2 data-fit column: period 26.55 yr, a = 3.52 au, e = 0.344, periastron at 2018.060. Their angles are measured in a sky frame mirrored about the north-west diagonal. The record stores i' = 180° − 79.92° and Ω' = 270° − 130.02°, with ω = 136.67° unchanged. Radius 1.02 Jupiter radii and temperature 1,261 K are from Filippazzo et al. (2015).

**Catalogue colour.** #ff5b00, the star field's colour for 1,261 K, as for every star.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places B from A at the six GeMS epochs of Garcia et al. (2017, Table 3), which Bedin et al. did not fit. It matches them to 2.6 mas rms against a 1,100 mas separation; without the angle mapping it misses by 248 mas. At the three CRIRES epochs (Garcia et al., Table 4) it gives A − B radial velocities of 2,448, 1,752 and 1,707 m/s against 2,740, 1,940 and 1,850 ± 200. The mirror-image orbit, which fits the positions as well, gives the opposite sign.
- [`healpix-map.test.mts`](../../../tools/objects/terrestrial-layers/healpix-map.test.mts) checks the reader against HEALPix pixel centres in RING and NESTED order, that bilinear interpolation keeps pixel centres and never leaves the deposited range, and that the deposited map's dark region and bright northern region lie where the paper's figure shows them.
- [`luhman-16-default-views.png`](evidence/luhman-16-default-views.png): Luhman 16 A, Luhman 16 B's Brightness (its default) and its Uncertainty on this branch's dev server, headless Chrome at 1440 × 900 after the page reported ready.
- The reader was compared with the paper's own posterior-mean figure (healpy Mollweide, east to the right): 62,113 figure pixels decoded through the inferno colour map, against this package's value at the same longitude and latitude. Correlation 0.94, median difference 1.4 × 10⁻⁵ (0.5 % of the range); with longitude mirrored, correlation 0.26. The figure is not redistributed here, so this comparison is a one-off check, not a committed test.

## Known problems

- **The features are shallow.** One standard deviation is about half of the whole brightness range, so the dark and bright patches are one to two sigma deep. Look at Uncertainty before reading small patches.
- **Latitudes are weakly measured.** Doppler imaging has limited sensitivity to latitude, as the paper's own synthetic tests show, so the brightest pixels at 48° N are the least certain in position.
- **The weather changes.** Brown dwarf clouds evolve in about a day (Crossfield et al. 2014). The map is the surface during the one night of CRIRES spectra in 2013, not of today.
- **One band.** Only CRIRES chip 2 is mapped ([ledger](investigations.json)). The JWST NIRSpec maps of Wang et al. (2026) are not yet released.
- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions. The dwarf is drawn as a sphere, though its fast spin flattens it slightly.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
