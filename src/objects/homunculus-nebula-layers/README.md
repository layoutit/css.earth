# Homunculus Nebula

ESA/Hubble's picture of the Homunculus, the two-lobed cloud of dust around the star Eta Carinae, on the surface its spectra give. **The surface is the model Steffen et al. (2014) made from spectra of the whole nebula, as NASA publishes it; its tilt and direction are Smith's (2006). How the model's file lies on the picture is not published: it is measured here.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Hubble potw1208a](https://esahubble.org/images/potw1208a/) | [Record](../../sources/esahubble-potw1208a.json). Preview of a forthcoming supernova: ACS at 220, 250, 330, 550 and 660 nm; 1089 × 1033 px over 27.0 × 25.6 arcsec (`source/source.jpg`, the publisher's JPEG, restored from its origin). Credit: ESA/Hubble & NASA. A display composite, not calibrated photometry. |
| [Steffen et al. (2014)](https://arxiv.org/abs/1407.4096) | [Record](../../sources/publication-steffen-2014-homunculus-3d.json). The first full 3D model of the Homunculus, from VLT/X-shooter H2 2.12 µm spectra that map the whole nebula: one continuous surface for each lobe, with its polar holes, trenches and protrusions. The optical picture is the star's light scattered by the dust of that thin, clumpy shell. |
| [NASA 3D Resources, Eta Carinae Homunculus Nebula](https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Printing/Eta%20Carinae%20Homunculus%20Nebula) | [Record](../../sources/nasa-3d-homunculus-nebula.json). That model as a file for printing: a binary STL of 17,101 triangles (`source/homunculus.stl`, restored from its origin), the nebula's pole along the file's z axis. Free and without copyright. |
| [Smith (2006)](https://arxiv.org/abs/astro-ph/0602464) | [Record](../../sources/publication-smith-2006-homunculus-shape.json). The pole: an inclination of 41.0 ± 0.5°, the tilt of the polar axis out of the line of sight, along position angle 310°. The distance: 2,350 ± 50 pc. |
| [HST ACS/HRC F220W and F550M, GO 9973](https://mast.stsci.edu/search/ui/#/hst/results?proposal_id=9973) | [Record](../../sources/mast-hst-go9973-eta-carinae-acs-hrc.json). The ultraviolet and visible exposures of 2003 the picture was made from, as drizzled FITS. Dust absorbs the ultraviolet most, so F220W shows the dust lanes deepest; it also sees the lobes' cells up to the star, where the picture is the star's glare. Downloaded to the generator; not tracked. |
| [HST WFC3/UVIS F280N, GO 15289](https://mast.stsci.edu/search/ui/#/hst/results?proposal_id=15289) | [Record](../../sources/mast-hst-go15289-eta-carinae-f280n.json). Mg II 2800 Å, 2018: the lobes' detail beside the star where the picture is glare. Its saturated pixels about the star are left out. Downloaded to the generator; not tracked. |
| [Frangi et al. (1998)](https://doi.org/10.1007/BFb0056195) | [Record](../../sources/publication-frangi-1998-vesselness.json). The line detector the dust lanes are found with. |
| [SIMBAD, eta Car](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eta+Car) | [Record](../../sources/simbad-eta-carinae.json). The star's place, from UCAC4. |

## The picture

- **Registration:** the file's embedded sky tags give scale and direction, 0.0248″ per pixel and north 34.98° left of vertical. The star gives the place: the middle of the picture's saturated pixels is set at Eta Carinae's catalogued place.
- **The surface on the sky:** the pole is Smith's: 41° from the sight line toward position angle 310°, the south-east lobe approaching. The file says nothing of its unit, its turn about the pole, the star's place in it or which end recedes. [model-fit.mts](../../../packages/bake/authoring/homunculus-nebula/model-fit.mts) lays the model's outline on the picture for every choice and keeps the one that shares the most with the picture's lit pixels: the +z end recedes, the file is turned 328° about the pole, a unit is 2.72″ and the star is at (0.96, 0, −0.08) of the file. The outline then shares 86.8% with the lit pixels.
- **A check against a printed number:** the file's farthest point along its pole is 3.89 units from the star, 10.6″, which is 3.72 × 10¹⁵ m at 2,350 pc. Steffen et al. state the lobes' speeds at 3.4 × 10¹⁵ m.
- **The surface:** the model's own triangles, its holes closed and simplified to 1,200, each drawn as one leaf with the picture painted on it ([surface-mesh.ts](../../../packages/bake/src/image-layers/surface-mesh.ts)). The lobes are a closed shell seen from every side. Its outline is fitted to the picture's lobe edge direction by direction about the star, by at most 15% (`edgeFit`).
- **The faces the picture shows:** a face that turns toward the Sun, is the nearest crossing of its sight line and lies on the picture's lobe light takes the picture there, sharp. The far lobe is seen through the red equatorial skirt: its own dust pattern is kept, raised to the near lobe's brightness, and given the near lobe's color.
- **Color:** the near lobe's, as a ramp from its brightest cells to its darkest lanes, read from the picture's pixels on that lobe away from the star. A face keeps its own color where nothing darkens it; where a lane or patch does, its color slides along the ramp: dark orange, brown, black.
- **Dark lanes and patches:** the lanes are a map the [generator](../../../packages/bake/authoring/homunculus-nebula/filament-map.mts) builds from the picture and F220W and F550M, each registered on the picture by its lobes' detail: dark lines found at four widths (Frangi et al. 1998) and weighted with settings chosen on the Nebula Lab's filament tuner (`source/filaments.png`). The patches are where the picture's light falls well below the light around it. Both darken a face, never brighten it.
- **The star's glare:** within 2.9″ of the star the picture is the star's light. There the faces take the lobe light carried in from around the glare with F220W's and F280N's own detail (`source/detail.png`, from the same generator), so the cells run up to the star.
- **The faces the picture does not show:** the flanks seen edge-on, the far sides and the faces behind the other lobe. Each lobe is unwrapped on a Mercator chart about the sight line, which keeps shapes; the cells the picture shows are known, and the others are filled block by block from the known ones of both lobes (image quilting, Efros and Freeman 2001), each block the one that best matches what is filled around it, copied at its latitude's scale. The seams are relaxed (Poisson blending, Pérez et al. 2003), the fill takes the known cells' distribution of brightness, and the two lobes' fills blend across the waist. A presentation choice: it shows what the lobes look like where they are seen, not what is there.
- **Opacity:** the dark dust is solid; a face grows clear as it brightens, to 55% at the brightest, so the far wall and the star show through the glowing parts. A presentation choice.
- **The equatorial skirt:** a thin, ragged disc in the plane through the star across the pole (Smith 2009; Davidson et al. 2001 find it thin and planar). Its two fans, north-east and west of the star, are regions drawn by hand on the picture (`source/regions.json`), over the lobes too: inside them the picture's light lies on the skirt, and the lobe beneath is filled as an unseen face is. The skirt is five sheets fanning 6° either side of the plane, a thickness the papers do not measure: modeled. The model's equatorial protrusions under the fans are brought back to the lobes' smooth shape. Between ACS/HRC F550M (2003) and WFC3/UVIS F658N (2018) the fans' features move straight out from the star, within about 10°, at 15 to 45 milliarcseconds a year.
- **The star:** a glow inside the shell on three crossed squares: a core of 0.15″ and a halo of 0.6″, faded out by 2.5″. Presentation: the picture's star is saturated.
- **Drawing:** each triangle is a scene of its own and the renderer paints them farthest from the camera first, so the shell reads right from every side.
- **Size:** 27.0 × 25.6 arcsec, 0.31 pc wide at 2,350 pc; the lobes reach 10.6″ from the star along their pole.
- **Far view:** from afar, while another body is selected, the bank is one image on a plane fixed in its frame, drawn as the Milky Way's backing is. [`prepare-galaxy-backing.mts`](../../../packages/bake/cli/prepare-galaxy-backing.mts) reads the [backing recipe](source/backing/recipe.json) and composites the bank's triangles as seen from the Sun onto the picture's plane through the frame's centre. The plane therefore lies where the layered model's picture plane does, and turns and foreshortens as the model does. After a rebake of the bank, run `node packages/bake/cli/prepare-galaxy-backing.mts src/objects/homunculus-nebula-layers backing` again.

## Rebuilding

The lane and detail maps are built from the downloaded HST products, then the bank is baked and its far view composited:

```
node packages/bake/authoring/homunculus-nebula/filament-map.mts src/objects/homunculus-nebula-layers <directory of the FITS files>
node packages/bake/cli/prepare-image-layers.mts src/objects/homunculus-nebula-layers
node packages/bake/cli/prepare-galaxy-backing.mts src/objects/homunculus-nebula-layers backing
```

Without the downloads, `filaments.png` and `detail.png` are restored from the source cache once published there.

## Evidence

The bake's tests ([surface-mesh.test.ts](../../../packages/bake/src/image-layers/surface-mesh.test.ts), [filaments.test.ts](../../../packages/bake/src/image-layers/filaments.test.ts)) close a surface with a hole so that every edge is held by two triangles, fill a hole in a field from its rim, draw a closed ball as triangles each opaque inside itself and clear past its long side, find a dark line as a filament and a dark spot of the same depth as far less of one, and read the recipe's closed mesh and maps and refuse what they cannot. The renderer's test paints the run nearest the camera last, and turns the order round from behind.

## Known problems

- The faces the picture does not show are filled with the pattern of the faces it does: plausible dust, not what is there.
- The far lobe's own pattern is seen through the skirt; its color is the near lobe's, by assumption.
- Within 2.9″ of the star the detail is the ultraviolet bands', and its brightness the light carried in from around the glare.
- The model's unit, turn and star are measured on this picture, not published. A model made from 2012 spectra is laid on a picture made from earlier exposures; the nebula expands.
- The skirt's fans are drawn by hand and its thickness is modeled. The outer ejecta and the red nebulosity around the lobes are left out.
- Each triangle is its own scene: the bank comes in two scenes a frame, which takes a few seconds.
- Colors are the publisher's display composite, not a measurement.
