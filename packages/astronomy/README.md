# @cssearth/astronomy

Time scales, float64 vectors and the reference-frame tree behind [cssEarth](https://github.com/layoutit/cssEarth).

Zero dependencies, zero browser globals. Everything here runs in Node, a worker, or the browser.

Maintainers add physical values and retained orbit data in
`data/bodies/<id>.json`. Acquisition choices and source URLs stay with each
record; independent shared vector samples live in `data/fixtures/`.
`pnpm build`, `pnpm test` and `pnpm typecheck` assemble their TypeScript exports
locally. Building needs neither source downloads nor the cssEarth application.

```bash
npm install @cssearth/astronomy
```

```ts
import { FrameTree, fixedFrame, M_PER_AU, M_PER_KM, nowJdTt } from '@cssearth/astronomy'

const frames = new FrameTree()
  .add(fixedFrame('sun', null, M_PER_AU))
  .add({ id: 'earth', parent: 'sun', unitM: M_PER_KM, originInParent: () => [1, 0, 0] })

// Where is the Sun, as seen from Earth's centre, in kilometres?
frames.resolve('earth', { frame: 'sun', offset: [0, 0, 0] }, nowJdTt())
```

The frame tree exists so that absolute world coordinates are never computed: positions are always resolved from one frame into another, keeping the numbers involved comparable in size. See "The frame tree is the whole point" in `AGENTS.md` for why that matters across 26 orders of magnitude.

## Ephemerides

From M2 the package also places the solar system: the eight planets from a
truncated VSOP87A, the Moon from a truncated ELP2000-82B, twenty-nine selected
moons from precessing Keplerian ellipses, IAU rotational elements for the
supported bodies, and a builder that turns all of it into a `FrameTree`.

```ts
import { FrameTree, solarSystemFrames, nowJdTt, bodyRotationAt, bodyFixedToIcrf } from '@cssearth/astronomy'

const frames = new FrameTree()
for (const frame of solarSystemFrames()) frames.add(frame)

// Where is Titan, as seen from Earth's centre, in megametres?
frames.resolve('earth', { frame: 'titan', offset: [0, 0, 0] }, nowJdTt())

// Which way is Mars pointing? (Rotation is NOT part of the frame tree.)
bodyFixedToIcrf(bodyRotationAt('mars', nowJdTt()))
```

Everything returns **ICRF equatorial** axes, because that is what the frame tree
assumes. `eclipticJ2000ToIcrf` and `icrfToEclipticJ2000` exist for the edge —
published tables, Horizons fixtures, a UI that wants ecliptic longitude — and
use the IAU 1976 obliquity of 84381.448 arcseconds, which is the one Horizons
builds its `REF_PLANE='ECLIPTIC'` output on.

### Error budget

Validity window **1900-01-01 to 2100-01-01** for the planets, Moon, and most
satellite fits. Hyperion, Janus, Epimetheus, Atlas, Prometheus, and Pandora use
a **2020-01-01 to 2032-01-01** current-era fit because one precessing ellipse
cannot carry their resonant motion over the full source span. Pan uses
**1950-01-01 to 2050-01-01**, inside its shorter JPL SPK coverage. Each record
exposes its exact fit window and cadence. Outside those windows the numbers
below do not hold.

Each budget is `truncation + theory`. *Truncation* is what this package's
truncation costs, derived at generation time from the coefficients that were
dropped (6 sigma over their independent phases; the generator also samples the
full series to confirm the bound is not optimistic). *Theory* is how far the
**untruncated** series is from JPL Horizons — VSOP87 and ELP2000-82B were fitted
to DE200/LE200 in 1988, and Horizons serves DE441. *Measured* is what the
package actually delivers against the committed Horizons fixtures.

| body | terms | truncation | theory | budget | measured |
|---|---:|---:|---:|---:|---:|
| Mercury | 228 | 373 km | 9 km | 382 km | **58 km** |
| Venus | 272 | 184 km | 17 km | 201 km | **47 km** |
| Earth–Moon barycentre | 431 | 184 km | 19 km | 204 km | **36 km** |
| Mars | 996 | 264 km | 123 km | 387 km | **109 km** |
| Jupiter | 561 | 2 842 km | 1 359 km | 4 201 km | **1 760 km** |
| Saturn | 881 | 5 816 km | 1 870 km | 7 686 km | **2 827 km** |
| Uranus | 661 | 12 496 km | 17 329 km | 29 824 km | **20 197 km** |
| Neptune | 182 | 20 727 km | 48 537 km | 69 263 km | **48 629 km** |
| Moon (geocentric) | 934 | 1.7 km | 2.7 km | 4.4 km | **2.8 km** |

Those are heliocentric positions of each planetary **system barycentre**, which
is what VSOP87 integrates. The planet's own centre is derived from it by
subtracting the moons' mass-weighted offsets: 4671 km for Earth (from
ELP2000-82B, matching Horizons to **33 m**), up to 198 km for Jupiter and 300 km
for Saturn (matching to **0.3 km** and **0.7 km**).

The truncation target was one arcsecond of geocentric direction at each body's
closest approach to Earth. That is met with room to spare for Mercury through
Saturn. It is **not** met for Uranus (1.6") or Neptune (2.3"), and cannot be:
the theory floor alone exceeds an arcsecond for both, because DE441 moved those
two orbits substantially after VSOP87 was fitted.

The Sun's offset from the solar-system barycentre — up to 1.5 million km — is
computed from the planets and the GM table rather than from a separate series,
and matches Horizons to **165 km**. What is missing is everything that is not
one of the eight planets: Pluto, Ceres and the asteroid belt, which Horizons
carries and this does not.

### Moons

The moons are **not** a satellite theory. Each is a precessing Keplerian ellipse
in its own Laplace plane, with elements derived from Horizons' own osculating
elements. Most are sampled every 30 days across 1900–2100; the six current-era
Saturn fits and Pan use a 5-day cadence over their recorded ranges
(`tools/generate-satellites.mts`). What follows is therefore a **fit residual**,
not an independent accuracy claim, measured at six epochs the fit never saw:

| moon | error | of orbit radius | | moon | error | of orbit radius |
|---|---:|---:|---|---|---:|---:|
| Io | 305 km | 0.07 % | | Rhea | 418 km | 0.08 % |
| Dione | 422 km | 0.11 % | | Deimos | 113 km | 0.48 % |
| Europa | 949 km | 0.14 % | | Ariel | 883 km | 0.46 % |
| Titan | 1 962 km | 0.16 % | | Titania | 2 409 km | 0.55 % |
| Umbriel | 580 km | 0.22 % | | Proteus | 684 km | 0.58 % |
| Callisto | 4 428 km | 0.23 % | | Enceladus | 1 916 km | 0.80 % |
| Oberon | 1 380 km | 0.24 % | | **Iapetus** | 59 626 km | **1.6 %** |
| Ganymede | 3 194 km | 0.30 % | | **Miranda** | 3 313 km | **2.5 %** |
| Pan | 7 km | 0.005 % | | **Phoebe** | 640 721 km | **5.0 %** |
| Prometheus | 1 684 km | 1.2 % | | **Telesto** | 17 177 km | **5.8 %** |
| Pandora | 2 582 km | 1.8 % | | **Atlas** | 7 504 km | **5.5 %** |
| | | | | **Hyperion** | 174 839 km | **11.8 %** |
| | | | | **Janus** | 113 344 km | **74.8 %** |
| | | | | **Tethys** | 12 052 km | **4.1 %** |
| | | | | **Triton** | 49 253 km | **13.9 %** |
| | | | | **Phobos** | 1 395 km | **14.7 %** |
| | | | | **Mimas** | 143 729 km | **76 %** |
| | | | | **Epimetheus** | 297 617 km | **197 %** |

The bold rows are beyond what a precessing ellipse can represent. The original
six have known long-period libration or nonlinear precession. The added Saturn
rows include the Janus–Epimetheus co-orbital exchange, the Tethys Trojan
Telesto, Hyperion's resonance, and the perturbed ring moons. Their orbits are
included for the observable Saturn family, but the residuals are reported
rather than disguised as precision.

Every moon is nonetheless at the right **distance** from its planet to within
2 %, and `Frame.maxOffsetInParent` is `a(1 + e)` exactly, so the frame tree's
containment invariant holds regardless.

### Rotation is not in the frame tree

Frames are translation-only and share ICRF axes; a body's spin does not move its
frame origin. `bodyRotationAt` and `bodyFixedToIcrf` are a separate export for
the renderer, implementing the IAU WGCCRE 2015 report for the Sun, the eight
planets, the Moon and the twenty moons.

Twenty-three of the twenty-nine models reproduce the orientation Horizons itself
uses to within 2e-6 degrees. The six that do not, and why:

| body | pole | prime meridian | why |
|---|---:|---:|---|
| Earth | 0.002° | 0.26° | Horizons rotates Earth from UT1 with real precession-nutation; the IAU model is a linear approximation |
| Moon | 0.002° | 0.003° | Horizons uses DE441's integrated libration angles |
| Phobos | 0.31° | 10.4° | Horizons uses MAR097/MAR099, refit after the 2015 report |
| Deimos | 0.07° | 0.82° | same |
| Miranda | 3.5° | 2.6° | URA182 (2025) moved the Uranian satellite poles |
| Triton | 4.2° | 3.7° | NEP097 likewise |
| Umbriel | — | 0.13° | **unexplained**; see `rotation.test.ts` |

Mercury's prime meridian differs by 0.002°. The Sun is the one model with no
independent check: Horizons will not put a body-fixed site on it.

### Frame units

Every frame's `unitM` comes from one rule, applied bottom-up, never chosen per
body. It is the smallest rung of `{1 m, 1 km, 1 Mm, 1 Gm, 1 au, 1 pc}` such that
the frame's eviction ball is at least 20 times its capture ball, every child's
apoapsis fits inside half that eviction ball, and it is strictly coarser than
every child's unit. Out of it falls: metres for Phobos, Deimos, Telesto, Atlas,
and Pan; kilometres for every other moon and for Mercury, Venus, and Mars;
megametres for Earth and the giants; gigametres for the outer planets' system
barycentres; the astronomical unit for the Sun; and the parsec for the SSB.

The factor of 20 is the part that is not forced. `FrameTree.add` would accept 1,
and Phase 1 already learned that a body-centred frame in metres is rejected
outright. But a frame that only just passes `add` puts the camera in a band
where a metre of motion flips its anchor; 20 is the smallest round number that
leaves the anchoring rule's keep-what-you-have tie-break something to keep.

### Regenerating

The series and fixtures are generated, and the generators re-download their
sources into `tools/.cache` (gitignored):

```
node tools/generate-series.mts        # VSOP87A + ELP2000-82B, prints the truncation table
node tools/generate-satellites.mts    # satellite mean elements from Horizons
node tools/fetch-fixtures.mts         # Horizons vector fixtures
node tools/fetch-rotation-fixtures.mts # body-fixed site fixtures for the IAU models
```

Sources: VSOP87A from CDS `VI/81` (Bretagnon & Francou 1988), ELP2000-82B from
CDS `VI/79` (Chapront-Touzé & Chapront 1988, flattened by a port of the
`ELP82B.F` distributed with it), and the satellite data from JPL Horizons plus
JPL Solar System Dynamics' satellite physical-parameters table. Each committed
fixture records the URL that produced it.

## Source size

All source files, tests, tools, and generated code are limited to 600 physical
lines. Run `pnpm lint:packages` from the repository root. Package instructions
live in AGENTS.md; CLAUDE.md links to the same file.

Charon uses the shared Horizons satellite fit over 1900–2100. Its maximum
residual at the six independent vector epochs is 1.021 km (regression guard
2 km); this is a sampled residual, not a universal accuracy bound. The
Pluto-centred child frame uses the same unit/containment rule as other moons.
Pluto's existing heliocentric elements target its centre, not its barycentre.

The DART additions use the same source-fitted conics. Didymos, Kleopatra, and Toutatis have maximum ±30-day heliocentric vector residuals of 131, 241, and 330 km respectively (fitted JD 2461286.5, 2026-09-03). Dimorphos is a satellite of Didymos, fitted over JD 2461256.5–2461316.5 to the post-impact DART s547 relative trajectory; six independent samples measure a maximum 0.054003 km position residual and 3.135% radial residual. Its orbit is strongly perturbed, so this compact 60-day fit is not a long-term satellite theory. Source shape radii describe encounter/reconstruction meshes, not a new post-impact shape measurement.

The four inner Jovian moons use the same Horizons-fitted precessing ellipse.
Amalthea and Thebe use the 1900–2100 fit; Metis and Adrastea use daily samples
over 2020–2032 because their osculating phase cannot be unwrapped at the older
coarse cadence. Independent fixture maximum residuals are 1,267.43 km
(Amalthea), 530.07 km (Thebe), 972.87 km (Adrastea), and 946.81 km (Metis).
These are fit residuals, not measured orbital uncertainties.

The added inner Neptunian moons use daily Horizons element samples over
2020–2032. Maximum residuals at six independent fixture epochs are238km
(Naiad),105km(Thalassa),64km(Despina), and55km(Galatea). These are observed
fit residuals of the shared precessing-ellipse model, not trajectory error bounds.

Comet placement uses Horizons osculating elements at JD 2461286.5 with separate
geometric vector fixtures. Halley (1P, JPL#75) differs by 1.862 mm at that epoch;
the maximum measured discrepancy at ±30 days is 557.99 km, under a 642 km
regression guard and the common 10,000 km nearby-placement budget. This conic
does not model perturbations or outgassing and has no qualified long-term range.
Halley's 4.579 km registry radius describes the volume of the historical Stooke
grid mesh, not a precise observed mean radius. Its display attitude is object-owned.

Borrelly (19P) uses the same epoch and conic API. Independent Horizons vectors
differ by less than 1 mm at the epoch and by 356.11/337.54 km at minus/plus
30 days, below its 410 km regression guard. Its 4 km navigation reference is
half the approximate observed length, not a measured mean radius or volume.
The encounter DEM frame and the estimated gridded completion belong to the
object package; they do not establish a current spin solution.

Nix, Hydra, Kerberos and Styx use daily 2020–2032 element fits about the
Pluto-system barycentre. Their public position/state APIs still return vectors
relative to Pluto's physical centre: the generic `barycentreCompanion` record
adds Charon's mass-weighted displacement to both position and velocity. Frame
bounds include that offset. Independent Pluto-centred fixture maximum residuals
are 94.36 km (Nix), 47.05 km (Hydra), 125.18 km (Kerberos), and 388.06 km
(Styx); regression guards add 15 percent. These describe the compact fit, not observed uncertainties.
Shape orientation is separately authored by each object; no synchronous spin
or current pole/prime-meridian ephemeris is inferred for these moons.


Puck, Portia, Juliet, Belinda, Cordelia and Ophelia use daily 2020–2032
Horizons element fits. Their maximum residuals at six independent epochs are
46.43, 92.47, 119.87, 28.49, 0.46 and 2.02 km, respectively. The displayed
shape radii for the five prolate bodies are volume-equivalent, not the
projected radii reported by the imaging fits. Cordelia and Ophelia use the
ring-dynamics GM estimates from [French et al. (2024), Table 3 footnote b](https://arxiv.org/abs/2401.04634).
A GM of zero for the other four means no mass contribution is modeled; it is
not a measurement of zero mass.

Methone and Pallene use daily 2005–2018 Cassini-era Horizons fits because the
available SAT415 ephemerides stop in January 2018. Maximum residuals at six
independent epochs inside that window are 17,510.67 km and 27.65 km. Their
positions at the application's 2026 epoch are unqualified extrapolations;
those in-window residuals do not bound the later error. Their source-image
camera registration uses the archived acquisition epochs, independently of
the illustrative frozen surface orientation used by the scene.

### Slow longitude libration

Polydeuces, Anthe and Aegaeon retain the shared precessing-ellipse model with
three prepared harmonic terms in mean longitude. `tools/lib/fit-libration.mts`
fits those terms jointly with the linear longitude trend to daily JPL Horizons
samples over 2020–2032. The compact model represents slow resonant motion; it
is not an N-body integration or a qualified extrapolation outside that interval.
Position and velocity evaluate the same phase correction and its derivative.
Worst residuals at the six independent fixture epochs are 940 km, 2030 km and
307 km respectively. These are sampled fit errors, not universal error bounds.

Nereid and Himalia use current-era Horizons fits (2020–2032, five-day sampling).
Nereid’s six independent vector epochs have a maximum position residual of 10,417.20
km (0.19% of the fitted semimajor axis; regression guard 11,980 km). Its zero
modeled GM means its mass is omitted, not physically zero.

Himalia retains the longitude correction and adds ten prepared periodic ICRF
position-residual terms per axis. The common harmonic fitter derives them from
the same Horizons osculating samples, with no trend term and a minimum frequency
separation of one quarter of the fit window’s fundamental frequency. This prevents
nearly identical frequencies from producing enormous cancelling coefficients.
The runtime evaluates the displacement and its analytic derivative; the frame
extent includes the conservative sum-of-amplitudes bound for that displacement.

At the six committed independent epochs, Himalia’s maximum residual falls from
645,823.51 km to **54,960.51 km** (0.48% of semimajor axis; guard 63,205 km), with
maximum angular error 0.2625° and radial residual 0.4460%, inside the common 2%
radial guard again. A separate 37-epoch Horizons check, including points near both
ends of the fit interval and the prepared 2026-09-03 epoch, measures a maximum
85,166.41 km (previously 698,845.15 km) and 0.4141°. These are sampled fit
residuals, not universal bounds or measured orbit uncertainties; the series is
not precision tracking or qualified extrapolation beyond 2020–2032.

Siarnaq and Ymir use the same bounded ICRF correction, with ten terms per axis
and five-day 2020–2032 source samples (Horizons `629`/`619`, centre `500@699`,
`sat456_merged_DE440`, geometric ICRF, KM-D, TDB). Their six independent fixture
maxima fall from 2,621,256.80 / 2,899,606.37 km to 280,355.57 / 161,334.73 km;
regression guards are 322,409 / 185,535 km. A separate 37-epoch check measures
321,402.18 / 231,068.85 km, maximum angular errors 1.6075° / 0.4930°, and radial
errors 1.3217% / 0.8681%, inside the common 2% guard. At the prepared scene epoch
JD 2461286.5 their errors are 65,156.31 / 63,686.55 km (0.1388° / 0.1609°).
These remain approximate previews, with no precision or extrapolation claim.


Kiviuq and Albiorix use source-fitted orbital previews at Horizons targets 624/626
relative to Saturn (500@699), geometric ICRF, KM-D, TDB. Kiviuq uses five-day
samples from 2020-01-01 through the last returned row on 2031-12-29, with ten
bounded residual harmonics per axis. Albiorix uses daily samples through
2032-01-01, a longitude correction and 512 cosine residual terms per axis.
The latter is a truncated DCT-I with an even periodic extension, converted to
the same midpoint-referenced bounded series evaluated by the existing runtime.
Its endpoint velocity is not a measured dynamical solution; no velocity-accuracy
or extrapolation claim accompanies the position checks.

At the six independent committed epochs, maximum position residuals are
28,145.69 / 18,473.58 km (Kiviuq / Albiorix), with regression guards of
32,368 / 21,245 km. Independent additional vector checks, source URLs and
limitations are retained in each body's source/validation/orbit-checks.json.
The generator records actual returned sampling limits, which can precede a
requested stop date when the cadence does not divide the interval exactly.

Use `node tools/generate-satellites.mts --object=kiviuq,albiorix` from this
package to regenerate selected records while preserving the other checked
records. Omitting the selection still runs the complete generator.

### B1: 22 irregular-moon fits and four supported scene states

The 18 added Saturn irregulars and Caliban, Sycorax, Prospero and Setebos use
five-day geometric ICRF Horizons vectors over JD 2458849.5–2463229.5, with the
existing precessing ellipse and 128-term cosine residual per Cartesian axis.
TDB is approximated as TT (difference below 2 ms). Six independent fixtures and
37 additional epochs per moon are retained beside each body in
`source/validation/orbit-checks.json`, including source queries and velocity
residuals. The table reports sampled position residuals; it does not establish a
continuous error bound, accurate endpoint velocity or extrapolation support.
All 22 pass the existing 2% radial guard. Per-body position guards are derived
from the six-fixture maxima with 15% margin, rounded upward.

| Moon | Six-fixture maximum (km) | 37 additional epochs: maximum (km) | Maximum angle (degrees) | Maximum radial residual (%) |
|---|---:|---:|---:|---:|
| paaliaq | 14,686.77 | 52,916.80 | 0.25889 | 0.35637 |
| tarvos | 14,289.47 | 57,180.15 | 0.12165 | 0.13333 |
| ijiraq | 9,349.31 | 61,773.41 | 0.52502 | 0.19177 |
| suttungr | 5,537.39 | 24,033.55 | 0.06710 | 0.07458 |
| mundilfari | 10,946.30 | 50,311.51 | 0.02773 | 0.31897 |
| skathi | 3,135.10 | 33,070.04 | 0.10459 | 0.00894 |
| erriapus | 11,239.64 | 51,119.64 | 0.11175 | 0.28063 |
| thrymr | 6,327.47 | 27,727.05 | 0.05006 | 0.05852 |
| bebhionn | 35,180.27 | 159,023.06 | 0.25958 | 0.91862 |
| bergelmir | 4,370.57 | 31,899.75 | 0.08586 | 0.06437 |
| bestla | 13,244.79 | 64,232.45 | 0.15527 | 0.31731 |
| fornjot | 9,860.75 | 43,840.12 | 0.08126 | 0.06188 |
| hati | 10,819.14 | 48,479.58 | 0.10598 | 0.01159 |
| hyrrokkin | 7,535.37 | 33,350.63 | 0.08212 | 0.02659 |
| loge | 8,681.36 | 38,198.69 | 0.07713 | 0.06348 |
| skoll | 7,169.26 | 47,849.22 | 0.11196 | 0.01217 |
| greip | 9,025.01 | 39,841.08 | 0.09806 | 0.02821 |
| tarqeq | 4,847.56 | 36,578.97 | 0.05821 | 0.15399 |
| caliban | 191.01 | 1,303.96 | 0.00539 | 0.01589 |
| sycorax | 748.30 | 3,898.11 | 0.01032 | 0.02538 |
| prospero | 716.90 | 5,412.57 | 0.01279 | 0.01137 |
| setebos | 2,497.94 | 11,280.02 | 0.01348 | 0.05431 |

Hiʻiaka, Menoetius, Squannit and Romulus use `sceneSatelliteStateKm` at exactly
JD 2461286.5 TT. A request at any other epoch throws. Their position accuracy is
explicitly unknown (`estimateKm: null`); these snapshots do not extend the fitted
satellite theory. Source hashes, target/center identities, gravity, frame and
independent checks are validated by `tools/body-epoch-ephemeris.mts` before the
compact math table is generated. Detailed evidence remains in each body package. Generic `dwarfPlanetFrameSpecs()` excludes these scene-only moons, so its propagated time domain remains intact. The scene generator takes no arguments and replaces output only after validating all four bodies.

- Hiʻiaka and Menoetius retain primary-relative JPL tnosat vectors, solution GM,
  primary heliocentric vectors and independent satellite heliocentric composition.
  Menoetius uses Patroclus primary 920000617, not binary barycenter 20000617.
  Hiʻiaka uses the older JPL orbit solution, not a newer interacting model; its
  quoted 900 km uncertainty belongs to 2025-01-01, not the prepared scene date.
- Squannit uses the published phase, retrograde pole and quadratic longitude
  drift. Summed published parameter sensitivities reach about 55 degrees at the
  scene date; this is not a confidence interval or independent current position
  validation. Its on-page orbital projection is explicitly approximate.
- Romulus uses the full published EQJ2000 elements. Independent Miriade sky-plane
  checks differ by 23–63 mas across six dates and 140.5 km at the prepared scene
  epoch. The paper's 9.42 mas fit RMS is not the accuracy of this implementation.

Source-specific primary position and velocity are canonical for every prepared
observer at the scene epoch, including the matching parent conic. Haumea and
Sylvia body frames are refreshed from those same states. Patroclus is transported
as a coordinate-only orbit center, with no extra surface or marker. The generic
propagated frame API retains its existing conics and excludes scene-only moons.
The fixed-epoch frame bound is the retained snapshot distance, over its single
supported instant. It is not an estimate of orbital apoapsis.

Patroclus is an astronomy parent entry, with no fabricated standalone scene.
Its JPL primary osculating conic has ±30-day vector residuals of 7,244.47 / 0 /
6,180.29 km and an 8,332 km regression guard. This local conic is not a long-term
binary ephemeris. Regenerate it with `node tools/generate-asteroids.mts
--object=patroclus`; selected generation preserves other checked records.

The 41 additional main-belt models (Thetis through Ianthe) use the same
2026-09-03 fixed-epoch JPL conics. Independent ICRF vectors agree within
0.00000214 km at the queried epoch. That is numerical agreement, not physical
accuracy at the displayed TT instant: the existing preparation approximates
TDB as TT (under 2 ms). At the two retained ±30-day endpoints the largest
residual is 2789.65 km; per-body regression guards are the observed maximum
plus 15%, rounded upward in kilometres (largest 3209 km). These measurements
do not bound intervening dates or establish a long-term perturbation theory.
The new bodies' physical radii are source-owned volume reference radii; the
thermal sphere-to-volume approximations are disclosed beside each model.

## Hosted exoplanet orbits

`HostedOrbit` supports bound eccentric orbits (`0 ≤ e < 1`) through the shared
Kepler solver. The body-record compiler retains the published eccentricity;
it never replaces it with zero. An eccentric record must supply
`argumentOfPeriapsisDegrees`, `epochDefinition: "inferior-conjunction"`, and
nonempty `sources.eccentricity` and `sources.argumentOfPeriapsis` citations.
Periapsis is planet-centric and independent of the sky-plane node position
angle. Stellar radial-velocity arguments of periapsis and other observer
conventions require an explicit source conversion before intake.

The conjunction epoch uses `f = π/2 − ω`, as in batman's transit convention.
It is not generally the exact minimum projected separation for an inclined
eccentric orbit. `transitTimeBmjdTdb` retains its historical name but must be
interpreted with `epochDefinition`. The scientific state and phase APIs are
`hostedOrbitStateRelativeBmjdTdb` and `hostedOrbitPhaseBmjdTdb`; they consume
barycentric modified Julian dates in TDB directly. They do not perform a
barycentric light-time correction. The existing JD_TT functions remain display
approximations and must not be used to relabel observational times.

`hostedOrbitApoapsisKm` supplies the full `a(1+e)` radius bound. Position and
velocity vary around an eccentric orbit, and opposition need not occur half a
period after conjunction. Independent CSPICE propagation checks the numerical
convention alongside the existing Astropy circular/sky-frame oracle.
The CSPICE comparison covers 24 states at eccentricities 0.0084, 0.05, 0.5
and 0.9 with a float64 budget of `1e-11` times semi-major axis for position
and circular speed for velocity. This checks implementation agreement, not
the uncertainty of a measured orbit. The [TRAPPIST-1f source fixture](../../tests/fixtures/hosted-orbits/trappist-1f-agol2021/README.md)
retains the published parameters, their convention conversion and limitations.

Existing shipped body records retain their declared circular approximations.
Supporting an eccentric orbit does not establish a planetary spin law: the
current always-star-facing emission-map and synchronous-rotation recipes refuse
eccentric inputs. Supply a qualified rotation model before publishing such a
map. Static Kepler propagation does not reproduce TRAPPIST-1's interacting
N-body dynamics or transit-timing variations.

Orbital solutions belong in the astronomy source-record path. Telescope image
or cube acquisition is not evidence for a fitted eccentricity or periapsis;
this change adds no synthetic orbital product to the archive query. The batman
light-curve fitter migration remains separate.
