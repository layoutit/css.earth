# Application nebula preparation tests

The tests of the static application's nebula preparation. The entry is the bake command
[`packages/bake/cli/prepare-nebulae.mts`](../../cli/prepare-nebulae.mts), and the delivery bake itself is
the `@cssearth/bake/nebula` entry ([`packages/bake/src/nebula/`](.)): it discovers
source-owned delivery recipes, calls the private volume baker, embeds its outputs in the shared sky frame, prepares
impostors and atlases and verifies installed resources.

`node packages/bake/cli/prepare-nebulae.mts --if-missing` prepares all registered compact deliveries. Add `--object=<id>`
for one object. The command calls the bake and records each prepared closure with the platform's inventory; it does not
invoke the lab CLI or import research implementations.

In `@cssearth/bake/nebula`:

- `backend.ts`: explicit cssEarth volume/FITS/stellar-profile adapter.
- `objects.ts`: compiler, sampled and symmetry deliveries, source verification and installation.
- `density-object.ts` / `density-delivery.ts`: accepted density/material delivery replay and exact atlas verification.
- `references.ts`: byte-identical source-owned copies of historical research JSON pins. Original delivery recipes and pin identities remain unchanged.
- `nebula-frame.ts` / `catalogue-field.ts`: physical sky embedding and measured surrounding stars.

A delivery receipt records its source result and datasets; git identifies the code that baked it. The tests of the entry
stay here (`node --test`) and import it.

Default preparation requires compact inputs. Full scientific regeneration remains an explicit lab command and supplies a research backend to the same delivery installer. Generated images stay ignored. A copied research reference preserves its historical attribution; it is not a new observation or a refit.
