# Stephan's Quintet picture

A published picture of Stephan's Quintet stands at its place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Webb weic2208a](https://esawebb.org/images/weic2208a/) | [Record](../../sources/esawebb-weic2208a.json). Webb NIRCam and MIRI, from 0.9 to 7.7 µm: near-infrared blue to orange, mid-infrared yellow and red. The publisher's JPEG, 4000 × 3835 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esawebb.org/copyright/), credit: NASA, ESA, CSA, and STScI. A display composite, not calibrated photometry. |
| [NED, HCG 092](https://ned.ipac.caltech.edu/byname?objname=HCG%20092) | [Record](../../sources/ned-stephans-quintet.json). Position 338.9896°, 33.9600° (2012AJ....143..144S) and redshift 0.0215 (1992ApJ...399..353H), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 95 Mpc, light travel time 0.31 billion years (Astropy 8.0.1, `Planck18`). |

## The picture

- **Placement:** The file's embedded sky tags, used as they are: 0.09505 arcsec per pixel, north 62.0° right of vertical, the frame's centre at 338.99763°, 33.9604911°. Not measured against Gaia here; the same publishers' tags were within 0.4 arcsec on four cluster pictures and 1.5 arcsec off on one deep field.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre, so it faces the Sun. The picture's centre is 24.1″ from the published position, which is the recipe's whole inclination (0.006692°). This is where a sky picture lies, not a measured orientation.
- **Size:** 174.7 kpc × 167.5 kpc at the comoving distance (the angle times the distance). The page frames 83.8 kpc, half the picture's short side.
- **Rim:** the picture is drawn inside a circle and fades out between 70% and 98% of half its short side. Its corners are not drawn, so no straight edge or corner shows from any angle. A presentation choice.
- **Sky:** light below 8 of 255 is taken as sky and left transparent, so the universe's own dots show through it.
- **Bytes:** one image, 1,024 px on its long side (WebP quality 70, alpha quality 80), as the Milky Way's backing image is.

## Evidence

![Stephan's Quintet in the app](evidence/2026-10-02/views.jpg)

The Stephan's Quintet page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival and the camera turned part of the way round.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 338.9896°, 33.9600° and redshift 0.0215 | Measured: NED's preferred values (2012AJ....143..144S, 1992ApJ...399..353H) |
| Distance 95 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | The publisher's embedded tags; not measured here |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Round rim, sky floor, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on one plane, whatever its own distance. NGC 7320, the leftmost galaxy, is far in front of the group but stands on the group's plane here. The publisher's 4,000 px Publication JPEG is used; the original is 12,654 px.
- The round rim leaves the frame's corners out.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. A bound group does not expand with the universe; its proper size at its redshift is smaller by 1 + z.
