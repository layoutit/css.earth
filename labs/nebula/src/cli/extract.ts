/** Offline extraction entry; the implementation remains safe to import into other preparation tools. */
import { extractExtendedSource } from '../reconstruction/extraction.js';
const [inputPath, outputDirectory, id, extra] = process.argv.slice(2);
if (!inputPath || !outputDirectory || extra) throw new TypeError('Usage: extract <input-image> <output-directory> [id]');
console.log(JSON.stringify(await extractExtendedSource({ inputPath, outputDirectory, id }), null, 2));
