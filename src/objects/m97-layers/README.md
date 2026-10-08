# Owl Nebula

A survey image of the Owl Nebula, its light spread through the nebula's published body: a ball of gas, 0.86 pc across, with cavities along its pole, the owl's eyes. **The outline, the pole and the side of the star each cavity is on are published. How much gas lies at each depth is read from the picture, not measured.**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [Sloan Digital Sky Survey](https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FSDSS9%2Fcolor&get=record) | [Record](../../sources/sdss-dr9-color-hips.json). SDSS9 color: SDSS g, r and i; 2000 × 2000 px over 7.20 × 7.20 arcmin (`source/starless.jpg`: the publisher's picture with its stars removed, restored from the source cache). Credit: Sloan Digital Sky Survey; color HiPS CDS/P/SDSS9/color by T. Boch (CDS), cut out by the CDS hips2fits service. A display composite, not calibrated photometry. |
| Chornay & Walton (2021) | [Record](../../sources/chornay-walton-2021-pn-central-stars.json). Distance: 811 pc (782 to 842). |
| [García-Díaz et al. (2018)](https://arxiv.org/abs/1806.04676) | [Record](../../sources/publication-garcia-diaz-2018-owl-nebula-cavities.json). Sect. 3: a shell model does not fit the spectra; the H-alpha outline is a slightly prolate spheroid filled with emission, inclined about 25° with its north-west half toward Earth, and the cavity is a volume carved from it that multiplies the emission inside by 0.3. Sect. 2.3: the velocity channels need three cavity lobes, one to the north-west pointing toward us and two to the south-east, the more easterly toward us and the more southerly away. |
| [Guerrero et al. (2003)](https://arxiv.org/abs/astro-ph/0303056) | [Record](../../sources/publication-guerrero-2003-owl-nebula.json). From echelle spectra: the inner shell's boundary is an ellipsoid of radius 93″ along its pole and 83″ across it, the pole 10° to 30° from the line of sight; each eye is about 35″ in size; the outer shell is a filled, almost circular envelope, 218″ across; the brighter forehead and beak are denser gas along the equatorial plane, seen at the systemic velocity; [N II] lies in a thin shell outside the H-alpha and [O III] gas. |

## The picture

- **Stars:** [NOX](../../../labs/nebula/docs/star-removal.md) removes the stars from the picture before the bake (`node labs/nebula/run.mts remove-stars src/objects/m97-layers --coarse=4`). It predicts the light under a star; it does not measure it. NOX then ran again over a copy a quarter of the size (500 x 500 px), where the saturated stars are small enough for it, and the picture took that pass's result where it took a star: 2.33% of the picture. The central star goes with the rest.
- **Registration:** The cutout's registration is its request: a tangent projection centred on the nebula's central star, north up.
- **Body:** the gas fills a sphere of radius 109″ about the star (the envelope, 218″ across). Inside it is the spheroid of the inner shell, 93″ along its pole and 83″ across it, the pole 25° from the sight line with its near end leaning north-west (position angle 300°). The cavities are inside the spheroid.
- **Gas by distance from the star:** both papers find the nebula nearly round, so the gas is taken to be the same all around the star at one distance from it. How much each display channel emits at each distance is read from the picture: the middle (median) of its light around the star at each radius, taken apart shell by shell from the outside in, 64 shells. Each pixel's light is spread along its sight line by that emissivity. The result has the order the spectra give: blue (the g band, with [O III]) fills the inside, and green (the r band, with H-alpha and [N II]) reaches farther out.
- **Cavities:** García-Díaz et al. measure the cavities as dips in brightness around the star at one radius. Where a pixel is dimmer than the middle at its radius, its sight line passes a cavity that emits 0.3 of the gas around it, as long as takes that much light away. The cavity is centred where the sight line passes the pole's line: in front of the star to the north-west; to the south-east, in front for the easterly lobe and behind the star for the southerly one (position angles 135° to 210°). The near lobe is led into the far one over 30° of position angle, so no wall stands between them; that join is this bake's choice. The picture is read no finer than 4.4″ for this, and only where the path through the spheroid is at least half its longest.
- **Denser gas:** where a pixel is brighter than the middle at its radius, the light above the middle lies about the spheroid's equatorial plane, where Guerrero et al. put the denser gas of the forehead and beak. It is spread over 35″ along the sight line, an eye's size, most at the plane; that length is this bake's choice.
- **Drawing:** from the front, 32 slabs parallel to the picture, each holding the light between its two faces; from the side, 40 and 40 curtains through the picture's columns and rows. All are 256 pixels across, half the picture's resolution: the survey image is no sharper. The slabs' colors are solved so that the Sun, looking through the nearer slabs, sees the picture's own color at every pixel.
- **Outside the body:** the flat picture ends where the envelope ends, fading out between 109″ and 121″ from the star. Beyond that the survey image holds only sky noise; the nebula's faint halo is not in it.
- **Size:** 7.20 × 7.20 arcmin, 1.70 pc wide at 811 pc; the body is 0.86 pc across.
- **Far view:** from afar, while another body is selected, the bank is one image on a plane fixed in its frame, drawn as the Milky Way's backing is. [`prepare-galaxy-backing.mts`](../../../packages/bake/cli/prepare-galaxy-backing.mts) reads the [backing recipe](source/backing/recipe.json) and composites the bank's flat source-facing slices as seen from the Sun, the picture its camera-facing billboard drew, onto the slices' own plane through the frame's centre. The plane therefore lies where the layered model's picture plane does, and turns and foreshortens as the model does. After a rebake of the bank, run `node packages/bake/cli/prepare-galaxy-backing.mts src/objects/m97-layers backing` again.

## Evidence

![The Owl Nebula as its page opens: the flat picture on main, and the picture in its body](evidence/2026-10-03/front.jpg)

The Owl Nebula page in headless Chromium at 1440 × 900, device pixel ratio 2, on 2026-10-03, as it opens: the flat picture as main had it, and this bank. This bank opens closer, because it ends at the envelope.

![The Owl Nebula turned: obliquely, from the side and from above](evidence/2026-10-03/views.jpg)

The same page with the camera turned. No page errors.

The bake's test ([shape.test.ts](../../../packages/bake/src/image-layers/shape.test.ts)) builds a small filled body with two dim patches, checks that each patch's cavity is on its published side of the star, and composites the slabs along the Sun's sight line as a browser draws them. The same sum over this bank's slabs differs from its flat bake by 1.3, 1.4, 2.0 of 255 levels (red, green, blue) on average.

## Known problems

- The far picture holds only the flat slices' light, and this bank's light is almost all on its walls, which are left out, as they were from the billboard it replaced: from afar the plane draws almost nothing. Edge-on it vanishes.
- No depth is measured at any pixel. A cavity's length comes from how dim the picture is, and the picture is a display composite, not calibrated flux: where it is near full brightness, small differences in the picture become large differences in gas.
- The gas is the same all around the star at one distance, apart from the cavities and the denser gas. A knot at the rim is therefore spread along its whole sight line.
- The papers disagree on which end of the pole is nearer. Guerrero et al. find the north-west lobe red-shifted and the south-east one blue-shifted; García-Díaz et al., with more slits, put the north-west half toward Earth. This bake follows the later paper.
- García-Díaz et al. build the cavity as a mesh of fingers that their paper does not print. Here only the side of the star each lobe is on is theirs. Each lobe lies almost along the sight line, 25° from it, so from the side it is a steep band.
- Around the removed central star a little light is left; the body draws it as a small bright core at the star's place.
- From the side the picture's detail is soft: the curtains are 256 pixels across.
- The bank is 1.0 MB, 0.5 MB of it for the view the page opens on; the flat picture was 0.5 MB, most of it sky noise.
- NOX removed the stars. Where the second pass took a saturated star, a soft patch a quarter as sharp stands in its place, and compact light of the nebula's own can go with the stars.
- Colors are the publisher's display composite, not a measurement.
