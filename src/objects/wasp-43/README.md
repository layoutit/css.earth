# WASP-43

## Sources

WASP-43 is a K7 dwarf in Sextans, the host star of the hot Jupiter [WASP-43b](../wasp-43b/README.md). Its package holds the placement, the published size and the record of what was checked for its surface. No image of the star exists, so it is a shape-only star: `discoveryVisibility` keeps it off the map, and its page opens from search or from its planet.

**Placement.** The ICRS position, parallax and proper motion are Gaia EDR3 values as SIMBAD gives them; the radial velocity, −3.7 ± 0.7 km/s, is Gaia DR2's. The distance is 1000 / 11.474 mas = 87.15 pc, with no parallax zero-point correction.

**Radius and mass.** 0.665 solar radii and 0.6916 solar masses, the stellar values Challener et al. (2024, [ApJL 969, L32](https://arxiv.org/abs/2406.10207), Table 1) assume for their eclipse map of WASP-43b. They are model-dependent stellar parameters, not an interferometric size. The planet's size and orbit in the WASP-43b package are in units of this radius.

**Rotation: none measured.** No publication measures the star's rotation axis. Challener et al. (2024) mention only some evidence of rotational modulation longer than 15 days in its light curve (from Hellier et al. 2011). The rotation record is the `cssearth-display-orientation@1` convention used for the other stars without an axis: celestial north at the star, in the plane of the sky. The star record sets `presentationUp: display-axis`.

**Shape lens.** The surface is the `neutral-shape` science kind, drawn by the emissive route with transparent plates: a gray display convention, not a colour or a brightness.

## Evidence

EVIDENCE_PLACEHOLDER

## Known problems

**No image of the surface.** At 87 pc the star's disc is 0.07 milliarcseconds across (computed from the radius and distance), far below the resolution of any telescope or interferometer.

**The axis is a convention.** Where the star's pole points is unknown. The planet's orbit in the WASP-43b package has its own display convention for the direction of its ascending node.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
