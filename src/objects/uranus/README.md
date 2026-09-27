# Uranus

The [navigation marker recipe](source/preparation/navigation.json) retains the existing credited image and crop, then prepares a circular alpha edge so the photographic background cannot cover surrounding objects. The same silhouette is used by its larger context image where configured.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

The visible-color surface is the rotation-A global map from
[Hubble OPAL Uranus Cycle 33](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33),
observed in October 2025. The checked composite combines F467M, F547M, and
F657N; the OPAL readme says its color maps carry "slight contrast
enhancement". FQ727N and F845M FITS maps supply two separately prepared false-color
observation lenses. Their palettes and percentile stretches are declared in
`source/preparation/observations.json`; no browser filtering is used.

Ring radii, widths, and normal optical depths come from the
[PDS Rings Node Uranus table](https://pds-rings.seti.org/uranus/uranus_rings_table.html).
The table gives the Epsilon ring's optical depth as "0.5 to 2.3"; the recipe's
1.4 is the midpoint of that range, chosen for display.
Preparation verifies the table labels and measurements before drawing the
rings straight from the recipe as 16 wedges in one atlas at the canonical
density. Each wedge starts outside the planet, so the planet hides the rings'
far side; a single square through the planet let the browser draw that side
over the disc. The physical center radii are kept in the authored
`source/preparation/rings.json` recipe. Extremely narrow rings receive a recorded minimum-pixel presentation
width so they remain visible at the accepted Saturn composition; their radii
and ordering are not moved. NASA's public Uranus facts supply the documented
gray inner-ring, reddish Nu, and blue Mu color interpretation. The planet's
shadow on the rings is not drawn: at the scene epoch the Sun stands 73° above
the ring plane, so the shadow reaches 1.05 Uranus radii from the center, short
of the innermost ring at 1.48.

The reflectance and temperature-pressure charts are rendered at preparation time from the checked NASA
GSFC Planetary Spectrum Generator configuration and raw 253-sample I/F
response. Acquisition removes only PSG's request timestamp and elapsed-time
comments so the checked scientific rows are reproducible. The model date is
2026-08-30 12:00, range 0.35-1.0 micrometers, and
resolving power 240. The temperature-pressure panel is extracted from the same
checked expanded atmosphere configuration. A third chart uses the pinned
photometric phase coefficients in `source/photometry/phase.json`.

## Evidence

- **Shared sphere lane, 19 September 2026:** the orientation is solved from the
  pole and rotation; the hand-typed rotations were 159.9° from it. In the
  default view at the scene epoch, rendered headless after the page settled, the
  rings' far side no longer shows over the disc. Laid back into the ring plane,
  the 16 ring wedges match the single ring image they replace to a mean alpha
  error of 1.20/255 inside a wedge and 2.52/255 within 2 px of a wedge
  boundary. The package tests left from the earlier lane are retired and the
  rest pass. [Before and after](evidence/shared-lane-before-after.webp).

## Known problems

The OPAL map contains observed northern coverage and an unobserved black
southern region. Preparation detects the non-black edge, then conservatively
ends the usable observation six rows north of the map equator so resampling at
the coverage fringe cannot become a fabricated feature. The checked NASA/JPL
Voyager 2 PIA18182 full-disc observation supplies a central-disc chromatic
baseline for the visible-color map. OPAL detail is feathered into that uniform
baseline across twelve prepared rows. The single-filter lenses use the
observed-disc mean from their own checked FITS products as their uniform
unobserved-area baseline. No local feature is reflected, extended, or invented
outside the observed OPAL coverage.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="uranus-source-and-preparation-record"></a>
<a id="visible-surface-and-observation-lenses"></a>
<a id="rings"></a>
<a id="satellite-source-archive"></a>
<a id="body-orientation-and-charts"></a>
<a id="reproduction"></a>

The lighting overlay has one colour and alpha per pixel, so its per-channel limb law is exact for the colour map's mean colour and approximate for colours far from it ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). The FQ727N and F845M lenses share the colour map's bank; OPAL applied no Minnaert correction to those two maps, so their limb is not their own law.

<details>
<summary>Methods and source notes</summary>

**Visible surface and observation lenses**

The checked [Webb NIRCam Uranus portrait](https://science.nasa.gov/asset/webb/uranus-nircam-image/)
is a visual-composition reference only. It is not sampled into the runtime
surface. The navigation disc is an adapter-owned exact copy of the already
accepted NASA/JPL PIA18182 Uranus source. The same exact bytes bind the
featureless visible-color baseline described above. Its generic marker recipe
preserves the frozen shared atlas bytes when Uranus changes from planned to
implemented.

**Satellite source archive**

The source records retain the selected JPL values for the 29-satellite
catalog. The NASA/JPL PIA01361 Voyager 2 montage remains pinned scientific
source material, including its disclosed incomplete Miranda and Ariel coverage.
These sources are preserved; they are not active embedded-moon render inputs.
The shared runtime mounts exactly one detailed object scene. Historical moon
billboards and orbit-guide derivations are excluded from its consumer-derived
asset inventory, with the exact retired filenames recorded in `object.json`.
The source snapshots and dated editorial facts have not been rewritten.

**Body, orientation, and charts**

The equatorial and polar radii, 97.77 degree axial tilt, retrograde rotation,
distance, day, year, temperature, winds, and ring count are checked against
[NASA Uranus facts](https://science.nasa.gov/uranus/facts/) and the checked JPL
physical-parameter page. The body is drawn on the shared sphere lane: 1,058
surface leaves, 1,056 longitude-latitude cells and two polar caps, from the
source-color equirectangular and polar atlases prepared at DPR 1 and DPR 2.
Its orientation is solved from its pole and rotation at the scene epoch, so the
face toward the camera is the one Uranus turns to it then; the hand-typed
rotations it replaced were about 160° off. Lighting is one 256-frame bank
indexed by the Sun's direction in view and shared by every lens. Each frame puts
back the limb darkening OPAL removed from the colour map, with the README's own
Minnaert coefficients: k 0.57 in F657N, 0.80 in F547M and 0.85 in F467M
([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). Red barely darkens toward the limb while green and blue do, so the
limb turns grey-red as Hubble saw it. No floor, ambient term or terminator ramp
remains. The browser only selects and transports these products.

</details>

## Hubble dates

The existing dataset stepper now selects 12 dated [OPAL](https://archive.stsci.edu/hlsp/opal) visible-colour maps. One rotation is selected from each included observing cycle, preserving one observation instead of averaging weather from separate rotations. The opening Visible color view remains the established presentation.

| Observation starts (UTC) | Rotation | Release | Source pixels |
| --- | --- | --- | --- |
| 2014-11-08 | 2014a | [Cycle 22](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-22) | 721 × 361 |
| 2015-09-12 | 2015a | [Cycle 23](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-23) | 721 × 361 |
| 2016-09-29 | 2016a | [Cycle 24](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-24) | 721 × 361 |
| 2017-10-25 | 2017a | [Cycle 25](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-25) | 721 × 361 |
| 2018-11-16 | 2018a | [Cycle 26](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-26) | 721 × 361 |
| 2019-11-18 | 2019a | [Cycle 27](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-27) | 721 × 361 |
| 2020-10-08 | 2020a | [Cycle 28](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-28) | 721 × 361 |
| 2021-12-08 | 2021a | [Cycle 29](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-29) | 721 × 361 |
| 2022-11-09 | 2022a | [Cycle 30](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-30) | 721 × 361 |
| 2023-09-17 | 2023a | [Cycle 31](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-31) | 721 × 361 |
| 2024-11-09 | 2024a | [Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-32) | 721 × 361 |
| 2025-10-23 | 2025a | [Cycle 33](https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33) | 721 × 361 |

The RGB TIFF and its three component FITS files are recorded in [the source manifest](source/manifest.json) and restored by [the acquisition recipe](source/preparation/acquisition.json). These are publisher mosaics with contrast enhancement and arbitrary channel scaling, not calibrated colour comparisons between years. Each date combines exposures over a rotation, and the scene camera, Sun and rings do not reproduce the original observing geometry.

The Cycle 22–28 READMEs place east longitude 0° at the left and increase it to the right. Cycles 29–33 place 0° at the right and increase it to the left. Preparation reverses the earlier columns, including the component validity masks, into the existing Cycle 33 surface frame. The 721-column maps include the repeated 360° endpoint. Their planetographic rows are sampled onto the unchanged 25,559 / 24,973 km ellipsoid. The three published Minnaert coefficients remain 0.57 / 0.80 / 0.85 across the selected releases (2014 uses F658N for red; later maps use F657N), so the dates share the existing lighting bank.

[The observation recipe](source/preparation/observations.json) intersects finite component coverage and polar-connected zero fill before resampling; isolated dark observations remain valid. Declared fully unobserved rows also seed connected gaps. Missing neighbours never supply colour during interpolation. The shared gray graticule marks missing coverage in the surface, pole tiles and previews; the date views contain no polar continuation or feature inpainting. Publisher seam interpolation and edge artifacts inside valid coverage remain part of the source.

The existing observed-surface preparer writes these maps for the body's current texture layout, using the shared Jupiter coverage helpers. It remaps planetographic latitude, packs the retained bands and projects the pole tiles at preparation time. The browser selects prepared files through the existing date group; it does not interpret FITS, derive imagery or replace the mounted scene.

Source inspection compared the TIFF rows with the component FITS rows; all selected maps correlate more strongly in stored row order than after a north/south flip. This checks orientation, not absolute colour calibration. The unit check exercises component-mask intersection, a connected interior ring gap, retained isolated zero samples and longitude reversal. Browser and delivery evidence for this change is recorded below.
