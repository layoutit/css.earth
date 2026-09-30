# HD 189733 B

## Sources

HD 189733 B is a red dwarf 11.4 arcseconds from [HD 189733 A](../hd-189733/README.md), the host of the hot Jupiter [HD 189733b](../hd-189733b/README.md). The two stars share their path through space. No image of B's surface exists, and no diameter, limb darkening or rotation axis of it is measured. The package draws it as a sphere of its catalogue radius in the colour of its own measured spectrum.

**Placement.** The position and proper motion are the Gaia DR3 values for source 1827242816176111360, archived in `photometry/gaia-dr3-source.csv` (its [acquisition record](../../sources/gaia-dr3-hd-189733-companion.json), epoch J2016.0). At that epoch B lies 11.44 arcsec from A at position angle 244°, 226 au across the sky at A's distance. The star is placed at A's distance, 19.776 pc. Its own parallax, 50.629 ± 0.014 mas, differs from A's 50.567 ± 0.016 mas by 0.06 mas; taken literally it would put B 5,000 au nearer than A, although the pair moves together. The radial velocity is A's: B's own Gaia value, 1.5 ± 1.2 km/s, is too uncertain to separate the pair.

**Radius and mass.** 0.224 solar radii and 0.193 solar masses from the TESS Input Catalog v8.2 (TIC 256364937; Stassun et al. 2019, AJ 158, 138), kept as one VizieR row in [`photometry/tic-8.2.tsv`](source/photometry/tic-8.2.tsv). The catalogue derives both from the star's Ks magnitude and distance with relations calibrated on nearby M dwarfs (Mann et al. 2015, 2019). They are model values, not a measured diameter.

**Colour dataset.** Gaia DR3 published a BP/RP spectrum of B, calibrated to absolute flux and sampled every 2 nm from 336 to 1020 nm, kept unchanged as `photometry/gaia-dr3-xp-sampled.csv` (same acquisition record). The colour is computed as for A ([stellar-photometric-color.ts](../../../packages/bake/src/objects/stellar/stellar-photometric-color.ts)): **255, 201, 123 (#ffc97b)**. The catalogue swatch and minimap use the same colour. The disc is uniform: no limb darkening is measured for this star.

**No orbit is drawn.** No orbit of the pair is published: the 2006 discovery paper says it is "premature to derive specific orbital parameters". Gaia DR3 measures the pair's separation and relative motion across the sky precisely (−8.98, −3.67 mas/yr, 0.91 km/s at their distance), but not how far apart they lie along the line of sight. Many orbits fit, so the package draws none. It fits them once, to record how open the orbit is.

[LOFTI](https://doi.org/10.3847/1538-4357/ab8389) (Pearce et al. 2020; `lofti_gaia` 2.0.8) fits orbits to the measured separation, position angle and relative motion. [`lofti-fit.py`](../../../packages/bake/authoring/hd-189733-companion/lofti-fit.py) runs it on both stars' Gaia DR3 rows with the masses above. Its 300 accepted orbits are kept in [`reference/lofti-candidate-orbits.txt`](source/reference/lofti-candidate-orbits.txt).

| Quantity | 5th percentile | Median | 95th percentile |
| --- | --- | --- | --- |
| Semi-major axis | 132 AU | 238 AU | 771 AU |
| Period | 1,500 years | 3,700 years | 21,000 years |
| Eccentricity | 0.10 | 0.53 | 0.99 |
| Inclination to the sky | 73.7° | 88.2° | 89.1° |

The one firm result is the inclination: 293 of the 300 orbits lie within 30° of edge-on, because B moves almost straight away from A on the sky. The size and shape are open by a factor of ten.

**Axis.** No rotation axis or period is measured. The display axis is celestial north at the star, placed in the plane of the sky ([rotation.json](source/preparation/rotation.json)), a convention.

**On the map.** B has no surface image, but its colour comes from its own spectrum, so preparation marks it `sourceColor` ([prepare-object-discovery.mts](../../../site/build/prepare/prepare-object-discovery.mts)) and it stays visible.

**In the system.** The pair is bound: El-Badry, Rix & Heintz (2021, MNRAS 506, 2269) list it in their Gaia EDR3 wide-binary catalogue with a chance-alignment probability of 1.3e-4. Preparation carries the pair's centre of mass into the world context, 19.3% of the way from A to B for masses 0.807 and 0.193 solar, 44 au from A ([object-systems.mts](../../../site/object-systems.mts)). Once the camera is farther out than the stars are from each other, the view turns onto the pair's centre of mass ([prepared-world-navigation.mts](../../../site/prepared-world-navigation.mts)), so A and B sit either side of it as the view widens.

## Evidence

The prepared world positions of A and B are 11.44 arcsec apart as seen from the Sun. In a browser, where both stars are on screen, the pair's centre of mass sits 2 px from the centre of the view with A 35 px to one side and B to the other. [`rendered-default-view.png`](source/reference/rendered-default-view.png) shows the default view at `/hd-189733-companion/`.

## Known problems

**Depth unknown.** The pair's separation along the line of sight is not measured; B is placed at A's distance, and the fitted orbits disagree about it by hundreds of AU. The centre of mass the camera aims at is exact across the sky and unmeasured along the line of sight.

**The orbit's size is open.** The fitted orbits span a factor of ten in size and period, which is why none is drawn.

**The radial velocities disagree.** Bakos et al. (2006) measured B − A = −0.72 ± 1.02 km/s, which a bound orbit allows; Gaia DR3's rows give +3.99 ± 1.21 km/s, which is faster than A's gravity can hold at this separation. The fit uses neither. A fit with the 2006 value gives the same picture: semi-major axis 134 to 1,217 AU, period 1,556 to 42,454 years, and 295 of its 300 orbits within 30° of edge-on.

**No image, diameter or axis.** At 19.8 pc B's disc would be about 0.1 mas across, and no measurement of any of these exists. Its limb darkening is a model: the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,213 K and log g 5.02, both from the same TIC row.

**The size is a catalogue estimate.** The radius comes from a magnitude–radius relation for M dwarfs, not from the star itself.

**The blue end of the spectrum is noise.** Below about 400 nm B's samples are within their errors of zero. Moving every sample one standard error down or up moves the blue channel from 121 to 126.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
