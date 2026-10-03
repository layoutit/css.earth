/** Bootstrap-safe workspace build CLI. */
import { spawnSync } from 'node:child_process';
import { readWorkspaceGraph, workspaceOrder, hasBuild } from '@cssearth/bake/preparation/workspace-graph';
const args = process.argv.slice(2), run = args[0] === '--run';
if (run) args.shift();
const packages = readWorkspaceGraph(process.cwd());
const order = workspaceOrder(packages, args.length ? args : packages.filter(pkg => pkg.directory.startsWith('packages/')).map(pkg => pkg.name)).filter(hasBuild);
for (const pkg of order) {
  if (!run) console.log(pkg.name);
  else {
    const result = spawnSync('pnpm', ['--filter', pkg.name, 'build'], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
