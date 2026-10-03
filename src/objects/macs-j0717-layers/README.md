# MACS J0717 picture

A published picture of MACS J0717 stands at its place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Hubble opo0917a](https://esahubble.org/images/opo0917a/) | [Record](../../sources/esahubble-opo0917a.json). Hubble ACS at 606 and 814 nm, with Chandra X-ray light overlaid. The publisher's JPEG, 3000 × 2911 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esahubble.org/copyright/), credit: NASA, ESA, CXC, C. Ma, H. Ebeling and E. Barrett (University of Hawaii/IfA), et al. and STScI. A display composite, not calibrated photometry. |
| [NED, MACS J0717.5+3745](https://ned.ipac.caltech.edu/byname?objname=MACS%20J0717.5%2B3745) | [Record](../../sources/ned-macs-j0717.json). Position 109.3789°, 37.7583° (2011MNRAS.410.1939Z) and redshift 0.549 (2025A&A...703A.306D), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 2,109 Mpc, light travel time 5.54 billion years (Astropy 8.0.1, `Planck18`). |

## The picture

- **Placement:** The file's embedded sky tags, used as they are: 0.09711 arcsec per pixel, north 0.4° right of vertical, the frame's centre at 109.379778°, 37.7571709°. Not measured against Gaia here; the same publishers' tags were within 0.4 arcsec on four cluster pictures and 1.5 arcsec off on one deep field.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre, so it faces the Sun. The picture's centre is 4.7″ from the published position, which is the recipe's whole inclination (0.001309°). This is where a sky picture lies, not a measured orientation.
- **Size:** 2.98 Mpc × 2.89 Mpc at the comoving distance (the angle times the distance). The page frames 1.44 Mpc, half the picture's short side.
- **Rim:** the picture is drawn inside a circle and fades out between 70% and 98% of half its short side. Its corners are not drawn, so no straight edge or corner shows from any angle. A presentation choice.
- **Sky:** light below 8 of 255 is taken as sky and left transparent, so the universe's own dots show through it.
- **Bytes:** one image, 1,024 px on its long side (WebP quality 70, alpha quality 80), as the Milky Way's backing image is.

## Evidence

![MACS J0717 in the app](evidence/2026-10-02/views.jpg)

The MACS J0717 page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival and the camera turned part of the way round.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 109.3789°, 37.7583° and redshift 0.549 | Measured: NED's preferred values (2011MNRAS.410.1939Z, 2025A&A...703A.306D) |
| Distance 2,109 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | The publisher's embedded tags; not measured here |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Round rim, sky floor, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on one plane, whatever its own distance. The X-ray glow is the publisher's overlay of hot gas, not light the eye would see.
- The round rim leaves the frame's corners out.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. A bound cluster does not expand with the universe; its proper size at its redshift is smaller by 1 + z.
