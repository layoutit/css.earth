# Moon lists, labels and orbits

The sidebar lists the complete confirmed moon catalogue. A moon links to a
destination only when it has a registered scene object. Unavailable moons have
disabled entries. Only properly named catalogue moons get subdued scene captions,
without circles or click targets. A provisional designation alone does not
qualify: having an ephemeris does not make a body notable.
Captions use the shared camera, ordinary caption typography and the
[universe label policy](universe-labels.md). They only appear for the active moon
family, using space left after clickable scene labels. They are retained text,
not additional body scenes.

A selected moon with no moons of its own shows its parent system instead of an
empty **Moons (0)** tab. For example, Titan's **Saturn system** tab links to Saturn
and its other available, non-illustration moons. The same list remains available
when zooming out. It omits Titan itself and unavailable destinations; Saturn's
own **Moons** tab still contains the complete confirmed catalogue. Bodies with
neither moons nor a parent system omit the empty tab.

## Sources

- [JPL discovery circumstances](https://ssd.jpl.nasa.gov/sats/discovery.html)
  supplies names and totals in `site/source/moon-catalogues.json`. On
  2026-09-15 UTC: Mercury 0, Venus 0, Earth 1, Mars 2, Jupiter 115, Saturn 293,
  Uranus 29, Neptune 16, Pluto 5. Existing catalogue identity:
  `src/sources/jpl-satellite-discovery.json`.
- [JPL mean elements](https://ssd.jpl.nasa.gov/sats/elem/) supplies satellite
  codes. Its mean elements are **not used to compute scene positions**.
  Existing identity: `src/sources/jpl-satellite-mean-elements.json`.
- [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) supplies geometric ICRF
  position vectors, in kilometres relative to each planet, at JD 2461286.5 TT
  (2026-09-03). `site/source/moon-horizons.json.gz` preserves the JSON replies,
  exact query URLs and retrieval time; the preparation checks the target,
  centre, units, frame and epoch. It converts kilometres to metres and adds the
  prepared parent position. Existing identity: `src/sources/jpl-horizons.json`.
  These are JPL dynamical ephemerides, not observations or precision claims
  beyond their source models. NASA/JPL Solar System Dynamics is the provider;
  [JPL image/data use guidance](https://www.jpl.nasa.gov/jpl-image-use-policy/)
  applies, with no claim of endorsement.
- [OpenSpace's pinned major-moon groups](https://github.com/OpenSpace/OpenSpace/tree/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets)
  supply the major/minor orbit policy in `site/source/major-moons.json`:
  Jupiter 4, Saturn 8, Uranus 5 and Neptune 2. Other planetary systems keep their
  existing orbits. Both CSS bar and SVG stroke presentations suppress minor
  moon orbits, including on hover. The moons themselves remain visible.

The catalogue source entries carry hashes of the fetched HTML. The prepared
labels carry SHA-256 hashes of the compressed Horizons archive and world-context
input. The archive includes one rejected reply: Horizons currently interprets
code 75052 (S/2025 U1 in JPL's table) as asteroid 75052. This reply never supplies
a scene position.

## Coverage and preparation

There are 79 named, unavailable-moon captions with published positions: 48 at
Jupiter, 17 at Saturn, 8 at Uranus and 6 at Neptune. Saturn has 63 named moons
eligible across its existing scene bodies and extra catalogue captions; the
sidebar still includes all 293 confirmed moons. View scale, occlusion and label
collisions determine which eligible captions actually appear.

The pinned archive also preserves positions for provisional moons, but they do
not enter the runtime caption bank. Curated explorable bodies keep their existing
labels, including significant objects known by catalogue designations. Saturn's
S/2009 S1 and S/2009 S2 have no full ephemerides in these inputs; Uranus's
S/2025 U1 has the identity conflict above. All three remain in the sidebar.
There are no invented phases, spheres or fallback locations.

Run `node tools/prepare/prepare-moon-labels.mts` to reproduce the ignored
`site/moon-labels.prepared.json` from the pinned source archive and current world
context. `pnpm prepare:world-context` runs this step after preparing the world.
The browser only projects these fixed positions; it performs no ephemeris work.

To refresh the sources, run `node tools/sources/acquire-moon-catalogues.mts --refresh`
then `node tools/prepare/prepare-moon-labels.mts --refresh`. Horizons requests are
sequential and cached in `output/moon-horizons/`. Review changes in totals,
identity and ephemeris coverage before accepting refreshed inputs. Do not reuse
cached replies for a different epoch or reference frame.

Focused checks: `node --test site/test/body-moons.test.mts
site/test/moon-labels.test.mts site/test/source-link.test.mts`. They verify full
catalogue membership, available destinations, every prepared vector against its
pinned reply, rejection of the wrong Horizons target, major/minor orbit policy,
planet occlusion, caption collision and overview hiding.
