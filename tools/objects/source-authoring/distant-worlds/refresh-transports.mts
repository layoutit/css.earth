import { sha256 } from '../../../../src/platform/sha256.mts';
import {requireRecord} from '../../../source-values.mts';
import {requireObjectRuntimeDefinition} from '../../../object-runtime-contract.mts';
import { mkdir as ensureReportDirectory } from 'node:fs/promises';
const reportDirectory=process.env.CSSEARTH_AUDIT_OUTPUT ?? 'output/distant-worlds';
await ensureReportDirectory(reportDirectory, {recursive:true});
import {readFile,writeFile} from 'node:fs/promises';
import {SCENE_OBJECTS} from '../../../../site/objects.mts';
import {serializeObjectJson,prepareObjectJson} from '../../../../tools/prepare-object-json.mts';
import {writePreparedText} from '../../../../tools/write-prepared-text.mts';
import {preparePageMetadata} from '../../../../tools/prepared-page-metadata.mts';
const results=[];
for(const {id} of SCENE_OBJECTS){
 const root=`src/objects/${id}`,descriptor=requireRecord(JSON.parse(await readFile(`${root}/object.json`, 'utf8')));
 const runtime=requireObjectRuntimeDefinition(JSON.parse(await readFile(`${root}/prepared/runtime.json`, 'utf8')));
 const definition=runtime;
 const payload=serializeObjectJson(descriptor,definition);
 const digest=sha256(payload);
 await writePreparedText(`${root}/prepared/runtime.json`,JSON.stringify(definition)+'\n');
 await writePreparedText(`${root}/prepared/object.json`,payload);
 const page=preparePageMetadata(id,digest,definition);
 await writePreparedText(`${root}/prepared/page.json`,page.text);
 await writePreparedText(`${root}/object.json`,JSON.stringify({...descriptor,prepared:{...requireRecord(descriptor.prepared),sha256:digest},properties:{...requireRecord(descriptor.properties),page:{...requireRecord(requireRecord(descriptor.properties).page),metadata:page.reference}}},null,2)+'\n');
 results.push({id,bytes:Buffer.byteLength(payload),sha256:digest,scope:'Existing object serializer; all runtime fields retained exactly.'});
}
// Empty selection skips presentation compilation and refreshes contexts from
// the already finalized descriptor frames through the existing context owner.
await prepareObjectJson([]);
await writeFile(`${reportDirectory}/transports.json`,JSON.stringify(results,null,2)+'\n');
console.log('Transports and contexts refreshed:',results.length,'; zero presentation recompiles');
