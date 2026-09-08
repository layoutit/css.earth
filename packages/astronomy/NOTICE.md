# Astronomy notice

`@cssearth/astronomy` is cssEarth's own package, by Juan Cruz Fortunatti,
copyright (c) 2026, distributed under the MIT License in `LICENSE`. The same
author maintains it in another of his projects and mirrors it here; that is an
engineering arrangement, not a third-party dependency, and `upstream.json`
records the mirror (source path, commit, per-file hashes) so it can be
refreshed and drift detected.

The package embeds published ephemeris models: the VSOP87A planetary series
(Bretagnon and Francou, Bureau des Longitudes), the ELP2000-82B lunar series
(Chapront-Touzé and Chapront), and IAU/IAG Working Group rotation elements.
Their citations and accuracy statements are carried inside the source files
themselves.

The repository-only `source/scene-epoch` directory retains seven NASA/JPL
Horizons API responses for cssEarth's fixed-date scene preparation. Its manifest
records the exact queries and hashes; its README describes the time conversion,
center conventions and limits. These snapshots are not exported as a general-time
model by the astronomy package. Credit: NASA/JPL Solar System Dynamics,
[Horizons](https://ssd.jpl.nasa.gov/horizons/).
