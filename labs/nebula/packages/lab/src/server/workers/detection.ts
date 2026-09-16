/** Separate CPU process keeps the local server responsive to progress and cancellation. */
import { prepareDetection } from '../workflows/geometry/preparation.ts';
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const request: unknown = JSON.parse(Buffer.concat(chunks).toString());
const result = await prepareDetection(process.cwd(), request, progress => process.stdout.write(JSON.stringify({ type: 'progress', ...progress }) + '\n'));
process.stdout.write(JSON.stringify({ type: 'complete', result }) + '\n');
