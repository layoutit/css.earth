import { publish } from './object-commands.ts';

await publish(process.argv.slice(2));
