#!/usr/bin/env node
// Entry script: node packages/bake/cli/check-prepared-presentation.mts --object <id> | --all | --inventory. The audit is in
// @cssearth/bake/contract.
import { auditPreparedPresentations, preparedPresentationSceneObjects } from '@cssearth/bake/contract';

const SCENE_OBJECTS = preparedPresentationSceneObjects();
const args = process.argv.slice(2), index = args.indexOf("--object"), id = index < 0 ? null : args[index + 1];
if (id && !SCENE_OBJECTS.some(object => object.id === id)) throw new Error(`Unknown registered object: ${id}`);
if (!id && !args.includes("--all") && !args.includes("--inventory")) throw new Error("Use --object ID, --all, or --inventory.");
const report = await auditPreparedPresentations({ objects: id ? SCENE_OBJECTS.filter(object => object.id === id) : SCENE_OBJECTS, strict: !args.includes("--inventory") });
console.log(JSON.stringify(report, null, 2));
