# Cartwheel Galaxy picture

A published picture of Cartwheel Galaxy stands at its place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Webb weic2211a](https://esawebb.org/images/weic2211a/) | [Record](../../sources/esawebb-weic2211a.json). Webb NIRCam and MIRI, from 0.9 to 18 µm: near-infrared blue to yellow, mid-infrared orange and red. The publisher's JPEG, 4685 × 4312 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esawebb.org/copyright/), credit: NASA, ESA, CSA, STScI. A display composite, not calibrated photometry. |
| [NED, ESO 350- G 040](https://ned.ipac.caltech.edu/byname?objname=ESO%20350-%20G%20040) | [Record](../../sources/ned-cartwheel-galaxy.json). Position 9.4214°, -33.7163° (2013wise.rept....1C) and redshift 0.030187 ± 0.00001 (1998A&A...330..881A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 133 Mpc, light travel time 0.43 billion years (Astropy 8.0.1, `Planck18`). |

## The picture

- **Placement:** The file's embedded sky tags, used as they are: 0.03000 arcsec per pixel, north 28.0° left of vertical, the frame's centre at 9.4234792°, -33.7132367°. Not measured against Gaia here; the same publishers' tags were within 0.4 arcsec on four cluster pictures and 1.5 arcsec off on one deep field.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre, so it faces the Sun. The picture's centre is 12.7″ from the published position, which is the recipe's whole inclination (0.003524°). This is where a sky picture lies, not a measured orientation.
- **Size:** 90.5 kpc × 83.3 kpc at the comoving distance (the angle times the distance). The page frames 41.6 kpc, half the picture's short side.
- **Rim:** the picture is drawn inside a circle and fades out between 70% and 98% of half its short side. Its corners are not drawn, so no straight edge or corner shows from any angle. A presentation choice.
- **Sky:** light below 8 of 255 is taken as sky and left transparent, so the universe's own dots show through it.
- **Bytes:** one image, 1,024 px on its long side (WebP quality 70, alpha quality 80), as the Milky Way's backing image is.

## Evidence

![Cartwheel Galaxy in the app](evidence/2026-10-02/views.jpg)

The Cartwheel Galaxy page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival and the camera turned part of the way round.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 9.4214°, -33.7163° and redshift 0.030187 ± 0.00001 | Measured: NED's preferred values (2013wise.rept....1C, 1998A&A...330..881A) |
| Distance 133 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | The publisher's embedded tags; not measured here |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Round rim, sky floor, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on one plane, whatever its own distance. The two companions and the faint galaxies behind stand on the Cartwheel's plane here, whatever their own distances.
- The round rim leaves the frame's corners out.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. A bound galaxy does not expand with the universe; its proper size at its redshift is smaller by 1 + z.
