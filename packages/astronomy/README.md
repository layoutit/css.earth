# @cssearth/astronomy

Time scales, float64 vectors and the reference-frame tree behind [cssEarth](https://github.com/layoutit/cssEarth).

Zero dependencies, zero browser globals. Everything here runs in Node, a worker, or the browser.

`createRaDecCatalogueMatcher(positionsDeg, matchArcsec, comparison)` indexes
RA/declination pairs and returns a position predicate. Catalogue coordinates stay
in degrees to preserve the authoring arithmetic; `comparison` selects `degrees`
(the default) or `arcseconds` for the historical rounding difference. Numeric
non-finite positions remain accepted and do not match. The radius must be finite
and positive. RA wraps at 360 degrees in both the cell lookup and the distance,
so pairs across RA zero match like any others.

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

The package also places the solar system: the eight planets from a
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
assumes. `eclipticJ2000ToIcrf` and `icrfToEclipticJ2000` exist for the edge
(published tables, Horizons fixtures, ecliptic longitude in a UI) and use the
IAU 1976 obliquity of 84381.448 arcseconds, which Horizons builds its
`REF_PLANE='ECLIPTIC'` output on.

### Error budget

Validity window **1900-01-01 to 2100-01-01** for the planets, Moon, and most
satellite fits. Hyperion, Janus, Epimetheus, Atlas, Prometheus, and Pandora use
a **2020-01-01 to 2032-01-01** current-era fit because one precessing ellipse
cannot carry their resonant motion over the full source span. Pan uses
**1950-01-01 to 2050-01-01**, inside its shorter JPL SPK coverage. Each record
exposes its exact fit window and cadence. Outside those windows the numbers
below do not hold.

Each budget is `truncation + theory`. *Truncation* is derived at generation time
from the coefficients that were dropped (6 sigma over their independent phases).
*Theory* is how far the **untruncated** series is from JPL Horizons: VSOP87 and
ELP2000-82B were fitted to DE200/LE200 in 1988, and Horizons serves DE441.
*Measured* is what the package delivers against the committed Horizons fixtures.

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
closest approach to Earth. It is met for Mercury through Saturn. It is **not**
met for Uranus (1.6") or Neptune (2.3"), and cannot be: the theory floor alone
exceeds an arcsecond for both, because DE441 moved those orbits after VSOP87
was fitted.

The Sun's offset from the solar-system barycentre, up to 1.5 million km, is
computed from the planets and the GM table rather than from a separate series,
and matches Horizons to **165 km**. What is missing is everything that is not
one of the eight planets: Pluto, Ceres and the asteroid belt, which Horizons
carries and this does not.

### Moons

The moons are **not** a satellite theory. Each is a precessing Keplerian ellipse
in its own Laplace plane, with elements derived from Horizons' own osculating
elements. Most are sampled every 30 days across 1900–2100; the six current-era
Saturn fits and Pan use a 5-day cadence over their recorded ranges
(`cli/generate-satellites.mts`). What follows is therefore a **fit residual**,
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

The bold rows are beyond what a precessing ellipse can represent: long-period
libration, nonlinear precession, the Janus–Epimetheus co-orbital exchange, the
Tethys Trojan Telesto, Hyperion's resonance and the perturbed ring moons. Their
residuals are reported rather than disguised as precision.

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
but a frame that only just passes `add` puts the camera in a band where a metre
of motion flips its anchor; 20 is the smallest round number that leaves the
anchoring rule's keep-what-you-have tie-break something to keep.

### Regenerating

The series and fixtures are generated, and the generators re-download their
sources into `cli/.cache` (gitignored):

```
node cli/generate-series.mts        # VSOP87A + ELP2000-82B, prints the truncation table
node cli/generate-satellites.mts    # satellite mean elements from Horizons
node cli/fetch-fixtures.mts         # Horizons vector fixtures
node cli/fetch-rotation-fixtures.mts # body-fixed site fixtures for the IAU models
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

## Other fitted bodies

Every body below uses a source-fitted model whose residuals are sampled fit
errors at independent epochs, not measured orbital uncertainties, continuous
error bounds or extrapolation support. Regression guards are the observed
maximum plus 15 percent unless stated. TDB is approximated as TT (under 2 ms).

| Bodies | Model and window | Maximum residual at independent epochs |
|---|---|---|
| Charon | Horizons satellite fit, 1900–2100 | 1.021 km (guard 2 km) |
| Amalthea, Thebe | 1900–2100 fit | 1,267.43 km, 530.07 km |
| Metis, Adrastea | Daily samples, 2020–2032 | 946.81 km, 972.87 km |
| Naiad, Thalassa, Despina, Galatea | Daily samples, 2020–2032 | 238, 105, 64, 55 km |
| Nix, Hydra, Kerberos, Styx | Daily fits about the Pluto-system barycentre, 2020–2032 | 94.36, 47.05, 125.18, 388.06 km |
| Puck, Portia, Juliet, Belinda, Cordelia, Ophelia | Daily fits, 2020–2032 | 46.43, 92.47, 119.87, 28.49, 0.46, 2.02 km |
| Methone, Pallene | Daily Cassini-era fits, 2005–2018 | 17,510.67 km, 27.65 km |
| Polydeuces, Anthe, Aegaeon | Ellipse plus three harmonic terms in mean longitude, 2020–2032 | 940, 2030, 307 km |
| Nereid | Five-day fit, 2020–2032 | 10,417.20 km (0.19% of the semimajor axis; guard 11,980 km) |
| Himalia | Longitude correction plus ten periodic ICRF terms per axis | 54,960.51 km (guard 63,205 km) |
| Siarnaq, Ymir | Ten bounded ICRF terms per axis, five-day samples, 2020–2032 | 280,355.57 / 161,334.73 km (guards 322,409 / 185,535 km) |
| Kiviuq, Albiorix | Ten residual harmonics per axis / longitude correction and 512 cosine terms per axis | 28,145.69 / 18,473.58 km (guards 32,368 / 21,245 km) |
| Didymos, Kleopatra, Toutatis | Fixed-epoch conics at JD 2461286.5 (2026-09-03), ±30 days | 131, 241, 330 km |
| Dimorphos | Fit to the post-impact DART s547 relative trajectory, JD 2461256.5–2461316.5 | 0.054003 km, 3.135% radial |
| Halley (1P) | Osculating conic at JD 2461286.5, ±30 days | 557.99 km (guard 642 km) |
| Borrelly (19P) | Same epoch and conic API, ±30 days | 356.11/337.54 km (guard 410 km) |
| Patroclus | JPL primary osculating conic, ±30 days | 7,244.47 / 6,180.29 km (guard 8,332 km) |
| 41 main-belt models (Thetis through Ianthe) | Fixed-epoch JPL conics, 2026-09-03, ±30 days | 2789.65 km (largest guard 3209 km) |
| 2012 VP113, Leleākūhonua, 2017 OF201 | Fixed-epoch JPL conics, ±30 days | 532–535 km (guard maximum plus 5%) |

Notes that change how these numbers can be used:

- **Pluto system.** The Charon frame uses the same unit rule as other moons. Pluto's heliocentric elements target its centre, not its barycentre. Nix, Hydra, Kerberos and Styx return vectors relative to Pluto's physical centre: the generic `barycentreCompanion` record adds Charon's mass-weighted displacement to position and velocity. No spin or pole is inferred for these moons; shape orientation belongs to each object.
- **Dimorphos** is strongly perturbed, so its 60-day fit is not a long-term satellite theory.
- **Comets.** The conics do not model perturbations or outgassing. Halley's 4.579 km registry radius describes the volume of the historical Stooke grid mesh, and Borrelly's 4 km navigation reference is half the approximate observed length; neither is a measured mean radius.
- **Uranian moons.** The displayed shape radii for the five prolate bodies are volume-equivalent. Cordelia and Ophelia use the ring-dynamics GM estimates from [French et al. (2024), Table 3 footnote b](https://arxiv.org/abs/2401.04634). A GM of zero for the other four, and for Nereid, means no mass contribution is modeled, not zero mass.
- **Methone and Pallene.** The SAT415 ephemerides stop in January 2018, so their positions at the 2026 epoch are unqualified extrapolations.
- **Himalia, Siarnaq, Ymir, Kiviuq, Albiorix.** The periodic terms use a minimum frequency separation of one quarter of the fit window's fundamental frequency, which prevents enormous cancelling coefficients. Frame extents include the sum-of-amplitudes bound. Albiorix's endpoint velocity is not a measured dynamical solution. Per-body checks are in each body's `source/validation/orbit-checks.json`.
- **Extreme trans-Neptunian objects.** `isExtremeTransNeptunian` selects trans-Neptunian objects with semimajor axis over 150 au and perihelion beyond 30 au, the definition de la Fuente Marcos & de la Fuente Marcos (2018, RNAAS 2, 167) state. 2017 OF201 (e = 0.945, 91 au away) differs by 2.00 m at the queried epoch, so the shared epoch bound is 3 m.

Regenerate selected records with `node cli/generate-satellites.mts --object=kiviuq,albiorix` or `node cli/generate-asteroids.mts --object=patroclus`; a selection preserves the other checked records.

### Irregular moons

The 18 added Saturn irregulars and Caliban, Sycorax, Prospero and Setebos use
five-day geometric ICRF Horizons vectors over JD 2458849.5–2463229.5, with the
precessing ellipse and a 128-term cosine residual per Cartesian axis. All 22
pass the 2% radial guard. Six independent fixtures and 37 additional epochs per
moon are kept in each body's `source/validation/orbit-checks.json`.

| Moon | Six-fixture maximum (km) | 37 additional epochs: maximum (km) |
|---|---:|---:|
| paaliaq | 14,686.77 | 52,916.80 |
| tarvos | 14,289.47 | 57,180.15 |
| ijiraq | 9,349.31 | 61,773.41 |
| suttungr | 5,537.39 | 24,033.55 |
| mundilfari | 10,946.30 | 50,311.51 |
| skathi | 3,135.10 | 33,070.04 |
| erriapus | 11,239.64 | 51,119.64 |
| thrymr | 6,327.47 | 27,727.05 |
| bebhionn | 35,180.27 | 159,023.06 |
| bergelmir | 4,370.57 | 31,899.75 |
| bestla | 13,244.79 | 64,232.45 |
| fornjot | 9,860.75 | 43,840.12 |
| hati | 10,819.14 | 48,479.58 |
| hyrrokkin | 7,535.37 | 33,350.63 |
| loge | 8,681.36 | 38,198.69 |
| skoll | 7,169.26 | 47,849.22 |
| greip | 9,025.01 | 39,841.08 |
| tarqeq | 4,847.56 | 36,578.97 |
| caliban | 191.01 | 1,303.96 |
| sycorax | 748.30 | 3,898.11 |
| prospero | 716.90 | 5,412.57 |
| setebos | 2,497.94 | 11,280.02 |

### Scene-epoch moons

Hiʻiaka, Menoetius, Squannit and Romulus use `sceneSatelliteStateKm` at exactly
JD 2461286.5 TT. A request at any other epoch throws. Their position accuracy is
explicitly unknown (`estimateKm: null`). `cli/body-epoch-ephemeris.mts` validates
source paths, target/center identities, gravity, frame and independent checks
before the table is generated; it takes no arguments and replaces output only
after validating all four bodies. Generic `dwarfPlanetFrameSpecs()` excludes these
moons. Their fixed-epoch frame bound is the snapshot distance, not an orbital apoapsis.

- Hiʻiaka and Menoetius use primary-relative JPL tnosat vectors. Menoetius uses
  Patroclus primary 920000617, not binary barycenter 20000617. Hiʻiaka's quoted
  900 km uncertainty belongs to 2025-01-01, not the scene date.
- Squannit uses the published phase, retrograde pole and quadratic longitude
  drift. Summed parameter sensitivities reach about 55 degrees at the scene date.
- Romulus uses the full published EQJ2000 elements. Independent Miriade sky-plane
  checks differ by 23–63 mas across six dates and 140.5 km at the scene epoch.

Haumea and Sylvia body frames are refreshed from the same primary states.
Patroclus is transported as a coordinate-only orbit center, with no standalone scene.

## Hosted exoplanet orbits

`HostedOrbit` supports bound eccentric orbits (`0 ≤ e < 1`) through the shared
Kepler solver. The body-record compiler keeps the published eccentricity and
never replaces it with zero. An eccentric record must supply
`argumentOfPeriapsisDegrees`, `epochDefinition: "inferior-conjunction"`, and
nonempty `sources.eccentricity` and `sources.argumentOfPeriapsis` citations.
Periapsis is planet-centric. Stellar radial-velocity arguments of periapsis and
other observer conventions need an explicit source conversion before intake.

The conjunction epoch uses `f = π/2 − ω`, as in batman's transit convention.
It is not generally the exact minimum projected separation for an inclined
eccentric orbit. `transitTimeBmjdTdb` keeps its historical name but must be
read with `epochDefinition`. `hostedOrbitStateRelativeBmjdTdb` and
`hostedOrbitPhaseBmjdTdb` take barycentric modified Julian dates in TDB directly
and do not apply a light-time correction. The JD_TT functions are display
approximations and must not be used to relabel observational times.

A circumbinary orbit names `barycentreCompanion`: another body hosted by the
same parent. Its elements are then Jacobi elements about the centre of mass
of the parent and that companion, weighted by the two records'
gravitational parameters, and `sources.barycentre` cites those masses.
`hostedPlanetStateRelativeKm` stays parent-centred and adds the centre's
offset; `hostedPlanetStateAboutCentreKm` and `hostedOrbitCentreStateKm` give
the two parts, and `hostedOrbitCentreId` names the centre
(`<parent>-<companion>-barycentre`). Kepler-16 (AB) b is checked against the
eclipses of its two stars and its seven Kepler transits in `src/hostedOrbits.test.ts`.

`hostedOrbitApoapsisKm` supplies the full `a(1+e)` radius bound. Independent
CSPICE propagation checks 24 states at eccentricities 0.0084, 0.05, 0.5 and 0.9
with a float64 budget of `1e-11` times semi-major axis for position and circular
speed for velocity. This checks implementation agreement, not the uncertainty of
a measured orbit. The [TRAPPIST-1f source fixture](../bake/src/astronomy/fixtures/trappist-1f-agol2021/README.md)
keeps the published parameters, their convention conversion and limitations.

Supporting an eccentric orbit does not establish a planetary spin law: the
always-star-facing emission-map and synchronous-rotation recipes refuse
eccentric inputs. Supply a qualified rotation model before publishing such a
map. Static Kepler propagation does not reproduce TRAPPIST-1's interacting
N-body dynamics or transit-timing variations. Orbital solutions belong in the
astronomy source-record path; telescope image or cube acquisition is not
evidence for a fitted eccentricity or periapsis.
