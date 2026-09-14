# Spatial minimap

Mounted by the shared world context on normal URLs and in production builds.
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
labels, separate camera or settings.

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
