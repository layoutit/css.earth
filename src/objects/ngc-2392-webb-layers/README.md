# NGC 2392, infrared

ESA/Webb's infrared picture of the planetary nebula NGC 2392, on the walls its spectra give. It is the NGC 2392 page's second dataset, beside [Hubble's photograph](../ngc-2392-layers/README.md), and it was written and baked by `telescope new-object` from one spec entry ([guide](../../../packages/telescope-cli/README.md)). **The walls are the Hubble dataset's: two shells from published expansion speeds, and 536 measured structures that say which side a feature is on. No speed is measured in the infrared light this picture shows, so every color takes the speeds measured in [N II].**

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Webb weic2616a](https://esawebb.org/images/weic2616a/) | [Record](../../sources/esawebb-weic2616a.json). Lion Nebula (NIRCam + MIRI image): NIRCam at 1.15, 1.87, 2.12 and 3.35 µm and MIRI at 10 µm; 3505 × 3505 px over 1.77 × 1.77 arcmin (`source/source.jpg`, the publisher's JPEG, restored from its origin). Credit: NASA, ESA, CSA, STScI. Image Processing: A. Pagan (STScI). A display composite, not calibrated photometry. |
| [García-Díaz et al. (2012)](https://arxiv.org/abs/1211.6717) | [Record](../../sources/publication-garcia-diaz-2012-ngc-2392-model.json). The two shells and their speeds, as in the Hubble dataset: an outer shell close to a sphere of 23″ expanding at 16 km/s, and an inner shell, a prolate spheroid at 120 km/s along its long axis, tilted 9° from the sight line; caps at 55 km/s and cometary knots at rest on an equatorial disc. |
| [García-Díaz et al. (2015)](https://arxiv.org/abs/1411.0042) | [Record](../../sources/publication-garcia-diaz-2015-ngc-2392-proper-motions.json). Table 3 (`source/proper-motions.dat`, the CDS file, a copy of the Hubble bank's): 536 structures with their place from the central star and their radial velocity, from two Hubble pictures 7.7 years apart and high-resolution spectra. |

## The picture

- **Registration:** the file's embedded sky tags give scale and direction, 0.0304″ per pixel and north 170.0° left of vertical. The star gives the place: the largest patch of saturated pixels within 1″ of where the tags put the central star, 51 pixels, is set at the star's place, where the page stands. The tags alone put it 0.22″ away.
- **What the colors show:** by ESA/Webb's release and its table, ionised hydrogen (Paschen-alpha, 1.87 µm, cyan) in the bubble, and molecular hydrogen (2.12 µm, yellow), PAH (3.35 µm, orange) and silicate dust (10 µm, red) in the shell of dust around it. No paper on these observations was found on 2026-10-05 (`telescope papers "NGC 2392" --instrument JWST`).
- **The walls:** the Hubble dataset's, unchanged; [its README](../ngc-2392-layers/README.md) has the method. The outer shell is a sphere of 23″ whose law is 16 km/s at 23″. The inner shell is a prolate spheroid tilted 9° from the sight line, its outline 11.0″ by 9.2″. Inside it a structure measured approaching is on the wall in front of the star and one receding on the wall behind. Between the shells the fine detail lies on the equatorial plane where the measured structures are at rest, and toward the outer shell's wall where they move at the caps' speed.
- **Which speed each color takes:** all of them the [N II] speeds, the only ones measured. The bubble's Paschen-alpha is the same ionised gas as its H-alpha. The clumps of the dust shell are where the model has its cometary knots.
- **The rim, measured again:** the Hubble bank's script, run on this picture ([inner-shell-rim.mts](../../../packages/bake/authoring/ngc-2392/inner-shell-rim.mts) `ngc-2392-webb-layers`), finds the bubble's rim inside an ellipse of 10.82″ by 9.09″ about the star, the long axis toward position angle 25°. On Hubble's photograph of 2000 it finds 10.80″ by 9.15″ toward 28°. The wall's outline holds both.
- **The star:** the star's own light ends 1.4″ from it in this picture: past its saturated middle, the brightest channel's middle value in rings 0.1″ wide stops falling there. All of the light within 0.7″, and less and less of it out to 1.4″, stays at the star.
- **Drawing:** from the front, 56 terraces parallel to the picture; from the side, 56 and 56 curtains through its columns and rows. The face is 1,500 px of the picture's 3,505.
- **Size:** 1.77 × 1.77 arcmin, 0.93 pc wide at 1,795 pc; the outer shell is 0.40 pc across.
- **Rim:** the picture fades out between 46.8″ and 52.0″ from the star, the largest circle the frame holds.
- **Far view:** from afar, while another body is selected, the bank is one image on a plane fixed in its frame, drawn as the Milky Way's backing is. [`prepare-galaxy-backing.mts`](../../../packages/bake/cli/prepare-galaxy-backing.mts) reads the [backing recipe](source/backing/recipe.json) and composites the bank's flat source-facing slices as seen from the Sun, the picture its camera-facing billboard drew, onto the slices' own plane through the frame's centre. The plane therefore lies where the layered model's picture plane does, and turns and foreshortens as the model does. After a rebake of the bank, run `node packages/bake/cli/prepare-galaxy-backing.mts src/objects/ngc-2392-webb-layers backing` again.

## Evidence

![NGC 2392 in Webb's infrared picture, turned: obliquely, farther round, and from above](evidence/2026-10-05/views.jpg)

The page with this dataset selected, in headless Chromium at 1440 × 900, device pixel ratio 2, on 2026-10-05, with the camera turned: the bubble inside the round shell. No page errors.

![The same dataset as the page opens on it, at the nearest view, and there turned](evidence/2026-10-05/front.jpg)

The same dataset as the page opens on it, from the nearest the camera comes, and from there turned.

The terraces of this bank, composited along the Sun's sight line, differ from a flat bake of the picture by 0.62 of 255 levels per channel on average. A second bake of the recipe gives the same 169 files. No bake code changes with this dataset.

## Known problems

- The far picture holds only the flat slices' light: the walls' patches are left out, as they were from the billboard it replaced, so from afar the bank looks fainter than its layers do once selected. Edge-on the plane vanishes.
- No speed is measured in this picture's light. Dust and molecular hydrogen are drawn at the depths of the ionised gas where they lie on the sky.
- The measured structures' places are from Hubble pictures of 2000 and 2007. Even at the inner shell's 120 km/s, a structure moves under 0.3″ across the sky in the twenty years since, inside the 1″ a measurement reaches.
- The star's eight diffraction spikes are the telescope's, not the nebula's. Past 1.4″ they lie on the walls they cross.
- Everything the [Hubble dataset's known problems](../ngc-2392-layers/README.md#known-problems) say of the walls holds here: the fur is one surface, the inner shell is a plain spheroid about the star, and the wall a feature is on is known only where it was measured.
- Galaxies and stars inside the outer shell's outline lie on its walls.
- Turned far from the Sun's view, the terraces show as steps.
- Colors are the publisher's display composite, not a measurement.
- The bank is 2.9 MB: 1.5 MB of it the terraces for the view the dataset opens on, 0.4 MB the curtains, 0.3 MB the leaf records and 0.75 MB the dataset's preview picture. Headless Chromium draws it; Safari is not measured yet.
