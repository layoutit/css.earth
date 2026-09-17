# HD 189733 B

## Sources

HD 189733 B is a red dwarf 11.4 arcseconds from [HD 189733 A](../hd-189733/README.md), the host of the hot Jupiter [HD 189733b](../hd-189733b/README.md). The two stars share their path through space. No image of B's surface exists, and no diameter, limb darkening or rotation axis of it is measured. The package draws it as a sphere of its catalogue radius in the colour of its own measured spectrum.

**Placement.** The position and proper motion are the Gaia DR3 values for source 1827242816176111360, archived in [`photometry/gaia-dr3-source.csv`](source/photometry/gaia-dr3-source.csv) (epoch J2016.0). At that epoch B lies 10.31 arcsec west and 4.95 arcsec south of A: 11.44 arcsec at position angle 244°, 226 au across the sky at A's distance. The star is placed at **A's distance**, 19.776 pc. Its own parallax, 50.629 ± 0.014 mas, differs from A's 50.567 ± 0.016 mas by 0.06 mas; taken literally it would put B 5,000 au nearer than A, 20 times their projected separation, although the pair moves together. How far B lies in front of or behind A is not measured, so the true separation is at least 226 au. The radial velocity is A's: B's own Gaia value, 1.5 ± 1.2 km/s, is too uncertain to separate the pair.

**Radius and mass.** 0.224 solar radii and 0.193 solar masses from the TESS Input Catalog v8.2 (TIC 256364937; Stassun et al. 2019, AJ 158, 138), pinned as one VizieR row in [`photometry/tic-8.2.tsv`](source/photometry/tic-8.2.tsv). The catalogue derives both from the star's Ks magnitude and distance with relations calibrated on nearby M dwarfs (Mann et al. 2015, 2019). They are model values, not a measured diameter.

**Colour lens.** Gaia DR3 published a BP/RP spectrum of B too, calibrated to absolute flux and sampled every 2 nm from 336 to 1020 nm, pinned unchanged as [`photometry/gaia-dr3-xp-sampled.csv`](source/photometry/gaia-dr3-xp-sampled.csv). The colour is computed as for A ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **255, 201, 123 (#ffc97b)**. B is faint in blue light, and below about 400 nm its samples are within their errors of zero. Moving every sample one standard error down or up, with negative values stopped at zero, moves the blue channel from 121 to 126. The disc is uniform: no limb darkening is measured for this star.

**Candidate orbits.** No orbit of the pair is published: the 2006 discovery paper says it is "premature to derive specific orbital parameters", and its tentative clockwise, face-on orbit rests on a differential proper motion, −1 ± 5 and −21.2 ± 5 mas/yr, that Gaia has since replaced. Gaia DR3 measures the pair's separation and their relative motion across the sky precisely (−8.98, −3.67 mas/yr, 0.91 km/s at their distance), but not how far apart they lie along the line of sight, and their two published relative radial velocities disagree. Many orbits fit those measurements, so the package draws a sample of them rather than choosing one.

[LOFTI](https://doi.org/10.3847/1538-4357/ab8389) (Pearce et al. 2020, "Orbits for the Impatient"; `lofti_gaia` 2.0.8) fits exactly this case: it draws orbits from its standard priors, scales and rotates each onto the measured separation and position angle, and keeps it with the probability of its fit to the measured relative motion. [`lofti-fit.py`](../../../tools/objects/binary-orbits/lofti-fit.py) runs it on both stars' Gaia DR3 rows with the masses above, and its 300 accepted orbits are pinned as [`orbits/lofti-astrometry-only.txt`](source/orbits/lofti-astrometry-only.txt). The first 24 are drawn ([`orbit-family.json`](source/orbits/orbit-family.json)); LOFTI's samples are independent, so those are a sample of the fit, not a choice among its orbits.

| Quantity | 5th percentile | Median | 95th percentile |
| --- | --- | --- | --- |
| Semi-major axis | 132 AU | 238 AU | 771 AU |
| Period | 1,500 years | 3,700 years | 21,000 years |
| Eccentricity | 0.10 | 0.53 | 0.99 |
| Inclination to the sky | 73.7° | 88.2° | 89.1° |

The one firm result is the inclination: 293 of the 300 orbits lie within 30° of edge-on, because B moves almost straight away from A on the sky, so the orbit plane runs along our line of sight. The size and shape are open by a factor of ten.

**How they are drawn.** [binary-orbit-family.mts](../../../tools/objects/binary-orbit-family.mts) turns each fitted orbit into a path around HD 189733 A in the scene's frame. Each candidate puts B at its own distance along the line of sight, which is the measurement the pair lacks, so no candidate passes through B's drawn position: B is drawn where it is measured, at A's distance. From Earth's direction the paths all cross B's place on the sky; from any other angle they open into a fan. The world context carries them as a body's `additionalOrbits` ([spatial-context.ts](../../../src/preparation/spatial-context.ts)), drawn dashed and faint, and only once the whole family fits the view, so they never cross the planet's own system.

**Axis.** No rotation axis or period is measured. The display axis is celestial north at the star, placed in the plane of the sky ([rotation.json](source/preparation/rotation.json)), a convention.

**Navigation marker.** A uniform disc in the spectrum's colour, rendered by [author.mts](../../../tools/objects/source-authoring/hd-189733/author.mts) (`--check` recomputes it).

**On the map.** B has no surface image and hosts no planet, but its colour comes from its own spectrum. Preparation marks its discovery `sourceColor` ([prepare-object-discovery.mts](../../../tools/prepare-object-discovery.mts)), and `discoveryVisibility` keeps such a star visible.

**In the system.** B belongs to the HD 189733 system through those candidate orbits: the system's members come from the prepared orbit chains ([object-systems.mts](../../../site/object-systems.mts)), so B's breadcrumb and card are the system's. It frames nothing: a system's framing uses measured orbits, and B's are candidates, so the system view still frames the planet's 0.031 AU orbit. Its own page keeps its scene until the camera leaves B as well as the system ([overview-selection.mts](../../../site/overview-selection.mts)).

## Evidence

Run of 2026-09-17 (this version): `node tools/prepare-object.mts hd-189733-companion` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the pinned XP spectrum and checks the colour 255, 201, 123.
- [`source.test.mts`](../../../tests/objects/unit/hd-189733-companion/source.test.mts) verifies the pins and acquisitions, that radius and GM are the catalogue's, that the distance is A's, and that the prepared world positions of A and B are 11.44 arcsec apart as seen from the Sun.
- [`object-discovery.test.mts`](../../../site/test/object-discovery.test.mts) checks that B is marked `sourceColor` and stays on the map, while Antares and Polaris stay hidden.
- [`binary-orbit-family.test.mts`](../../../tools/objects/binary-orbit-family.test.mts) checks that every drawn candidate reproduces the measured separation and position angle at the fit's epoch (11.4423 arcsec, 244.348°), that they disagree about B's depth, that nearly all are edge-on, and that the reader fails closed on a changed file.
- [`spatial-context.test.ts`](../../../src/preparation/spatial-context.test.ts) checks that a candidate family draws each orbit with its own position while the body keeps its measured one, and refuses a family whose candidates change parent or whose body is placed without an orbit.
- [`prepare-spatial-context.test.ts`](../../../tools/objects/prepare-spatial-context.test.ts) checks the prepared context: B is placed by its own astrometry, its candidates all orbit HD 189733 A, and every other body keeps its ephemeris orbit.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the HD 189733 system's members are the planet and B.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/hd-189733-companion/` in headless Chrome, no console errors.
- [`rendered-candidate-orbits.png`](source/reference/rendered-candidate-orbits.png) is the same page zoomed out to 1,030 au and turned about 50° from the line of sight: the 24 candidate orbits around HD 189733 A, dashed. From the line of sight they overlap on B's measured place; at the planet's scale they are not drawn at all.

## Known problems

**Depth unknown.** The pair's separation along the line of sight is not measured; B is placed at A's distance, and the candidate orbits disagree about it by hundreds of AU.

**The orbit's size is open.** The drawn candidates span a factor of ten in size and period. They are a sample of a fit, not a measured orbit, and a rerun of the fit draws a different sample.

**The radial velocities disagree.** Bakos et al. (2006) measured B − A = −0.72 ± 1.02 km/s, which a bound orbit allows; Gaia DR3's rows give +3.99 ± 1.21 km/s, which is faster than A's gravity can hold at this separation. The fit uses neither, only the astrometry both agree with. A fit with the 2006 value gives the same picture (a 140 to 1,400 AU, 90% of orbits edge-on).

**No image, diameter, limb darkening or axis.** At 19.8 pc B's disc would be about 0.1 mas across, and no measurement of any of these exists.

**The size is a catalogue estimate.** The radius comes from a magnitude–radius relation for M dwarfs, not from the star itself.

**The blue end of the spectrum is noise.** Below about 400 nm B's samples are within their errors of zero. They carry little weight in the colour, which the one-sigma test above bounds.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
