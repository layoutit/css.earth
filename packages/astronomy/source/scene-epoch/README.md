# Geometric states at the prepared scene epoch

These seven unedited NASA/JPL Horizons API responses supply six parent-centered
moon states and the Earth-center offset from the Earth-Moon barycentre. The
source snapshot corrects known phase errors in the compact mean-element fits
for Phobos, Mimas, Janus, Epimetheus, Helene and Triton. Earth previously used
the barycentre itself as its center in solar preparation.

The manifest binds the request URL, target and center NAIF IDs, reference frame,
units, time convention, retrieval date and SHA-256 of every raw response. The
response headers retain the JPL integration solution names (including SAT441,
NEP098 and DE441). Preparation checks both the query and returned headers and
fails on missing data, a changed epoch, or a hash mismatch.

The scene epoch is JD 2461286.5 TT (2026-09-03 00:00:00 TT). Horizons vector tables
support TDB or UT, so these requests use UT: JD 2461286.499199259, or 2026-09-02
23:58:50.816 UTC. At this date TT−UTC is 69.184 seconds. Float64 conversion and
printed JD rounding contribute less than 0.1 ms; there is no silent TT=TDB
substitution. Distances are km, velocities km/day, axes ICRF, origins the named
body centers, and aberration correction NONE (geometric states).

This snapshot fixes the state at one instant. The displayed ellipse/trail is an
osculating two-body illustration derived from that state, not a multi-body
trajectory or a prediction at other dates. These sources do not establish a
current rotational attitude or validate surface image registration. Daphnis is
not supplied: Horizons' available solution ends in January 2018; its displayed
2026 position remains an explicitly qualified extrapolation of the older fit.

Normal preparation is offline. To deliberately refresh the same seven requests,
run `node packages/astronomy/tools/acquire-scene-ephemeris.mjs`, review the changed
raw responses and manifest, then run `pnpm prepare:solar-geometry` and regenerate
the affected prepared world frames and world context with
`node tools/refresh-scene-ephemeris.mjs`. This also updates the retained surface
carrier and sky/Sun registration using the same numeric preparation owner;
surface geometry and image assets are reused unchanged. Changing the scene epoch
requires a new source snapshot and review of the UTC offset, not extrapolation
of this one. No general-time evaluator in the astronomy package is replaced by
these values.

Sources: [Horizons API specification](https://ssd-api.jpl.nasa.gov/doc/horizons.html),
[Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), and the exact GET
URLs in `manifest.json`. Data credit: NASA/JPL Solar System Dynamics.
