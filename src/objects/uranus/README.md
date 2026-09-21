# Uranus

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

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="uranus-source-and-preparation-record"></a>
<a id="visible-surface-and-observation-lenses"></a>
<a id="rings"></a>
<a id="satellite-source-archive"></a>
<a id="body-orientation-and-charts"></a>
<a id="reproduction"></a>

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
indexed by the Sun's direction in view and shared by every lens. It keeps the
earlier material's ambient level and softer terminator but carries no
atmospheric-limb correction. The browser only selects and transports these products.

</details>
