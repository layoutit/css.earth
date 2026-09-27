// Nightly check: no page of an asset-origin build (`ASSET_ORIGIN` set) still names a same-origin `/scenes/` address.
//   node packages/bake/cli/check-asset-origin-scenes.mts <distDir>
import { findSceneReferences } from '@cssearth/bake/delivery';

function usage(): never {
  process.stderr.write("Usage: node packages/bake/cli/check-asset-origin-scenes.mts <distDir>\n");
  process.exit(2);
}

async function main(argv: readonly string[]) {
  const [distDir] = argv;
  if (!distDir) usage();
  const found = await findSceneReferences(distDir);
  if (found.length) {
    process.stderr.write(`${found.length} literal /scenes/ reference(s) remain under ${distDir} with ASSET_ORIGIN set:\n`);
    for (const entry of found.slice(0, 50)) process.stderr.write(`  ${entry.path}:${entry.line}: ${entry.text}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`No /scenes/ references found under ${distDir}.\n`);
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) await main(process.argv.slice(2));
