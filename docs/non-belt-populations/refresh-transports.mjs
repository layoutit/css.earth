import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mjs';
import {prepareMarkerBindings} from '../../tools/prepare-marker-bindings.mjs';
import {serializeObjectJson,prepareObjectJson} from '../../tools/prepare-object-json.mjs';
import {writePreparedText} from '../../tools/write-prepared-text.mjs';
import {preparePageMetadata} from '../../tools/prepared-page-metadata.mjs';
const results=[];
const selected=new Set(process.argv.slice(2));
for(const {id} of OBJECTS){
 if(selected.size&&!selected.has(id))continue;
 const root=`src/planets/${id}`,descriptor=JSON.parse(await readFile(`${root}/object.json`));
 const runtime=JSON.parse(await readFile(`${root}/prepared/runtime.json`));
 const definition=prepareMarkerBindings(runtime);
 const withoutMarkers=({heliocentricView,...rest})=>rest;
 assert.deepEqual(withoutMarkers(definition),withoutMarkers(runtime));
 const payload=serializeObjectJson(descriptor,definition);
 const sha256=createHash('sha256').update(payload).digest('hex');
 await writePreparedText(`${root}/prepared/runtime.json`,JSON.stringify(definition)+'\n');
 await writePreparedText(`${root}/prepared/object.json`,payload);
 const page=preparePageMetadata(id,sha256,definition);
 await writePreparedText(`${root}/prepared/page.json`,page.text);
 await writePreparedText(`${root}/object.json`,JSON.stringify({...descriptor,prepared:{...descriptor.prepared,sha256},properties:{...descriptor.properties,page:{...descriptor.properties.page,metadata:page.reference}}},null,2)+'\n');
 results.push({id,bytes:Buffer.byteLength(payload),sha256,scope:'Existing marker binding and object serializer; all non-marker runtime fields retained exactly.'});
}
// Empty selection skips presentation compilation and refreshes contexts from
// the already finalized descriptor frames through the existing context owner.
await prepareObjectJson([]);
await writeFile(`docs/non-belt-populations/transports${selected.size?'-'+[...selected].join('-'):''}.json`,JSON.stringify(results,null,2)+'\n');
console.log('Marker bindings, transports and contexts refreshed:',results.length,'; zero presentation recompiles');
