# SMACS 0723 picture

A published picture of SMACS 0723 stands at its place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Webb weic2209a](https://esawebb.org/images/weic2209a/) | [Record](../../sources/esawebb-weic2209a.json). Webb NIRCam, six filters from 0.9 to 4.4 µm, the shortest wavelengths blue and the longest red. The publisher's JPEG, 4537 × 4630 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esawebb.org/copyright/), credit: NASA, ESA, CSA, and STScI. A display composite, not calibrated photometry. |
| [NED, SMACS J0723.3-7327](https://ned.ipac.caltech.edu/byname?objname=SMACS%20J0723.3-7327) | [Record](../../sources/ned-smacs-0723.json). Position 110.8054°, -73.4569° (2024ApJ...964..146F) and redshift 0.391 ± 0.0007 (2025A&A...699A.105A), NED's preferred values. |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The cosmology that turns the redshift into a distance: comoving distance 1,568 Mpc, light travel time 4.34 billion years (Astropy 8.0.1, `Planck18`). |

## The picture

- **Placement:** The file's embedded sky tags, used as they are: 0.02999 arcsec per pixel, north 35.0° left of vertical, the frame's centre at 110.8277933°, -73.4539034°. Not measured against Gaia here; the same publishers' tags were within 0.4 arcsec on four cluster pictures and 1.5 arcsec off on one deep field.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre, so it faces the Sun. The picture's centre is 25.4″ from the published position, which is the recipe's whole inclination (0.00706°). This is where a sky picture lies, not a measured orientation.
- **Size:** 1.03 Mpc × 1.06 Mpc at the comoving distance (the angle times the distance). The page frames 517.2 kpc, half the picture's short side.
- **Rim:** the picture is drawn inside a circle and fades out between 70% and 98% of half its short side. Its corners are not drawn, so no straight edge or corner shows from any angle. A presentation choice.
- **Sky:** light below 8 of 255 is taken as sky and left transparent, so the universe's own dots show through it.
- **Bytes:** one image, 1,024 px on its long side (WebP quality 70, alpha quality 80), as the Milky Way's backing image is.

## Evidence

![SMACS 0723 in the app](evidence/2026-10-02/views.jpg)

The SMACS 0723 page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival and the camera turned part of the way round.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 110.8054°, -73.4569° and redshift 0.391 ± 0.0007 | Measured: NED's preferred values (2024ApJ...964..146F, 2025A&A...699A.105A) |
| Distance 1,568 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | The publisher's embedded tags; not measured here |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Round rim, sky floor, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on one plane, whatever its own distance. The arcs are galaxies far behind the cluster and the spiked points are Milky Way stars; all stand on the cluster's plane here.
- The round rim leaves the frame's corners out.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. A bound cluster does not expand with the universe; its proper size at its redshift is smaller by 1 + z.
