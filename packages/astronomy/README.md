# @cssearth/astronomy

Time scales, float64 vectors and the reference-frame tree behind [cssEarth](https://github.com/layoutit/cssEarth).

Zero dependencies, zero browser globals. Everything here runs in Node, a worker, or the browser.

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
(`tools/generate-satellites.mjs`). What follows is therefore a **fit residual**,
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
node tools/generate-series.mjs        # VSOP87A + ELP2000-82B, prints the truncation table
node tools/generate-satellites.mjs    # satellite mean elements from Horizons
node tools/fetch-fixtures.mjs         # Horizons vector fixtures
node tools/fetch-rotation-fixtures.mjs # body-fixed site fixtures for the IAU models
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
three prepared harmonic terms in mean longitude. `tools/lib/fit-libration.mjs`
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
