# Neptune

Neptune is shown as a Hubble OPAL global map on the shared sphere, with methane and near-infrared views, nine dated maps and its rings.

The [navigation marker](source/preparation/navigation.json) retains its existing source-map crop and silhouette, with the shared prepared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not an observer projection or illumination at the scene epoch.

## Sources

- The visible-colour globe is the 2025 Hubble OPAL Cycle 32 colour global map, assembled by the OPAL team from WFC3/UVIS F467M, F547M and F657N exposures. The methane dataset uses the matching FQ619N global map and the near-infrared dataset F845M. The products and the OPAL readme are in `source/opal/`.
- The OPAL readme says the TIFF is arbitrarily scaled and contrast enhanced, so its colours are calibrated against the 2024 Irwin et al. true-colour Neptune reconstruction distributed by the Royal Astronomical Society. The reference is committed under `source/color/` with CC BY 4.0 attribution.
- The radii are 24,764 km equatorial and 24,341 km polar (IAU 2015 report values), the same the OPAL readme gives for its limb fits.
- JPL Solar System Dynamics discovery, mean-elements and physical-parameter tables supply the 16-moon catalog. The PDS Rings Node Neptune table supplies the ring radii and widths, including the Adams ring at 62,933 km.
- Two panel charts come from the committed NASA GSFC Planetary Spectrum Generator configuration and raw I/F response; the third uses the pinned photometric phase coefficients. Panel prose and facts come from the committed NASA Science `Neptune: Facts` snapshot.
- The dated maps are listed under [Hubble dates](#hubble-dates).

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

Preparation matches the mean and channel variation of a checked equatorial OPAL sample to the unobscured centre of the Irwin et al. reconstruction. The browser does not parse FITS, TIFF or the calibration reference.

Each dataset is mapped across 722 surface leaves on the shared sphere lane: 720 longitude-latitude cells and two polar caps. The orientation is solved from Neptune's pole and rotation at the scene epoch. Lighting is one 256-frame bank shared by every dataset. Each frame puts back the limb darkening OPAL removed from the colour map, with the 2025b readme's Minnaert coefficients: k 0.50 in F657N, 0.80 in F547M and 0.88 in F467M ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). No floor, ambient term or terminator ramp remains.

The rings are 16 wedges drawn from the ring recipe, the Adams arcs included, each starting outside the planet so the planet hides their far side.

## Hubble dates

The dataset stepper selects 9 dated [OPAL](https://archive.stsci.edu/hlsp/opal) visible-colour maps, one rotation from each observing cycle, so no weather is averaged across rotations.

| Observation starts (UTC) | Rotation | Release | Source pixels |
| --- | --- | --- | --- |
| 2017-10-06 | 2017a | [Cycle 24](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-24) | 721 × 361 |
| 2018-09-09 | 2018a | [Cycle 25](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-25) | 721 × 361 |
| 2019-09-28 | 2019a | [Cycle 26](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-26) | 721 × 361 |
| 2020-08-19 | 2020a | [Cycle 27](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-27) | 721 × 361 |
| 2021-09-06 | 2021a | [Cycle 28](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-28) | 721 × 361 |
| 2022-09-18 | 2022a | [Cycle 29](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-29) | 721 × 361 |
| 2023-09-22 | 2023a | [Cycle 30](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-30) | 721 × 361 |
| 2025-06-28 | 2025a | [Cycle 31](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-31) | 721 × 361 |
| 2025-08-24 | 2025b | [Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-32) | 721 × 361 |

The RGB TIFF and its three component FITS files are recorded in [the source manifest](source/manifest.json) and restored by [the acquisition recipe](source/preparation/acquisition.json). There is no 2024 release. The 2021 FITS headers omit DATE-OBS, so its date comes from the release readme. The 2015–16 maps used a different red coefficient and are deferred.

[The observation recipe](source/preparation/observations.json) removes polar-connected zero fill and unobserved rows before resampling; isolated dark observations stay valid. Missing neighbours never supply colour. The shared gray graticule marks missing coverage, and the date views contain no polar continuation or inpainting.

![Dated OPAL map with the shared sequence controls](evidence/opal-dates-desktop.webp)

## Evidence

- Laid back into the ring plane, the 16 ring wedges match the single ring image they replaced to a mean alpha error of 1.03/255 inside a wedge and 1.30/255 within 2 px of a wedge boundary.
- For every dated map, the TIFF rows correlate with the component FITS rows more strongly in stored order than after a north/south flip. This checks orientation, not colour calibration.

## Known problems

- Neptune's north pole was tilted away from Hubble in 2025. On the pinned OPAL maps coverage ends near 71° N, and the rows below it still carry dark swath edges. Preparation starts the fill where the rows recover, at 57° N for the 619 and 845 nm maps and 41° N for colour, and extends that row toward its longitudinal mean at the pole. The fill supplies no storm or cloud detail.
- The normal pole atlas samples the 720 × 360 OPAL grid directly. This keeps the existing projection and does not recover unobserved polar features.
- The lighting overlay has one colour and alpha per pixel, so its limb law is exact only for the colour map's mean colour. The FQ619N and F845M maps share the colour map's bank, so their limb is not their own law.
- The four Adams arcs are schematic. The Rings Node table lists five arcs (Courage, Liberte, Egalite 1 and 2, Fraternite) but gives only relative spacings, so the drawn arc centres and widths are not measured positions.
- The dated maps are publisher mosaics with contrast enhancement and arbitrary channel scaling, not calibrated colour comparisons between years. The scene camera, Sun and rings do not reproduce the original observing geometry. Publisher seam artifacts inside valid coverage remain.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
