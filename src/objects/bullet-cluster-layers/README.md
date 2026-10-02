# Bullet Cluster picture

A published picture of Bullet Cluster stands at the cluster's place and distance as one flat image facing the Sun. It is a picture
of the sky: nothing in it has depth, and seen from the side it is a line.

## Sources

| Selected source | Input and meaning |
| --- | --- |
| [ESA/Hubble opo0639a](https://esahubble.org/images/opo0639a/) | [Record](../../sources/esahubble-opo0639a.json). Pink: hot gas in X-rays (Chandra). Blue: mass from gravitational lensing. Orange and white: galaxies in visible light (Magellan, Hubble). The publisher's Large JPEG, 3000 × 2168 px (`source/source.jpg`, restored from its origin; not tracked). [CC BY 4.0](https://esahubble.org/copyright/), credit: X-ray: NASA/CXC/M.Markevitch et al. Optical: NASA/STScI; Magellan/U.Arizona/D.Clowe et al. Lensing Map: NASA/STScI; ESO WFI; Magellan/U.Arizona/D.Clowe et al. A display composite, not calibrated photometry. |
| [MCXC-II, Sadibekova et al. (2024)](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/688/A187) | [Record](../../sources/mcxc-ii-2024.json). Row MCXC J0658.5-5556: position 104.6296°, -55.9469° and redshift 0.2965, from [2004A&A...425..367B](https://ui.adsabs.harvard.edu/abs/2004A&A...425..367B). |
| [Planck Collaboration (2020)](https://arxiv.org/abs/1807.06209) | [Record](../../sources/planck-2018-cosmology.json). The redshift's comoving distance in the Planck 2018 cosmology, 1,219 Mpc (Astropy 8.0.1, `Planck18`): the distance the picture stands at. |
| [Gaia DR3](https://doi.org/10.1051/0004-6361/202243940) | [Record](../../sources/gaia-2023-dr3.json). The 172 sources in the frame (CDS `I/355/gaiadr3`, a cone query on the picture's centre), used only to measure where the picture lies on the sky. |

## The picture

- **Registration:** measured, not taken from the page. Starting from the file's embedded tags, 127 of the 172 Gaia DR3
  sources in the frame have a peak at their place; a least-squares fit of centre, scale and rotation to them leaves
  0.16″ rms (worst 0.31″). It gives 0.1489″ per pixel, north 0.02° left of vertical, centre
  104.617027°, -55.944059°, a field of 7.45 × 5.38 arcmin. The tags say 0.1487″ per pixel and
  0.02°; the fitted centre is 0.42″ from theirs. Gaia positions are at epoch 2016 and no proper motion is applied.
- **Plane:** the picture's own tangent plane, perpendicular to the sight line through the picture's centre and passing through
  the cluster's place, so it faces the Sun. The picture's centre is 27.3″ from the catalogue position, which is the
  recipe's whole inclination (0.0076°). This is where a sky picture lies, not a measured orientation of the cluster.
- **Size:** 2.64 × 1.91 Mpc at the cluster's comoving distance (the angle times the distance). The page
  frames 955 kpc, half the picture's short side.
- **Sky:** light below 8 of 255 is taken as sky and left transparent, so the universe's own dots show through it. The lowest floor tried, kept for the faint outer pink and blue haze; a floor of 20 of 255 would save 15% of the bytes.
- **Edges:** the outer 4% of the frame fades out, so the picture has no hard rectangular edge.
- **Bytes:** one image, 1022 × 740 px, 441 KB (WebP quality 70, alpha quality 80), 1,024 px on its long side as the
  Milky Way's backing image is. Alpha quality 60 saved a further 25 to 40% but drew contour bands in the galaxies' halos.

## Evidence

![Bullet Cluster in the app](evidence/2026-10-02/views.jpg)

The Bullet Cluster page in headless Chromium at 1440 × 900, device pixel ratio 2, on this branch on 2026-10-02: the default
arrival, the camera turned part of the way round, and the picture seen from the side, where it is a line.

## Measured, chosen and inferred

| Value | Kind |
| --- | --- |
| Position 104.6296°, -55.9469° and redshift 0.2965 | Measured: MCXC-II row MCXC J0658.5-5556 |
| Distance 1,219 Mpc | Derived: the redshift's comoving distance in the Planck 2018 cosmology |
| Field, scale and rotation of the picture | Measured: fitted to Gaia DR3 positions |
| Flat plane facing the Sun | The geometry of a sky picture; no depth is measured or drawn |
| Sky floor, edge fade, 1,024 px, framing radius | Presentation |

## Known problems

- The picture is flat: seen from the side it is a line, and from behind it is mirrored.
- Everything in the frame stands on the cluster's plane, whatever its own distance: Milky Way stars in front of the cluster and the
  far galaxies behind it are part of the picture.
- The pink and blue are the publisher's overlays of an X-ray image and a lensing mass map on a visible-light image: they show where the gas and the mass are, not light the eye would see. The overlays' own registration to the visible-light image is the publisher's and is not measured here.
- The page opens with ecliptic north up, as every page does, so the picture arrives turned from the publisher's orientation.
- A flight from another page keeps the travelling camera's angle, so it can arrive seeing the picture from an oblique angle or
  nearly from the side. Opening the page directly faces the picture.
- The size is a comoving size. The cluster is bound and does not expand with the universe; its proper size at its redshift is
  smaller by 1 + z.
