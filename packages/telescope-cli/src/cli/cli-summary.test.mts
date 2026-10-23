import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { lookupJson } from './cli-summary.mts';

test('large lookup JSON names complete saved evidence and bounds its preview',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'lookup-summary-'));
  const report={schema:'original-lookup@1',target:'fixture',works:Array.from({length:100},(_,rank)=>({rank,title:`Paper ${rank}`,doi:null,sentences:['full evidence '.repeat(100)]}))};
  const savedPath=resolve(directory,'papers.json');await writeFile(savedPath,JSON.stringify(report));
  const summary=JSON.parse(await lookupJson('papers',report,{savedPath}));
  try{
    assert.equal(summary.savedPath,savedPath);assert.deepEqual(await readdir(directory),['papers.json']);
    assert.equal(summary.schema,'cssearth-telescope-papers-summary@1');assert.equal(summary.worksCount,100);assert.equal(summary.works.length,10);
    assert.equal(summary.works[0].sentences,undefined);assert.deepEqual(JSON.parse(await readFile(summary.savedPath,'utf8')),report);
    assert.ok(JSON.stringify(summary).length<2000);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('small lookup JSON stays one complete document',async()=>{
  const report={schema:'original@1',records:[{id:1,title:'A record'}]};assert.deepEqual(JSON.parse(await lookupJson('simulations',report)),report);
});

test('unsaved large lookups print full JSON without writes; saved records respect their owners',async()=>{
  const work=await mkdtemp(resolve(tmpdir(),'stdout-root-')),cwd=resolve(work,'project'),user=resolve(work,'user'),out=resolve(work,'chosen');
  try{
    await mkdir(cwd);await mkdir(user);
    const module=new URL('./cli-summary.mts',import.meta.url).href;
    const script=`import { saveStdoutRecord, lookupJson } from ${JSON.stringify(module)};
      const full={items:Array.from({length:100},()=>({title:'Evidence '.repeat(100)}))};
      const { mkdir, readdir, writeFile }=await import('node:fs/promises');
      const { resolve }=await import('node:path');
      for(const command of ['families','papers','simulations','stars','gaia-cone','leads']){
        const text=await lookupJson(command,full);
        if(text!==JSON.stringify(full)+'\\n')throw new Error(command+' truncated unsaved evidence');
      }
      const unsavedFiles=await readdir(process.env.CSSEARTH_TELESCOPE_HOME);
      const automatic=await saveStdoutRecord('failure',{rawMessage:'kept'});
      await mkdir(process.argv[1],{recursive:true});
      const savedPath=resolve(process.argv[1],'papers.json');await writeFile(savedPath,JSON.stringify(full));
      const explicit=JSON.parse(await lookupJson('papers',full,{savedPath}));
      console.log(JSON.stringify({automatic,unsavedFiles,explicit:explicit.savedPath}));`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',script,out],{cwd,env:{...process.env,CSSEARTH_TELESCOPE_HOME:user},encoding:'utf8',timeout:30_000});
    assert.equal(child.status,0,child.stderr);
    const paths=JSON.parse(child.stdout);
    assert.ok(paths.automatic.startsWith(resolve(await realpath(cwd),'telescope-runs')+'/'));
    assert.deepEqual(paths.unsavedFiles,[]);
    assert.equal(paths.explicit,resolve(out,'papers.json'));
    assert.deepEqual(await readdir(out),['papers.json']);
    assert.deepEqual(await readdir(cwd),['telescope-runs']);assert.deepEqual(await readdir(user),[]);
    assert.deepEqual(JSON.parse(await readFile(paths.automatic,'utf8')),{rawMessage:'kept'});
    assert.equal(JSON.parse(await readFile(paths.explicit,'utf8')).items.length,100);
  }finally{await rm(work,{recursive:true,force:true});}
});

test('every persisted lookup names its owning record without creating another directory',async()=>{
  const directory=await mkdtemp(resolve(tmpdir(),'lookup-owners-'));
  try{
    const report={items:Array.from({length:100},()=>({title:'Evidence '.repeat(100)}))};
    for(const command of ['papers','simulations','stars','leads','export']){
      const savedPath=resolve(directory,command==='export'?'output.product.json':`${command}.json`);
      await writeFile(savedPath,JSON.stringify(report));
      const before=await readdir(directory),summary=JSON.parse(await lookupJson(command,report,{savedPath}));
      assert.equal(summary.savedPath,savedPath);assert.deepEqual(await readdir(directory),before);
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});
