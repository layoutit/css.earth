# GJ 504 b

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

GJ 504 b glows at about 560 K. JWST's spectrum points to about 25 Jupiter masses and an age of billions of years, which would make it a brown dwarf. Its star is [GJ 504](../gj-504/README.md).

## Sources

**Orbit.** Bowler et al. ([2020](https://arxiv.org/abs/1911.10569), AJ 159, 63) fit the literature astrometry with orbitize!, and distribute their posterior through whereistheplanet 1.0.1 (Wang et al. 2021). No refit is needed: [`posterior-pick.py`](../../../tools/objects/hosted-orbits/posterior-pick.py) keeps one of those samples ([pick.json](source/orbits/pick.json)), the one with the highest stored likelihood ([orbit.json](source/orbits/orbit.json) lists the model at each measured position). It passes the fourteen positions of Bonnefoy et al. ([2018](https://arxiv.org/abs/1807.00657), Table 2, from 2011 to 2017) within 2.5 of their errors. The recorded orbit: a = 54.7 au, e = 0.21, i = 132.0°, period about 370 years. The path drawn is this orbit. Every element and its derivation is in [`gj-504-b.json`](../../../packages/astronomy/data/bodies/gj-504-b.json).

**Radius, temperature and mass.** Radius 0.92 Jupiter radii and 564 K from the retrieval on the JWST/NIRSpec spectrum by Baburaj et al. ([2026](https://arxiv.org/abs/2606.19228), AJ 172, 28), section 5.5, and a mass of 25.2 Jupiter masses. The mass depends on the system's age: Bonnefoy et al. (2018) found 1.3 Jupiter masses for the young age and 23 for the old; JWST's spectrum favours the old. Model values: the companion is unresolved. A sphere: no oblateness is measured.

**Its own light.** It is drawn self-luminous, as the other imaged companions are: its glow is its own heat.

**Infrared colour lens.** The default lens paints the sphere one false colour from its near-infrared photometry: MKO K red, H green and J blue, from Janson et al. (2013) as compiled in the UltracoolSheet v2.1 ([band-color.json](source/photometry/band-color.json)), on a range from zero to its brightest band. Not a natural colour; nobody has resolved its disc.

**Rotation.** No rotation period or spin axis of GJ 504 b on the sky is measured; the papers cited in the README were checked. The display axis is the orbit normal ([rotation.json](source/preparation/rotation.json)).

**Illustration lens.** NASA's artist's concept of GJ 504 b: the map its [Eyes on Exoplanets](https://eyes.nasa.gov/apps/exo/) app wraps around the planet ([`GJ_504_b.jpg`](https://eyes.nasa.gov/apps/exo/assets/image/exoplanet/GJ_504_b.jpg), 2,048 × 1,024, named in the app's texture table), credited NASA/JPL-Caltech. NASA says each planet in the app shows "an artist's concept of what it might look like" ([tutorial](https://science.nasa.gov/tutorials/eyes-on-exoplanets-tutorial/)); the file carries no credit or date of its own, and NASA does not say how it was made. Nobody has resolved this planet's disc, so none of the colour, clouds or terrain in the map was observed. Preparation resizes it unchanged onto the sphere with its left edge at 0° longitude ([`equirectangular-illustration`](../../../tools/objects/observation/interpret.mts)), so its longitudes are arbitrary. It is a second lens: Infrared colour stays the default. It is listed in the package's illustration lenses, so it never counts as imagery. The planet is drawn self-luminous, so the map is shown evenly bright, without its star's shading, as the Infrared colour lens is. NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Evidence

- Run of 2026-09-24: `node tools/prepare/prepare-object.mts` added the Illustration lens; every image this package already delivered is byte-identical to main's. [`equirectangular-illustration.test.mts`](../../../tools/objects/observation/equirectangular-illustration.test.mts) checks that the map keeps its left edge at 0° and that an emissive body gets transparent plates. In headless Chrome the lens opens on the map with no console errors ([all ten planets](../../../docs/images/eyes-on-exoplanets-illustrations.webp)).

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at its star's Gaia distance, against the measured positions (see the test for each miss).

## Known problems

- Its mass, and so whether it is a planet or a brown dwarf, depends on the system's age, which is still debated.
- The radius is a model value; the companion is a point in every image.

- **The Illustration lens is art, not data.** Its colours, clouds and terrain are the artist's, and its longitudes are arbitrary; it is shown as NASA published it, with no colour corrected.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
