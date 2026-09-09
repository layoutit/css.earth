// Serial, fresh network verification of exactly the newly published chart assets.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const plan=JSON.parse(await readFile('docs/moons/b4-observations/publication-plan.json','utf8'));
const report={status:'RUNNING',scope:'36 new observation PNG/CSV files only',assets:[],startedAt:new Date().toISOString()};
await mkdir('output/b4-tests/fresh-release',{recursive:true});
try{
 for(const a of plan.assets){
  const head=await fetch(a.url,{method:'HEAD',signal:AbortSignal.timeout(30000)});assert.equal(head.status,200,a.url);
  const response=await fetch(a.url,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,a.url);
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,a.bytes);
  const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(sha256,a.sha256);
  await writeFile(`output/b4-tests/fresh-release/${a.filename}`,bytes);
  report.assets.push({id:a.id,url:a.url,headStatus:head.status,getStatus:response.status,bytes:bytes.length,sha256,verifiedAt:new Date().toISOString()});
  console.log(report.assets.length,plan.assets.length,a.id,a.filename);
 }
 assert.equal(report.assets.length,36);report.status='PASS';report.headsVerified=true;
}finally{report.finishedAt=new Date().toISOString();await writeFile('docs/moons/b4-observations/fresh-publication.json',JSON.stringify(report,null,2)+'\n');}
