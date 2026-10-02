# MACS J0416.1-2403 picture

A published picture of MACS J0416.1-2403 stands at the cluster's place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Webb weic2327a](https://esawebb.org/images/weic2327a/) | [Record](../../sources/esawebb-weic2327a.json). Visible light from Hubble and infrared from Webb, 0.4 to 5 µm, shown as colour: the shortest wavelengths blue, the longest red. The publisher's Large JPEG, 4457 × 4133 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esawebb.org/copyright/), credit: NASA, ESA, CSA, STScI, J. Diego (Instituto de Física de Cantabria, Spain), J. D’Silva (U. Western Australia), A. Koekemoer (STScI), J. Summers & R. Windhorst (ASU), and H. Yan (U. Missouri). A display composite, not calibrated photometry. |
| [MCXC-II, Sadibekova et al. (2024)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187) | [Record](../../sources/mcxc-ii-2024.json). Row MCXC J0416.1-2403: position 64.0375°, -24.0661° and redshift 0.3972, from [2016ApJS..224...33B](https://ui.adsabs.harvard.edu/abs/2016ApJS..224...33B). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The redshift's comoving distance in the Planck 2018 cosmology, 1,590 Mpc (Astropy 8.0.1, `Planck18`): the distance the picture stands at. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) | [Record](../../sources/gaia-2023-dr3.json). The 5 sources in the frame (CDS `I/355/gaiadr3`, a cone query on the picture's centre), used only to measure where the picture lies on the sky. |

## The picture

- **Registration:** measured, not taken from the page. Starting from the file's embedded tags, 5 of the 5 Gaia DR3
  sources in the frame have a peak at their place; a least-squares fit of centre, scale and rotation to them leaves
  0.06″ rms (worst 0.08″). It gives 0.0300″ per pixel, north 67.71° left of vertical, centre
  64.037488°, -24.074332°, a field of 2.23 × 2.06 arcmin. The tags say 0.0300″ per pixel and
  67.64°; the fitted centre is 0.29″ from theirs. Gaia positions are at epoch 2016 and no proper motion is applied.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre and passing through
  the cluster's place, so it faces the Sun. The picture's centre is 29.6″ from the catalogue position, which is the
  recipe's whole inclination (0.0082°). This is where a sky picture lies, not a measured orientation of the cluster.
- **Size:** 1.03 × 0.95 Mpc at the cluster's comoving distance (the angle times the distance). The page
  frames 477 kpc, half the picture's short side.
- **Sky:** light below 31 of 255 is taken as sky and left transparent, so the universe's own dots show through it. This deep picture's sky is brighter: at 20 of 255 the image costs 885 KB, at 31 it is 545 KB and the galaxies remain, and at 51 (262 KB) the faint ones go.
- **Edges:** the outer 4% of the frame fades out, so the picture has no hard rectangular edge.
- **Bytes:** one image, 1013 × 948 px, 545 KB (WebP quality 70, alpha quality 80), 1,024 px on its long side as the
  Milky Way's backing image is. Alpha quality 60 saved a further 25 to 40% but drew contour bands in the galaxies' halos.

## Evidence

![MACS J0416.1-2403 in the app](evidence/2026-10-02/views.jpg)

The MACS J0416.1-2403 page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival, the camera turned part of the way round, and the picture seen from the side, where it is a line.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 64.0375°, -24.0661° and redshift 0.3972 | Measured: MCXC-II row MCXC J0416.1-2403 |
| Distance 1,590 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | Measured: fitted to Gaia DR3 positions |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Sky floor, edge fade, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on the cluster's plane, whatever its own distance: Milky Way stars in front of the cluster and the
  far galaxies behind it are part of the picture.
- Only 5 Gaia DR3 sources lie in the frame, so the registration rests on 5 positions. The colours are visible and infrared light shown as colour.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. The cluster is bound and does not expand with the universe; its proper size at its redshift is
  smaller by 1 + z.
