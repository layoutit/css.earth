# Helix Nebula

Helix Nebula as an object of the world: its place, its card and its list marker. It has no surface. Its four datasets are four photographs on the nebula's two published rings, each a bank with a README that holds the sources, processing, evidence and known problems of its imagery: [Hubble + CTIO](../helix-layers/README.md), which the page opens on, [ESO VISTA](../helix-vista-layers/README.md), [ESO WFI](../helix-wfi-layers/README.md) and [ESO's wider field](../helix-wide-layers/README.md). The three ESO photographs are resampled onto the Hubble photograph's frame, so all four cover the same sky.

## Sources

The card's facts cite their catalogues in [source/content/object.json](source/content/object.json); the [astronomy record](../../../packages/astronomy/data/bodies/helix.json) cites the position, distance and velocity that place it.

## Processing

1. `pnpm prepare:objects --object=helix` prepares its scene through the standard authored lane. The [recipe](object.json) declares no surface, so the scene is the camera, sky and world frame; the framing radius, the radius of the image-layer bank's picture (770″ at the nebula's distance), is a presentation value ([solar-system.json](source/presentation/solar-system.json)).
2. `node site/build/prepare/companion-context.mts helix` saves the list marker from the default dataset's picture.

## Known problems

- The framing radius is a presentation value, not a measured extent. VISTA's and ESO's wider photographs reach beyond it; the banks draw them to the same circle.
- Until 2026-10-07 the three ESO photographs were drawn on a modelled volume; git history keeps its record.
