# Nebula Lab source images

These are inspection inputs, not an aligned composite or measured 3D scene.
The adjacent `index.json` records URLs, credits, SHA-256 checksums, bands
and original/derivative AVM/TAN registration. Paths are relative to `labs/nebula`.

- **LMC:** the existing SMASH JPEG is reused without duplication. Credit:
  CTIO/NOIRLab/NSF/AURA/SMASH/D. Nidever (Montana State University);
  image processing Travis Rector, Mahdi Zamani and Davide de Martin.
- **Tarantula:** `tarantula-eso1816a.jpg` is the unmodified official ESO
  screen-size JPEG, 1280 × 1285, 799,300 bytes. Credit: **ESO**.
  It was decoded and visually inspected. Both images are CC BY 4.0;
  retain each source's full credit beside the displayed image.

[ESO source page](https://www.eso.org/public/images/eso1816a/) offers the
16,655 × 16,719 [original TIFF](https://cdn.eso.org/images/original/eso1816a.tif)
(737.6 MB) for a later explicit high-resolution acquisition. It is not included.
The included derivative is reproducibly available at
<https://cdn.eso.org/images/screen/eso1816a.jpg>.

The downloaded JPEGs retain AVM metadata referring to their **original** pixel
dimensions. The JSON separately scales each reference-pixel coordinate by the
derivative/original axis ratio, divides angular scale by that ratio, and scales
the corresponding CD-matrix columns. This follows AVM proportional image
resizing; it does not establish subpixel astrometric accuracy. Use the supplied
CD matrix for rotated images, account for DOM's downward y axis, and verify
matched stars before composition. Original metadata remains unchanged.

SMASH combines g/r/i/z; the VST image combines g/r/i and H-alpha with a different
display-color mapping. Match registration and colors before blending. JWST's
[Tarantula image](https://science.nasa.gov/asset/webb/tarantula-nebula-nircam-image/)
maps infrared F090W/F200W/F335M/F444W to visible colors; it is a different spectral
view, not interchangeable optical detail. Angular WCS contains no 3D depths.

The [Orion HST Treasury archive](https://archive.stsci.edu/prepds/orion/) is a
reference-only entry. An actual F435W SCI-extension header was checked; its
full image and the other filters were not downloaded. No ready Orion scene is
implied, and this dataset covers the Orion Nebula Cluster rather than the whole
Orion molecular-cloud complex.
