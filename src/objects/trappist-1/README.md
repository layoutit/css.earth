# TRAPPIST-1

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

## Sources

TRAPPIST-1 is an ultracool red dwarf 12.47 parsecs away in Aquarius, with seven transiting Earth-sized planets. The star is barely
larger than Jupiter, and all seven orbits fit inside 0.062 au: the whole system would sit well within Mercury's orbit.

**Placement.** Gaia DR3 source 2635476908753563008, archived as `source/photometry/gaia-dr3-source.csv` (restored and pinned in the [manifest](source/manifest.json)):
ICRS position at epoch J2016.0, parallax 80.2123 +/- 0.0716 mas (12.467 pc) and a proper motion of 930.8, -479.0 mas/yr, the largest
of any star in this application. Gaia publishes no radial velocity for it — the star is too cool and too faint in BP — so the
-52.003 +/- 0.134 km/s of Jeffers et al. (2020) is used, through SIMBAD.

**Radius and mass.** 0.1192 solar radii (82,927 km) and 0.0898 +/- 0.0023 solar masses, from Agol et al. (2021, PSJ 2, 1), who
derive the radius from the photodynamic stellar density and the mass from the Mann et al. (2019) relation.

**Color dataset.** Gaia measured this star's BP/RP spectrum, but publishes the *sampled* product only for brighter sources; at G =
15.62 only the basis-function coefficients are released. They are pinned as
`source/photometry/gaia-dr3-xp-continuous.csv` and sampled here onto the archive's own
336-1020 nm grid with GaiaXPy, the archive's library, by
[`xp-continuous-sample.py`](../../../packages/bake/src/objects/stellar/xp-continuous-sample.py). Through the CIE 1931 2-degree observer
that gives **255, 205, 106 (#ffcd6a)**.

The star is faint in blue light: from 380 to 450 nm its samples have a mean signal-to-noise of 0.2 and sixteen of them are at or
below zero. A sample that is not positive but lies within three times its own error of zero is read as no emission at that
wavelength; anything more negative would fail the build. Moving every sample one standard error down and up moves the blue channel
from 34 to 156, which is the honest width of this color.

**Limb layer.** Nothing resolves this disc, so its limb is a model.
[Claret, Hauschildt & Witte (2012)](https://doi.org/10.1051/0004-6361/201219849) compute quadratic limb-darkening laws,
`I(μ)/I(1) = 1 - u1(1 - μ) - u2(1 - μ)²`, from PHOENIX model atmospheres in each photometric band.
[`claret-2012-bvr-quadratic.tsv`](source/photometry/claret-2012-bvr-quadratic.tsv) keeps their R, V and B rows at the four grid
nodes around the star (2,500 and 2,600 K, log g 5.0 and 5.5). Read at the star's 2,566 K and log g 5.2396 (Agol et al. 2021,
through the NASA Exoplanet Archive), one band darkens each color channel:

| Channel | Band | u1 | u2 | At 87% of the radius | At the edge |
| --- | --- | --- | --- | --- | --- |
| Red | R | 0.953 | -0.079 | 54% of the centre | 13% |
| Green | V | 1.056 | -0.165 | 51% | 11% |
| Blue | B | 1.415 | -0.463 | 41% | 5% |

Blue darkens most and red least, so the edge is dimmer and redder than the centre. The prepared plate is colored, not black: its
alpha darkens the blue channel, and its color holds red and green at their own laws, with transparent pixels outside the disc. It
replaces one near-infrared law (Gillon et al. 2016, I+z at 885 nm, a transit prior from atmosphere tables) that darkened the three
channels alike, so the hue never changed across the disc. This is a **model**, not a resolved image or a measured profile, and it
claims no off-limb glow.

![The disc with one law for all channels, and with one law per channel](source/reference/limb-before-after.png)

Left: css.earth on 2026-10-12, with the one I+z law. Right: this recipe, from the branch's site. Both are the default view in
headless Chrome at 1440 by 900 (DPR 2), cropped to the disc.

**Axis.** No rotation axis is measured. The period is known from spot modulation — 3.295 days (Luger et al. 2017) — but not the
direction of the axis on the sky, so the display axis is celestial north at the star, a convention.

**On the map.** The star has no surface image, but its color comes from its own spectrum, so discovery marks it `sourceColor` and
it stays on the map with its seven planets.

**Light curve at 15 µm.** The page's chart is TRAPPIST-1's brightness over the 59 hours of JWST program 3077, reduced from raw in
this project ([`white-15um.csv`](source/science/jwst-3077/white-15um.csv), in 20-minute averages): the transits of b, g, b again and c,
the shallow eclipse of b and c together, the star's own flares, and the detector settling over the first hours. The event labels are
the mid-times this project's joint fit of the ten visits gives. [TRAPPIST-1b](../trappist-1b/README.md)'s temperature map and
[TRAPPIST-1c](../trappist-1c/README.md)'s measured dayside come from the same data.

**Habitable zone dataset.** A dataset of the whole system: the star in its color, with its habitable zone as a green
band in the plane of the planets' orbits. The band is its own package, a drawing of four distances the Habitable Zone
Gallery calculates by Kopparapu et al. (2013, 2014); its sources, processing and limits are in
[its README](../trappist-1-habitable-zone/README.md). It is a calculation, not an observation.

**Stellar wind dataset.** A second dataset of the whole system: the star in its color, with a model of its wind's
pressure as a color map in the plane of the planets' orbits, and as a dashed line the boundary inside which the star's
magnetic field still holds the wind. It is its own package, read from a figure of Garraffo et al. (2017); its sources,
processing and limits are in [its README](../trappist-1-stellar-wind/README.md). It is a model, not an observation.

**Tidal heating dataset.** A third dataset of the whole system: each planet's orbit line and marker in the color of the
heat tides raise inside the planet, by the model of Barr, Dobos & Kiss (2018). It is its own package; its sources, processing
and limits are in [its README](../trappist-1-tidal-heating/README.md). It is a model, not an observation.

**Catalogue color.** the swatch that search, the catalogue and the minimap show is this dataset's prepared color, #ffcd6a.

## Evidence

- [`stellar-photometric-color.test.mts`](../../../packages/bake/src/objects/stellar/stellar-photometric-color.test.mts) covers the color
  path, including the rule for samples consistent with zero and the limb plate with one law per color channel: composited over
  the photosphere color, each channel is within 1.5 of 255 steps of its law.
- `source.test.mts` checks every package's source pins, and that each planet turns
  synchronously with longitude 0 on the star and orbits it.
- [`object-systems.test.mts`](../../../site/world/systems/object-systems.test.mts) checks that the system holds all seven planets.
- Driven in a real browser: the system view draws the seven orbits, markers and labels around the star. The orbits are inclined
  89.7 to 89.9 degrees with the node at celestial north, so from the default angle they project onto a single line — the geometry
  that makes these planets transit.
- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #ffcd6a is the color dataset's prepared color.

## Known problems

**The blue end of the spectrum is noise.** Below about 450 nm this star is too faint for Gaia to measure, and those samples are
read as no emission. The one-sigma range above bounds what that can move.

**The limb's color is a three-band approximation.** The table's B, V and R bands stand for the screen's blue, green and red; the
spectrum is not passed through a law at each wavelength. The table is for solar metallicity.

**No image, diameter or axis.** The disc is about 0.09 milliarcseconds across; nothing resolves it.

**The system is seen almost edge-on from the Sun.** The seven orbits lie nearly in the line of sight, which is why they transit; on
arrival the overview turns up to 30° above their plane so they open into ellipses, as it does for every other star's system.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
