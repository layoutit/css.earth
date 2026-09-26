// Entry script: node tools/prepare/cli/prepare-text.mts [--check] [<object-id>...]. The work is in ../prepare-text.mts.
import { describe, prepareText, reviewWarnings } from '../prepare-text.mts';

const check = process.argv.includes('--check');
const ids = process.argv.slice(2).filter(argument => !['--', '--check'].includes(argument));
const { objects, warnings, composition } = await prepareText({ ids, check });
const review = reviewWarnings(warnings, ids);
if (review.length) console.warn(`Review ${review.length} reader-text warnings${ids.length ? ` about ${ids.join(', ')}` : ''}:\n${describe(review)}`);
console.log(JSON.stringify({ check, objects, warnings: warnings.length, composition }));
