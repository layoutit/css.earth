import {requireRecord,requireString} from '../source-values.mts';
import {shape,text,number,array} from './terrestrial-layers/source-records.mts';
const parseFrame=shape({referenceFrame:text,epochJdTt:number,metersPerUnit:number,bodyRadiusM:number,originM:array(number),presentationToReference:array(number)});
import { readFile, rename, writeFile } from "node:fs/promises";

// The frame is generated from source preparation; publishing it alongside the
// descriptor gives the app its common coordinate frame before loading assets.
export async function publishSolarSystemWorldFrame(descriptorUrl:URL, frame:unknown) {
  const worldFrame={...requireRecord(frame),...parseFrame(frame)};
  const descriptor = requireRecord(JSON.parse(await readFile(descriptorUrl, "utf8")));
  if (descriptor.schema !== "cssearth-object@1" || worldFrame?.referenceFrame !== "sun-icrf" ||
      !Number.isFinite(worldFrame.epochJdTt) || !(worldFrame.metersPerUnit > 0) || !(worldFrame.bodyRadiusM > 0) ||
      !Array.isArray(worldFrame.originM) || worldFrame.originM.length !== 3 ||
      !Array.isArray(worldFrame.presentationToReference) || worldFrame.presentationToReference.length !== 9 ||
      [...worldFrame.originM, ...worldFrame.presentationToReference].some(value => !Number.isFinite(value))) {
    throw new TypeError("The object descriptor needs a prepared physical world frame.");
  }
  const output = { ...descriptor, properties: { ...requireRecord(descriptor.properties), worldFrame } };
  const temporary = new URL(`./.${requireString(descriptor.id)}-world-frame-${process.pid}.json`, descriptorUrl);
  await writeFile(temporary, `${JSON.stringify(output, null, 2)}\n`);
  await rename(temporary, descriptorUrl);
}
