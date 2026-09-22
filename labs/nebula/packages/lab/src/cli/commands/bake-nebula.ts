import { bakeNebula } from '../../server/workflows/density/bake.ts';

if (process.argv.includes('--help')) {
  console.log('Usage: node --experimental-strip-types labs/nebula/run.mts bake-nebula [--image=<id>] [--stage=density|assets|removal|reconstruction|all] [--recipe=<json>] [--python=<executable>] [--if-missing]');
  console.log('Default: both density fields, three LMC originals, saved baseline + NOX, registered colors/stars, and a local lens bank.');
  console.log('Completed results are verified and reused. The full bake also restores the configured local app textures; nothing is published.');
} else {
  await bakeNebula(process.cwd(), process.argv.slice(2));
}
