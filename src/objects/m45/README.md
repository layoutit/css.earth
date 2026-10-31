# Pleiades

The Pleiades is an open star cluster about 135 parsecs away, seen through the Milky Way dust cloud its brightest stars light up. Its dataset combines Gaia and Hipparcos stars with a [regional dust model](../milky-way-pleiades-dust/README.md). The link and search open from Earth's direction, framed on the cluster.


## Sources

- [Hunt & Reffert (2023)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/673/A114), Table 3, Melotte_22: position, distance of 134.8 pc, age and member selection. The [card record](source/content/object.json) cites each fact; the [astronomy record](../../../packages/astronomy/data/bodies/m45.json) places the cluster.
- [Hipparcos named stars](../m45-named-stars/README.md): nine bright stars supplement the Gaia member list. Four have matching navigable star objects. Their adopted normal depth is 136.7 pc; individual bright-star distances are not measured by this model.
- [Dust sources and processing](../milky-way-pleiades-dust/README.md): member reddening and Gaia constrain placement near 136 pc; Edenhofer and Leike constrain broad depth structure; infrared emission supplies finer structure. Published B-star parameters and Draine grains supply the lighting.

## Evidence

- The renderer path retains 94 dust elements (88 foreground elements and six panorama faces) through 181 one-degree camera poses, with fixed images and lighting and projection error below 0.071 px.
- Device and GPU-rendered images cover the Earth, side, rear and inside views. Images and timing results are attached to the [pull request](https://github.com/layoutit/css.earth/pull/1599).
- On a Galaxy S23, dust reduces continuous-drag delivery by about 10–14 fps across the opening, oblique and inside views. Coast differences range from −0.26 to +0.70 fps near 59 fps. Both dust-on and dust-off traces contain dropped or partial frames; tile memory remains below the recorded limits.

## Known problems

- Drag slowdown is GPU-side and its cause is unresolved. Recorded command-buffer flushes take 22–50 ms during input; one 150 ms presentation gap includes a 131 ms flush and 44 ms of concurrent main-thread work.
- On an iPad, mean RAF drag pacing is about 4 fps below dust off. Opening-view coast averages 45.95 fps against 56.77 fps without dust, with substantial variation. RAF gaps are not hardware dropped-frame counts.
- Native iPad screens show faint straight-edged dark boundaries in the Earth view; the visual seam check remains open.
- Cloud thickness, tilt, individual filament distances and absolute infrared-derived dust mass are uncertain. The adopted bright-star plane is a modeling assumption.
- Lighting stays fixed to Earth's view rather than changing with the observer. Near elements are finite billboards; a large element can clip visible support at its center plane on the opposite phone orbit, and inside-cloud views are approximate.
- Atlas, Electra, Maia, Taygeta and Asterope are drawn without navigable star objects. The Milky Way open-cluster bank also represents the cluster with a single dot.

## Processing

1. The standard authored preparation reads the [recipe](object.json), which declares no surface. The scene supplies the camera, sky and world frame.
2. The members dataset mounts the star banks and regional dust together. Its 3.6 pc [framing radius](source/presentation/solar-system.json) is a presentation value, distinct from the catalogue's approximate 11.1 pc tidal radius.
3. The foreground cloud has fixed 3D positions and prepared images. Lighting is calculated from Earth's direction and stays fixed while the camera turns. Faint surrounding cirrus and stellar dimming use the same underlying dust field.
4. The shared companion-context preparation draws the list marker from the member stars. [Dust preparation](../../../packages/bake/authoring/m45/dust/README.md) supplies the separate regional bank.
