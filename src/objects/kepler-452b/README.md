# Kepler-452 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

Kepler-452 b is 1.63 times as wide as Earth and circles a Sun-like star every 385 days. Only its size and orbit are measured; here it is a plain gray sphere.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Measured, from Jenkins et al. 2015, AJ 150, 56 (2015), arXiv:1507.06723: radius 1.63 (+0.23/-0.20) Earth radii, period 384.843 days, inclination 89.806 degrees, transit time (epoch BJD 2454833 + 314.985). Scaled distance a/R* = 202.63. Jenkins et al. 2015, Table 3, leave the eccentricity unconstrained (e cos ω = 0.03 +0.75/−0.39, e sin ω = −0.02 ± 0.31; no radial-velocity detection), so the orbit is drawn circular. The position angle of the orbit on the sky is not measured; the ascending node at celestial north is a display convention.

Not measured and not shown: mass, colour, albedo, surface, atmosphere, rotation. The rotation is assumed synchronous.

**Illustration lens.** NASA's artist's concept of Kepler-452 b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`Kepler-452_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/Kepler-452_b.jpg), 4,000 × 2,000, named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: Shape stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

- Run of 2026-09-24: `node tools/prepare/prepare-object.mts` added the Illustration lens; every image this package already delivered is byte-identical to main's. [`equirectangular-illustration.test.mts`](../../../tools/objects/observation/equirectangular-illustration.test.mts) checks that the map keeps its left edge at 0° and that an emissive body gets transparent plates. In headless Chrome the lens opens on the map with no console errors ([all ten planets](../../../docs/images/eyes-on-exoplanets-illustrations.webp)).

[2026-09-22 exoplanet radius and route check](../../../site/test/evidence/exoplanets/2026-09-22/README.md): the 10,396.4 km source radius agrees with the scene and world frame. The pinned prepared package restored from the runtime inventory and passed its runtime contract; Chrome opened this route, showed the 1.63 Earth-radii fact and reported no console errors after the view settled. No assets were rebaked for this body.

## Known problems

**Is it a planet?** Disputed. Jenkins et al. (2015) validated the signal statistically. Mullally et al. (2018, arXiv:1803.11307) showed that Kepler's instrumental false alarms mean it "can not be confirmed using a purely statistical validation approach" and must still be considered a candidate, and Burke et al. (2019, arXiv:1901.00506) agree it is not statistically validated. Robnik & Seljak (2025, arXiv:2509.07409) find a star-specific false-alarm probability below 1% and support its validation. The package draws it as the discovery paper describes it.

The scaled distance is derived here from the paper’s semimajor axis (1.046 AU) and stellar radius (1.11 solar radii), not quoted from it. This planet is often described as potentially habitable; nothing here supports or shows that. The package draws a neutral gray sphere of the measured radius.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

**The Illustration lens is art, not data.** Its colours, clouds and terrain are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.
