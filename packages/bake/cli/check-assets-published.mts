// Entry script: node packages/bake/cli/check-assets-published.mts [--object=<id> ...] [--added-since=<ref> | --added-since-last-green]
// [--concurrency=<n>] [--report-only | --require-verified] (`pnpm check:assets-published`). The check is in @cssearth/bake/asset-publication.
import { appendFile } from 'node:fs/promises';
import { checkAssetsPublished, errorText, gateVerdict, lastGreenMainSha } from '@cssearth/bake/asset-publication';

const args = process.argv.slice(2);
const option = (name: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const addedSinceArg = option("added-since"), concurrencyArg = option("concurrency");
const lastGreen = args.includes("--added-since-last-green"), reportOnly = args.includes("--report-only"), requireVerified = args.includes("--require-verified");
const objectArgs = args.filter(arg => !/^--(?:added-since|concurrency)=/u.test(arg) && arg !== "--added-since-last-green" && arg !== "--report-only" && arg !== "--require-verified");
if (addedSinceArg !== undefined && lastGreen) throw new Error("Use --added-since=<ref> or --added-since-last-green, not both.");
if (reportOnly && requireVerified) throw new Error('A verified deploy cannot be report-only.');
const concurrency = concurrencyArg === undefined ? undefined : Number(concurrencyArg);
if (concurrency !== undefined && (!Number.isInteger(concurrency) || concurrency < 1)) throw new Error(`Invalid --concurrency=${concurrencyArg}`);
let addedSince = addedSinceArg;
if (lastGreen) {
  let sha: string | null = null;
  try { sha = await lastGreenMainSha(); }
  catch (error) { console.warn(`Could not look up the last green main run (${errorText(error)}); checking every key.`); }
  if (sha === null) console.warn("No green main run to compare with; checking every key.");
  else addedSince = sha;
}
const result = await checkAssetsPublished(objectArgs, { ...(addedSince ? { addedSince } : {}), ...(concurrency ? { concurrency } : {}) });
const { exitCode, report } = gateVerdict(result, { reportOnly, requireVerified });
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Published assets\n\n${report}\n`);
process.exitCode = exitCode;
