#!/usr/bin/env node
// Entry script: node tools/prepare/cli/prepare-object.mts <object-id>... [--from <step>] [--to <step>] [--reuse-images].
// The chain and its steps are in ../prepare-object.mts.
import { PREPARATION_STEPS, prepareObjects } from '../prepare-object.mts';

const args = process.argv.slice(2), option = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : undefined; };
const from = option('--from'), to = option('--to'), reuseImages = args.includes('--reuse-images');
const ids = args.filter((argument, at) => !argument.startsWith('--') && args[at - 1] !== '--from' && args[at - 1] !== '--to');
if (!ids.length) throw new TypeError(`Usage: prepare-object <object-id>... [--from <step>] [--to <step>] [--reuse-images]; steps: ${PREPARATION_STEPS.map(step => step.name).join(', ')}.`);
if (!await prepareObjects(ids, { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }), reuseImages })) process.exitCode = 1;
