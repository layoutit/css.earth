# Romulus

Romulus is Sylvia’s outer moon.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

One published projected-limb solution, 23.1±0.7 km area-equivalent diameter and 2.7±0.3 axis ratio, with equal depth assumed. The 2020 reanalysis allows other correlated ellipse shapes. The grid marks unmapped terrain.

- [Berthier et al. Sylvia physical/dynamical properties](https://www.sciencedirect.com/science/article/abs/pii/S001910351400308X)
- [Sylvia system updated shape, occultations and orbits](https://www.aanda.org/articles/aa/pdf/2021/06/aa40342-21.pdf)

## Evidence

The fixed-epoch orbit uses the published 2021 Sylvia-system model retained in [published orbit parameters](source/orbit/published-parameters.json). Independent projections from the newer Miriade 2024 solution differ by about 42 milliarcseconds (140 km in the sky plane) at the scene epoch and 23–63 milliarcseconds over six checks. These checks establish an approximate orbital context; they do not reproduce or claim the paper’s 9.85-milliarcsecond fit RMS. Full source receipts and limits are retained in [epoch record](source/validation/epoch-state.json), [projection checks](source/validation/projection-checks.json), and [orbit report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/moons/b1-preparation/romulus-orbit.md). This orbit qualification is separate from the selected 2014 illustrative shape-family member and its 2020 geometric reanalysis caveat.

[Source test definitions](../../../tests/objects/unit/romulus/source.test.mts).

## Known problems

The selected 2014 projected ellipse is one admissible solution. Unseen depth is assumed equal to the short axis; the 2.7:1 ratio does not establish a unique measured three-dimensional shape. Herald’s 2020 reanalysis finds strong covariance between axes and orientation.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="romulus-source-model"></a>
<a id="selected-geometry"></a>
<a id="assumptions"></a>
<a id="source-interpretation-limits"></a>
<a id="orbit-and-orientation"></a>
<a id="survey-and-sources"></a>
<a id="retained-orbit-qualification"></a>

<details>
<summary>Methods and source notes</summary>

**Selected geometry**

Published 2013 projected area-equivalent diameter 23.1±0.7 km and ellipse ratio 2.7±0.3.

**Orbit and orientation**

The [validation records](source/validation) identify the parent-relative state and any fit interval. The display uses meridian zero.

**Survey and sources**

Source decisions and the historical review they came from are recorded in the [investigation ledger](investigations.json).

</details>
