# Satellite-system navigation

**Status:** Implemented on 26 September 2026. The counts below describe the
prepared world context at `142a00fb6a`, not a permanent list of destinations.

## Rule

Give every prepared body with an orbiting satellite an explicit **satellite-system
selection**. Selecting its host from a wider view first frames the host and its
prepared primary orbits and presents a system card. Approaching or selecting a
body presents that body's card. Zooming out of a body returns to its system card
before the existing stellar-system overview. This is one rule for planets, dwarf
planets, trans-Neptunian objects and asteroids; no class-specific switch or
hand-maintained host list decides which bodies qualify.

The system is a selection on the shared world camera, not another object package
or mounted scene. A host still uses its existing object contract, and only one
object scene is mounted at a time.

## Selection identity

[`systemTarget`](../site/prepared-world-navigation.mts) already frames the main
moons on first selection. [`bodyCardViewAtCamera`](../site/overview-context.mts)
sets the camera threshold between the host family and the selected body.
[`SceneContext`](../site/scene/scene-selection.mts) calls the family selection
`satellite-system:<host-id>`, so its heading, source link, URL and card agree
on the subject.

The existing `?overview=system` means a *stellar* planetary system, such as the
Solar System or WASP-43's system. It must keep that meaning. Satellite systems
are the next scale inside it, derived from a host's prepared orbit children.

## Which systems qualify

Preparation supplies the relationship: a registered satellite's prepared
`orbit.centerBodyId` points to its host. Every nonstellar host with at least one
such child must have a prepared `systemView` and become a satellite-system
destination. The [system reader](../site/satellite-systems.mts) rejects a host
without framing rather than silently omitting its card. A future satellite with its own
prepared satellite follows the same rule recursively.

The prepared world context at that revision, read through the
[shared world-context owner](../site/world-context-plan.mts), has **18 hosts and
132 prepared satellite bodies**:

| Host class | Systems in this snapshot |
| --- | --- |
| Planet (6) | Earth, Mars, Jupiter, Saturn, Uranus, Neptune |
| Dwarf planet (3) | Pluto, Haumea, Eris |
| Trans-Neptunian object (2) | Orcus, Quaoar |
| Asteroid (7) | Didymos, Moshup, Sylvia, Patroclus, 2001 SN263, Ida, Dinkinesh |

Mercury and Venus have no satellite-system stop. This count comes from
prepared children; the larger [moon catalogues](moon-catalogues.md) also contain
names without scene objects. Those names can remain in the card's catalogue
list, visibly distinct from selectable bodies. The overview camera continues to
frame the prepared primary orbits, rather than shrinking a Jovian or Saturnian
scene to fit every distant satellite. `systemView.memberIds` identifies that
framed subset; it is not the complete membership list.

## Reader journey

1. Selecting a host from the wide map or object navigation opens its system
   card at the existing prepared system target. Earth shows **Earth–Moon
   system**; Jupiter shows **Jupiter system**. A single prepared companion can
   use the two prepared names, as in **Didymos–Dimorphos system**. Multiple
   companions use **<host> system**. Titles come from prepared names, not new
   body facts.
2. The card identifies the host and its rendered satellites, with a link
   for each. It shows catalogue-only moons as unavailable rows. The host's
   surface datasets, factsheet and galleries stay with the host body card.
3. Selecting a member opens that member's card and focuses its prepared scene.
   Zooming toward the centered host opens its body card; zooming toward a
   selected satellite opens the satellite's card. Merely panning or turning the
   camera does not change the selected subject.
4. Zooming back out of either body opens the same family card. Continuing out
   reaches the existing stellar-system overview. Thresholds use hysteresis, and
   card membership changes wait for the camera coast to stop.

The breadcrumb chain reflects these subjects: **Solar System → Earth–Moon
system → Earth** or **Moon**. The same pattern applies to a small binary and to
systems around other stars without creating another shell or camera contract.

## Selection and URL contract

The selection kind `satellite-system:<host-id>` refers to the host's mounted scene and shares
its camera. It is distinct from `object:<id>` and the existing stellar
`overview:system:<star-id>`. That distinction must survive search previews,
navigation, history, source links, reading position and reload.

The canonical URL is `/<host>/?view=satellites`; `/earth/` remains the
Earth body destination, `/moon/` remains the Moon body destination, and
`/sun/?overview=system` remains the Solar System overview. A wide-map or
navigation selection of a host opens the system URL. An exact body search result
or direct body link continues to open the named body. Saved camera views must
round-trip with whichever selection the URL names; a reload or Back operation
restores both camera and card.

The [navigation request](../site/navigation/navigation-request.mts) resolves
the selection and camera target together before starting the flight.
[Selection presentation](../site/selection-presentation.mts) shows a retained
system card without transferring system facts into a body's
dataset card. The prepared orbit graph supplies membership; the existing
[framing candidates](../site/system-framing.mts) supply the view. Runtime does
not derive orbits, geometry, imagery or scientific facts.

## Checks

[`satellite-systems.test.mts`](../site/test/satellite-systems.test.mts) checks
derived membership, required framing, URL identity and camera boundaries.
The browser check covers Earth and Moon navigation, browser history, Moon
zoom-out, Jupiter and Didymos system cards, and the Earth card at phone width.
Repository type checks, the Astro page build and rendered-page checks cover the shared shell and
prepared pages. These checks establish navigation behavior; they do not add
scientific orbits or qualify an image source.
