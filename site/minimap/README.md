# Spatial minimap

A setting, off by default: **Settings → Minimap**. The shared world context owns
it through [`minimap-setting.mts`](minimap-setting.mts). While the setting is off
the page downloads no minimap code or prepared points, builds no markers and
projects nothing. The first switch on imports this module, builds the markers
and draws the current view. Switching it off again keeps the retained markers,
hides them in CSS and stops projection. The preference lasts for the visit and
carries across body changes; it is not stored. Phones never draw the minimap, so
they do not offer the setting. With the minimap hidden, the dataset context
cards may use its corner.
Prepared assets are refreshed after object JSON preparation in `predev` and `prebuild`.

Bottom-right above the status bar: 190px on desktop, 140px on narrow screens.
The middle plane and markers follow
the main camera's orientation, position and zoom, including navigation flights.
The displayed neighborhood is centered on the camera's forward ray at the
selected body's depth, with a radius derived from that depth and the viewport's
field of view. Dots fade out at an invisible spherical boundary around the
neighborhood, inset to keep each full marker inside the minimap. The grid is
the middle plane: dots retain their height above and below it, including when
the plane is edge-on. The overlay passes input
through to the main scene. No atmospheric circle, camera marker, card, visible
labels or separate camera. Its one setting is the switch above.

Registered bodies from the prepared world context retain their physical positions; no distance
compression or artificial separation is applied. Rings have fixed physical
radii, doubling between successive rings, and expand or contract with the same
camera scale as the dots. Rings fade in near the center and out at the edge as
the visible range changes; their maximum opacity is 30% and stroke remains 1px.
An outer rim marks the edge of the minimap and remains visible at every zoom.
The reference plane follows the ecliptic locally and the prepared
galactic plane at galactic scales. Marker sizes are symbolic and remain readable
as their positions scale with camera zoom.

The minimap uses 2,048 real stars selected from the prepared HYG catalog (1,024
nearest and 1,024 intrinsically brightest), not a complete stellar inventory.
At galactic scales a face-on density projection, prepared from the existing
Milky Way Z slabs, appears in the galactic plane. It approximates the volume as a
flat map; it does not mount another scene or fabricate individual stars.
The minimap is a passive overview and does not provide separate navigation controls.

Regenerate from the repository root: `pnpm prepare:minimap`.

The extragalactic overview includes the four prepared Local Group galaxies and seven MCXC-II cluster centres, at their catalogue positions and epoch. Galaxy ovals fade in above 100 kpc minimap radius; cluster hexagons above 5 Mpc. These are location markers, not cluster membership maps or physical cluster boundaries. `pnpm prepare:minimap` restores their prepared markup and spatial index.

Catalogue positions and interpretation follow the [Local Group](../../src/objects/local-group/README.md) and [cluster catalogue](../../src/objects/galaxy-clusters/README.md) owners. The [range test](../test/minimap-point-range.test.mts) checks marker positions against those prepared records; it is not independent scientific or visual qualification.
