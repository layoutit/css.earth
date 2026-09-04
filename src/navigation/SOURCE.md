# Planet navigation marker sources

The navigation uses one prepared atlas of source-derived raster markers.
Planned planets keep their marker sources here. Implemented planets own their
marker source and exact preparation recipe inside their adapter. The shared
assembler validates every input hash and applies those recipes without a
planet-specific branch. No cssEarth scene capture is used by the markers.

| Planet | Source | SHA-256 |
| --- | --- | --- |
| Sun | https://science.nasa.gov/wp-content/uploads/2024/07/bigsunspot-hmiintensity-00200-print.jpg?w=768 | `58c23164c4bae8352a88c7473345bc43067000ecc8a956a3328b64adb0e83c43` |
| Mercury | https://science.nasa.gov/wp-content/uploads/2023/11/mercury-messenger-globe-pia15162.jpg | `5ea3d3b713fce74f6b45faa182023210ada11ae62b8b51183a5fc134e7ce1304` |
| Venus | https://science.nasa.gov/wp-content/uploads/2023/05/688-venus-1200-jpg.webp | `59ff56b81de18402302f1e397384bd1d7fecff906d04ef229a64462fe516f42a` |
| Earth | https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001016/GSFC_20171208_Archive_e001016~large.jpg | `48ccd32ef57d182662999905841109095d66d68d69e27dba7decc6e134a811a0` |
| Mars | Adapter-owned NASA/ESA Hubble source at `src/planets/mars/source/presentation/navigation-marker.jpg` | `f55dad386a7d45e2758c0dc1d520c40dc6f2aaa517f08451facba738e121b8cb` |
| Jupiter | Adapter-owned NASA/ESA/STScI Hubble source at `src/planets/jupiter/source/presentation/navigation-marker.png` | `50d1a1cb022550f18e835d9f8cb56e44c9b8196dfd19954ae6413c6e92fc3ebe` |
| Saturn | Adapter-owned OpenSpace surface at `src/planets/saturn/source/saturn-surface-original.jpg` | `5976d520c16f7c91a7415bdaeb1a050373a706c07adae29b38b8b5110d88acc0` |
| Uranus | https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg | `3dcc83114f1a25caa1ae1a1436830fffaa15a3e429666dbf4c68bcf035e8932b` |
| Neptune | https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/0/PIA01492-1.jpg/jcr:content/renditions/cq5dam.web.1280.1280.jpeg | `3cf960937217cb53d52f67d0c30d53c694cfbafc2ac8ca137c6539eb12a2a312` |

The sidebar collapse control uses Jeremy Schnittman's NASA Goddard scientific
visualization of a black-hole accretion disk. The exact 1024px source is kept at
`src/navigation/source/black-hole-accretion-disk-nasa.jpg` with SHA-256
`40719fba8771e81aefd47f678d9b13b85161201a1674cf3ed65d67c64dcc348c`.
Preparation crops the source, maps its luminance to the approved restrained
violet treatment and alpha, and writes fixed transparent PNG markers at 1x and
2x. Credit:
NASA's Goddard Space Flight Center/Jeremy Schnittman. Source:
https://svs.gsfc.nasa.gov/13326.

The sidebar expand control uses the NASA, ESA, and CSA Webb MIRI view of
Cassiopeia A at `src/navigation/source/cassiopeia-a-miri.png`. Preparation
rotates, crops, and masks the source into fixed transparent PNG markers at 1x
and 2x.

The Settings action uses the project-authored planet silhouette with a cog
cutout at `src/navigation/source/settings-mark.svg`. It passes through the same
prepared monochrome shading treatment and 48px transparent tile as the GitHub
action marker.

Mars is the NASA, ESA, the Hubble Heritage Team (STScI/AURA), J. Bell (ASU),
and M. Wolff (Space Science Institute) 2016 full-disc Hubble view, released by
ESA/Hubble under CC BY 4.0. Jupiter owns the NASA, ESA, STScI, and Amy Simon
2024 full-disc Hubble view inside its adapter. Saturn uses the exact OpenSpace
source already owned by the Saturn adapter.

Prepared output: `pnpm prepare:navigation` writes the 1× and 2× planet-marker
atlas, Sun marker, black-hole marker, supernova marker, and action markers to
`public/navigation/`.
