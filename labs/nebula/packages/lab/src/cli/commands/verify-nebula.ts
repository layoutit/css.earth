import { verifyNebulaBake } from '../../server/workflows/density/verify.ts';

const args = process.argv.slice(2);
if (args.length > 1 || (args[0] && !/^--recipe=.+$/.test(args[0])))
  throw new Error('Usage: node --experimental-strip-types labs/nebula/run.mts verify-nebula [--recipe=<json>]');
await verifyNebulaBake(process.cwd(), args[0]?.slice('--recipe='.length));
