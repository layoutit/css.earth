import { prepareKinematicFigure } from './prepare-source.js';
const [sourcePath] = process.argv.slice(2);
if (!sourcePath) throw new TypeError('Usage: prepare-kinematics <model-kinematics.json>');
const result = await prepareKinematicFigure(process.cwd(), sourcePath);
console.log(JSON.stringify({ status: 'complete', ...result }));
