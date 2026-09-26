# Navigation marker sources

The navigation uses one prepared atlas of source-derived raster markers.
This table lists the Sun and the eight planets. A marker source marked adapter-owned, like every
other object's, lives with its exact preparation recipe inside the object's adapter. The shared
assembler reads every input and applies those recipes without an
object-specific branch. No cssEarth scene capture is used by the markers.

| Object | Source |
| --- | --- |
| Sun | https://science.nasa.gov/wp-content/uploads/2024/07/bigsunspot-hmiintensity-00200-print.jpg?w=768 |
| Mercury | https://science.nasa.gov/wp-content/uploads/2023/11/mercury-messenger-globe-pia15162.jpg |
| Venus | https://science.nasa.gov/wp-content/uploads/2023/05/688-venus-1200-jpg.webp |
| Earth | https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001016/GSFC_20171208_Archive_e001016~large.jpg |
| Mars | Adapter-owned NASA/ESA Hubble source at `src/objects/mars/source/presentation/navigation-marker.jpg` |
| Jupiter | Adapter-owned NASA/ESA/STScI Hubble source at `src/objects/jupiter/source/presentation/navigation-marker.png` |
| Saturn | Adapter-owned OpenSpace surface at `src/objects/saturn/source/saturn-surface-original.jpg` |
| Uranus | https://images-assets.nasa.gov/image/PIA18182/PIA18182~orig.jpg |
| Neptune | https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/p/i/a/0/PIA01492-1.jpg/jcr:content/renditions/cq5dam.web.1280.1280.jpeg |

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

Prepared output: `node tools/prepare/cli/prepare-navigation.mts` writes the 1× and 2× planet-marker
atlas, Sun marker, black-hole marker, supernova marker, and action markers to
`public/navigation/`.


Resolved world-context parents use independent prepared images from the same
pinned object source and crop recipe. `prepare:navigation` derives the required
parents from registered satellites and the astronomy catalogue, so adding a
moon does not require a second list of parent identities. The canonical output
is capped at 1536 pixels and at the native source crop: Earth 993, Jupiter 1019,
and Saturn 1440 pixels in the current catalogue. These three images add about
275 KiB total; small UI markers retain their existing atlas. Their physical size,
positions, camera behavior and retained context elements are unchanged. No
second detailed object scene is mounted. The images remain source-derived
context proxies; they do not claim a newly rendered observation geometry.

The Sun's scene indicator is a project-authored rounded heptagonal outline.
`prepareSunIndicator` in `tools/prepare/prepare-navigation.mts` rasterizes the numerical
path to `public/navigation/sun-indicator-heptagon.png` at a fixed 80px resolution for a
20px UI box. Its stroke uses the authored soft-yellow `display.hex` accent in
`src/objects/sun/swatch.json`, matching the navigation label. The independent
spectral swatch remains recorded there with its ASTM E490-00, CIE 1931, and sRGB
provenance.
The PNG includes a 2px center dot so the navigation landmark remains visible
at distant scales. The Sun's physical point and glow still render separately.
