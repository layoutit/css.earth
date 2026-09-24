# TRAPPIST-1f eccentric-orbit evidence

This fixture binds the static hosted-orbit record to the TRAPPIST-1
transit-timing analysis by [Agol et al. (2021)](https://doi.org/10.3847/PSJ/abd022).
`qualification.json` quotes the planet-f values it uses from Table 2 (period,
transit epoch, eccentricity vector) and Table 5 (semi-major axis and
inclination), citing the paper by table. The author's two-body initializer,
[`kepler_init.jl` lines 24-54](https://github.com/ericagol/TRAPPIST1_Spitzer/blob/0a417ab77425a016eed2b492efa8a556631ac152/src/NbodyGradient/src/kepler_init.jl#L24-L54)
at the commit `manifest.json` records, defines Table 2's transit epoch: in its
plane-parallel convention, inferior conjunction has
`f = 3*pi/2 - omega`.
The source convention is checked by `tools/objects/hosted-orbit-source.test.mts`.
`tools/oracles/astronomy/hosted-eccentric.py` reads `qualification.json` and
regenerates six independent CSPICE states in the shared oracle fixture.

The source convention is not the convention used by batman-style transit
geometry, `f = pi/2 - omega`. To preserve the same true anomaly and time of
periapsis, the qualification fixture applies
`omega_batman = wrap(omega_source - pi)`. Thus Agol's planet-centric
`omega = 183.4744073675 deg` becomes `3.4744073675 deg`; the eccentricity
vector changes sign in the batman convention. This is an angle-convention
conversion, not the 180-degree star/planet radial-velocity convention.

The published `P`, `t0`, `e cos(omega)`, and `e sin(omega)` values are marginal
posterior summaries. Their derived `e`, `omega`, and periapsis epoch are a
deterministic summary orbit, not one joint posterior draw. Table 5's `a/R*`
and inclination come from the same paper's staged photodynamical analysis,
which fixed the dynamical model at maximum likelihood and derived inclination
while neglecting the small eccentricity. They are quoted as separately
located facts rather than described as one simultaneous fit sample.

This fixture qualifies a static two-body approximation at the 2015 osculating
epoch. It does not reproduce the seven-body integration, transit-timing
variations, or the roughly 490-day evolution of planet f's eccentricity vector,
and it is not a precision 2026 ephemeris. It also does not qualify a physical
spin state: the current exact star-facing rotation helper suppresses the
optical libration that a constant-rate synchronous rotator would have on an
eccentric orbit.
