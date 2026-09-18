# TRAPPIST-1

## Sources

TRAPPIST-1 is an ultracool red dwarf 12.47 parsecs away in Aquarius, with seven transiting Earth-sized planets. The star is barely
larger than Jupiter, and all seven orbits fit inside 0.062 au: the whole system would sit well within Mercury's orbit.

**Placement.** Gaia DR3 source 2635476908753563008, archived as [`photometry/gaia-dr3-source.csv`](source/photometry/gaia-dr3-source.csv):
ICRS position at epoch J2016.0, parallax 80.2123 +/- 0.0716 mas (12.467 pc) and a proper motion of 930.8, -479.0 mas/yr, the largest
of any star in this application. Gaia publishes no radial velocity for it — the star is too cool and too faint in BP — so the
-52.003 +/- 0.134 km/s of Jeffers et al. (2020) is used, through SIMBAD.

**Radius and mass.** 0.1192 solar radii (82,927 km) and 0.0898 +/- 0.0023 solar masses, from Agol et al. (2021, PSJ 2, 1), who
derive the radius from the photodynamic stellar density and the mass from the Mann et al. (2019) relation.

**Colour lens.** Gaia measured this star's BP/RP spectrum, but publishes the *sampled* product only for brighter sources; at G =
15.62 only the basis-function coefficients are released. They are pinned as
[`photometry/gaia-dr3-xp-continuous.csv`](source/photometry/gaia-dr3-xp-continuous.csv) and sampled here onto the archive's own
336-1020 nm grid with GaiaXPy, the archive's library, by
[`xp-continuous-sample.py`](../../../tools/objects/observation/xp-continuous-sample.py). Through the CIE 1931 2-degree observer
that gives **255, 205, 106 (#ffcd6a)**.

The star is faint in blue light: from 380 to 450 nm its samples have a mean signal-to-noise of 0.2 and sixteen of them are at or
below zero. A sample that is not positive but lies within three times its own error of zero is read as no emission at that
wavelength; anything more negative would fail the build. Moving every sample one standard error down and up moves the blue channel
from 34 to 156, which is the honest width of this colour.

**Axis.** No rotation axis is measured. The period is known from spot modulation — 3.295 days (Luger et al. 2017) — but not the
direction of the axis on the sky, so the display axis is celestial north at the star, a convention.

**On the map.** The star has no surface image, but its colour comes from its own spectrum, so discovery marks it `sourceColor` and
it stays on the map with its seven planets.

## Evidence

- [`stellar-photometric-color.test.mts`](../../../tools/objects/observation/stellar-photometric-color.test.mts) covers the colour
  path, including the rule for samples consistent with zero.
- [`source.test.mts`](../../../tests/objects/unit/trappist-1/source.test.mts) checks the pins, the radius and mass, and the distance.
- [`object-systems.test.mts`](../../../site/test/object-systems.test.mts) checks that the system holds all seven planets.
- Driven in a real browser: the system view draws the seven orbits, markers and labels around the star. The orbits are inclined
  89.7 to 89.9 degrees with the node at celestial north, so from the default angle they project onto a single line — the geometry
  that makes these planets transit.

## Known problems

**The blue end of the spectrum is noise.** Below about 450 nm this star is too faint for Gaia to measure, and those samples are
read as no emission. The one-sigma range above bounds what that can move.

**No image, diameter or axis.** The disc is about 0.07 milliarcseconds across; nothing resolves it.

**The system view arrives edge-on.** The seven orbits are nearly in the line of sight, so the default camera angle stacks them.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
