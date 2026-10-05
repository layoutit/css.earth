# Eta Carinae

## Sources

Eta Carinae (HD 93308, HR 4210) is 2350.0 parsecs away. It is the star inside the [Homunculus Nebula](../homunculus-nebula/README.md), the cloud of dust around it: a luminous blue variable (SIMBAD's class for it) so wrapped in its own wind that no surface is seen. It is an object of its own, inside the nebula, so the star can be opened from the nebula's page, where the nebula's surface stays drawn around it. What is drawn is the wind: a sphere of the radius within which half of its near-infrared light lies, measured with the VLTI, in the color of a black body at the temperature where the wind turns opaque (Groh et al. 2012, Table 2).

**Star.** Placement: Gaia DR3 source 5350358584482202880, distance 2,350 pc from Smith (2006), ApJ 644, 1151: 2350 ± 50 pc from the Homunculus's shape and expansion, the distance its nebula's page stands at; Gaia DR3 gives it no parallax. Radius 1032 solar radii from Groh et al. (2010), arXiv:1006.4816, Sect. 4: most of the star's K-band light comes from a region with a 50% encircled-energy radius of 4.8 AU, measured with VLTI/AMBER by Weigelt et al. (2007); 4.8 AU is 1,032 solar radii (https://arxiv.org/abs/1006.4816). No mass is measured, so GM is 0, the records' unpublished value. Temperature 9,400 K from Groh et al. (2012), arXiv:1204.1963, Table 2: the primary's effective temperature where its wind turns opaque (Rosseland optical depth 2/3). No surface gravity of this star is published.

**Color.** A Planck spectrum at 9,400 K, because no archive holds a spectrum of this star (stis-ngsl: HD 93308 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 4210 is not in the catalogue; kiehling: HR 4210 is not among its 60 stars; kharitonov: HR 4210 is not in the catalogue; burnashev: BS 4210 is not in part2), through the CIE 1931 2° observer: #d2ddff. Routes tried in order: stis-ngsl: HD 93308 is not in the library; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: HR 4210 is not in the catalogue; kiehling: HR 4210 is not among its 60 stars; kharitonov: HR 4210 is not in the catalogue; burnashev: BS 4210 is not in part2; planck: used.

**Limb.** No limb darkening is drawn: The light comes from an opaque wind many times larger than the star under it, not from a surface a limb-darkening law describes..

## Evidence

Generated 2026-10-05 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

![The star's page inside the Homunculus at four distances, and the click that opens it from the nebula's page](evidence/2026-10-05/pages.jpg)

Headless Chromium at 1440 × 900 on 2026-10-05, no page errors. Top row: the star's own page as it opens, 34 AU from the star; 4 wheel steps out, 2,025 AU, the star a dot inside the lobes of the nebula's surface ([Homunculus Nebula image layers](../homunculus-nebula-layers/README.md)), which is drawn around it without the sheet through the star; 8 and 12 steps out, where the view has handed over to the nebula's scene. Bottom row: the nebula's page, the flight after a click on the star's marker, and the arrival.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Not shown.** What is drawn is the star's wind, not its surface. The star under the wind is modelled at 60 solar radii and 35,200 K, and models from 60 to 480 solar radii fit its spectrum equally (Groh et al. 2012, Table 2 and Sect. 3, https://arxiv.org/abs/1204.1963).
- **Not shown.** The near-infrared light is not round: VLTI measurements find it elongated, which fast rotation or the companion's cavity in the wind both explain (Groh et al. 2010, https://arxiv.org/abs/1006.4816). It is drawn as a sphere.
- **Not shown.** It is a binary with a period of 5.54 years. The companion is not seen directly, and the orbit's tilt and direction come from models of the colliding winds (Madura et al. 2012, as adopted by Groh et al. 2012, Table 2: inclination 138 degrees, longitude of periastron 260 degrees). The companion is not drawn.
- **Not shown.** The star's mass is not measured.
- **A model color.** The color is a black body at 9,400 K. No spectrum of the star alone is used: its light reaches us through its own dust, and the Homunculus reflects most of it.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
