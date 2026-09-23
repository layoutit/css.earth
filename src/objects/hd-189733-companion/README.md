# HD 189733 B

## Sources

HD 189733 B is a red dwarf 11.4 arcseconds from [HD 189733 A](../hd-189733/README.md), the host of the hot Jupiter [HD 189733b](../hd-189733b/README.md). The two stars share their path through space. No image of B's surface exists, and no diameter, limb darkening or rotation axis of it is measured. The package draws it as a sphere of its catalogue radius in the colour of its own measured spectrum.

**Placement.** The position and proper motion are the Gaia DR3 values for source 1827242816176111360, archived in `photometry/gaia-dr3-source.csv` (its [acquisition record](../../sources/gaia-dr3-hd-189733-companion.json), epoch J2016.0). At that epoch B lies 10.31 arcsec west and 4.95 arcsec south of A: 11.44 arcsec at position angle 244°, 226 au across the sky at A's distance. The star is placed at **A's distance**, 19.776 pc. Its own parallax, 50.629 ± 0.014 mas, differs from A's 50.567 ± 0.016 mas by 0.06 mas; taken literally it would put B 5,000 au nearer than A, 20 times their projected separation, although the pair moves together. How far B lies in front of or behind A is not measured, so the true separation is at least 226 au. The radial velocity is A's: B's own Gaia value, 1.5 ± 1.2 km/s, is too uncertain to separate the pair.

**Radius and mass.** 0.224 solar radii and 0.193 solar masses from the TESS Input Catalog v8.2 (TIC 256364937; Stassun et al. 2019, AJ 158, 138), pinned as one VizieR row in [`photometry/tic-8.2.tsv`](source/photometry/tic-8.2.tsv). The catalogue derives both from the star's Ks magnitude and distance with relations calibrated on nearby M dwarfs (Mann et al. 2015, 2019). They are model values, not a measured diameter.

**Colour lens.** Gaia DR3 published a BP/RP spectrum of B too, calibrated to absolute flux and sampled every 2 nm from 336 to 1020 nm, pinned unchanged as `photometry/gaia-dr3-xp-sampled.csv` (same [acquisition record](../../sources/gaia-dr3-hd-189733-companion.json)). The colour is computed as for A ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **255, 201, 123 (#ffc97b)**. B is faint in blue light, and below about 400 nm its samples are within their errors of zero. Moving every sample one standard error down or up, with negative values stopped at zero, moves the blue channel from 121 to 126. The disc is uniform: no limb darkening is measured for this star.

**No orbit is drawn.** No orbit of the pair is published: the 2006 discovery paper says it is "premature to derive specific orbital parameters", and its tentative clockwise, face-on orbit rests on a differential proper motion, −1 ± 5 and −21.2 ± 5 mas/yr, that Gaia has since replaced. Gaia DR3 measures the pair's separation and their relative motion across the sky precisely (−8.98, −3.67 mas/yr, 0.91 km/s at their distance), but not how far apart they lie along the line of sight, and their two published relative radial velocities disagree. Many orbits fit those measurements, so the package draws none. It fits them anyway, once, to record how open the orbit is.

[LOFTI](https://doi.org/10.3847/1538-4357/ab8389) (Pearce et al. 2020, "Orbits for the Impatient"; `lofti_gaia` 2.0.8) fits exactly this case: it draws orbits from its standard priors, scales and rotates each onto the measured separation and position angle, and keeps it with the probability of its fit to the measured relative motion. [`lofti-fit.py`](../../../tools/objects/binary-orbits/lofti-fit.py) runs it on both stars' Gaia DR3 rows with the masses above, and its 300 accepted orbits are kept as evidence in [`reference/lofti-candidate-orbits.txt`](source/reference/lofti-candidate-orbits.txt).

| Quantity | 5th percentile | Median | 95th percentile |
| --- | --- | --- | --- |
| Semi-major axis | 132 AU | 238 AU | 771 AU |
| Period | 1,500 years | 3,700 years | 21,000 years |
| Eccentricity | 0.10 | 0.53 | 0.99 |
| Inclination to the sky | 73.7° | 88.2° | 89.1° |

The one firm result is the inclination: 293 of the 300 orbits lie within 30° of edge-on, because B moves almost straight away from A on the sky, so the orbit plane runs along our line of sight. The size and shape are open by a factor of ten.

An earlier version of this package drew 24 of those orbits, dashed. Each of them puts B at its own distance along the line of sight, which is the measurement the pair lacks, so they open into a fan that says more about the priors than about this pair. They are not drawn: B is drawn where it is measured, at A's distance, with a placed star's marker.

**Axis.** No rotation axis or period is measured. The display axis is celestial north at the star, placed in the plane of the sky ([rotation.json](source/preparation/rotation.json)), a convention.

**Navigation marker.** A uniform disc in the spectrum's colour, rendered by [author.mts](../../../tools/objects/source-authoring/hd-189733/author.mts) (`--check` recomputes it).

**On the map.** B has no surface image and hosts no planet, but its colour comes from its own spectrum. Preparation marks its discovery `sourceColor` ([prepare-object-discovery.mts](../../../tools/prepare/prepare-object-discovery.mts)), and `discoveryVisibility` keeps such a star visible.

**In the system.** The pair is bound: El-Badry, Rix & Heintz (2021, MNRAS 506, 2269) list it in their Gaia EDR3 wide-binary catalogue with a chance-alignment probability of 1.3e-4. B's astrometry record states that with `boundTo`, and preparation carries it into the world context with the pair's **centre of mass**, 19.3% of the way from A to B for masses 0.807 and 0.193 solar, 44 au from A. The system's members come from the prepared orbit chains and that bound pair ([object-systems.mts](../../../site/object-systems.mts)), so B's breadcrumb and card are the system's. It frames nothing: the system view still frames the planet's 0.031 AU orbit, and B's own page keeps its scene until the camera leaves B as well as the system ([overview-selection.mts](../../../site/overview-selection.mts)).

**Zooming out centres the pair.** A system overview normally holds its star at the centre of the view. Once the camera is farther out than the stars are from each other, this one turns onto the pair's centre of mass instead ([prepared-world-navigation.mts](../../../site/prepared-world-navigation.mts)), so A and B sit either side of it as the view widens. Closer in, where the two are not a pair on screen, the mounted star stays the subject.

**Catalogue colour.** the swatch that search, the catalogue and the minimap show is this lens's prepared colour, #ffc97b.

## Evidence

Run of 2026-09-17 (this version): `node tools/prepare/prepare-object.mts hd-189733-companion` prepared the package.

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) reads the pinned XP spectrum and checks the colour 255, 201, 123.
- [`source.test.mts`](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/hd-189733-companion/source.test.mts) verifies the pins and acquisitions, that radius and GM are the catalogue's, that the distance is A's, and that the prepared world positions of A and B are 11.44 arcsec apart as seen from the Sun.
- [`object-discovery.test.mts`](https://github.com/layoutit/css.earth/blob/2d446f36122bfc6c9bff3df5ca57365c3a2ecf90/site/test/object-discovery.test.mts) checks that B is marked `sourceColor` and stays on the map, while Antares and Polaris stay hidden.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the HD 189733 system's members are the planet and B, and that its exit distance scales the Sun's 100 au.
- [`rendered-default-view.png`](source/reference/rendered-default-view.png) is the branch's dev server at `/hd-189733-companion/` in headless Chrome, no console errors.
- Driven in a real browser from the planet outwards (1440 by 900, headless Chrome): where both stars are on screen, the pair's centre of mass sits 2 px from the centre of the view with A 35 px to one side and B to the other, and it stays within 1 px of the centre as the view widens further. Before this change A sat exactly at the centre and B swept in from the corner.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ffc97b is the colour lens's prepared colour.

## Known problems

**Depth unknown.** The pair's separation along the line of sight is not measured; B is placed at A's distance, and the fitted orbits disagree about it by hundreds of AU. The centre of mass the camera aims at is therefore a projected centre, exact across the sky and unmeasured along the line of sight.

**The orbit's size is open.** The fitted orbits span a factor of ten in size and period, which is why none is drawn.

**The radial velocities disagree.** Bakos et al. (2006) measured B − A = −0.72 ± 1.02 km/s, which a bound orbit allows; Gaia DR3's rows give +3.99 ± 1.21 km/s, which is faster than A's gravity can hold at this separation. The fit uses neither, only the astrometry both agree with. A fit with the 2006 value gives the same picture: semi-major axis 134 to 1,217 AU, period 1,556 to 42,454 years, and 295 of its 300 orbits within 30° of edge-on.

**No image, diameter, limb darkening or axis.** At 19.8 pc B's disc would be about 0.1 mas across, and no measurement of any of these exists.

**The size is a catalogue estimate.** The radius comes from a magnitude–radius relation for M dwarfs, not from the star itself.

**The blue end of the spectrum is noise.** Below about 400 nm B's samples are within their errors of zero. They carry little weight in the colour, which the one-sigma test above bounds.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
