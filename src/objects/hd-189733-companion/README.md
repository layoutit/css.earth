# HD 189733 B

## Sources

HD 189733 B is a red dwarf 11.4 arcseconds from [HD 189733 A](../hd-189733/README.md), the host of the hot Jupiter [HD 189733b](../hd-189733b/README.md). The two stars share their path through space. No image of B's surface exists, and no diameter, limb darkening or rotation axis of it is measured. The package draws it as a sphere of its catalogue radius in the colour of its own measured spectrum.

**Placement.** The position and proper motion are the Gaia DR3 values for source 1827242816176111360, archived in [`photometry/gaia-dr3-source.csv`](source/photometry/gaia-dr3-source.csv) (epoch J2016.0). At that epoch B lies 10.31 arcsec west and 4.95 arcsec south of A: 11.44 arcsec at position angle 244°, 226 au across the sky at A's distance. The star is placed at **A's distance**, 19.776 pc. Its own parallax, 50.629 ± 0.014 mas, differs from A's 50.567 ± 0.016 mas by 0.06 mas; taken literally it would put B 5,000 au nearer than A, 20 times their projected separation, although the pair moves together. How far B lies in front of or behind A is not measured, so the true separation is at least 226 au. The radial velocity is A's: B's own Gaia value, 1.5 ± 1.2 km/s, is too uncertain to separate the pair.

**Radius and mass.** 0.224 solar radii and 0.193 solar masses from the TESS Input Catalog v8.2 (TIC 256364937; Stassun et al. 2019, AJ 158, 138), pinned as one VizieR row in [`photometry/tic-8.2.tsv`](source/photometry/tic-8.2.tsv). The catalogue derives both from the star's Ks magnitude and distance with relations calibrated on nearby M dwarfs (Mann et al. 2015, 2019). They are model values, not a measured diameter.

**Colour lens.** Gaia DR3 published a BP/RP spectrum of B too, calibrated to absolute flux and sampled every 2 nm from 336 to 1020 nm, pinned unchanged as [`photometry/gaia-dr3-xp-sampled.csv`](source/photometry/gaia-dr3-xp-sampled.csv). The colour is computed as for A ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **255, 201, 123 (#ffc97b)**. B is faint in blue light, and below about 400 nm its samples are within their errors of zero. Moving every sample one standard error down or up, with negative values stopped at zero, moves the blue channel from 121 to 126. The disc is uniform: no limb darkening is measured for this star.

**Axis.** No rotation axis or period is measured. The display axis is celestial north at the star, placed in the plane of the sky ([rotation.json](source/preparation/rotation.json)), a convention.

**Navigation marker.** A uniform disc in the spectrum's colour, rendered by [author.mts](../../../tools/objects/source-authoring/hd-189733/author.mts) (`--check` recomputes it).

**On the map.** B has no surface image and hosts no planet, but its colour comes from its own spectrum. Preparation marks its discovery `sourceColor` ([prepare-object-discovery.mts](../../../tools/prepare-object-discovery.mts)), and `discoveryVisibility` keeps such a star visible.

## Evidence

Run of 2026-09-17 (this version): `node tools/prepare-object.mts hd-189733-companion` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the pinned XP spectrum and checks the colour 255, 201, 123.
- [`source.test.mts`](../../../tests/objects/unit/hd-189733-companion/source.test.mts) verifies the pins and acquisitions, that radius and GM are the catalogue's, that the distance is A's, and that the prepared world positions of A and B are 11.44 arcsec apart as seen from the Sun.
- [`object-discovery.test.mts`](../../../site/test/object-discovery.test.mts) checks that B is marked `sourceColor` and stays on the map, while Antares and Polaris stay hidden.

## Known problems

**Depth unknown.** The pair's separation along the line of sight is not measured; B is placed at A's distance.

**No image, diameter, limb darkening or axis.** At 19.8 pc B's disc would be about 0.1 mas across, and no measurement of any of these exists.

**The size is a catalogue estimate.** The radius comes from a magnitude–radius relation for M dwarfs, not from the star itself.

**The blue end of the spectrum is noise.** Below about 400 nm B's samples are within their errors of zero. They carry little weight in the colour, which the one-sigma test above bounds.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
