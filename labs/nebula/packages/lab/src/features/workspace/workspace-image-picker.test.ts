import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';
test('image choice survives a late or replaced shell destination without resetting selection',async()=>{
 const built=await build({stdin:{loader:'tsx',resolveDir:process.cwd(),contents:`
 import {useState} from 'react';import {createRoot} from 'react-dom/client';
 import {WorkspaceImagePicker} from './labs/nebula/packages/lab/src/features/workspace/workspace-image-picker';
 function Picker(){const [value,setValue]=useState('vista');return <WorkspaceImagePicker target="images"><select aria-label="Image" value={value} onChange={e=>setValue(e.target.value)}><option value="vista">VISTA</option><option value="wise">WISE</option></select></WorkspaceImagePicker>}
 createRoot(document.getElementById('root')).render(<Picker/>);
 `},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic'});
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?built.outputFiles[0]!.text:'<div id="root"></div><div id="rail"></div><script src="/fixture.js"></script>');});
 await new Promise<void>(done=>server.listen(0,'127.0.0.1',done));const address=server.address();assert.ok(address&&typeof address!=='string');
 const browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage();page.setDefaultTimeout(3000);await page.goto(`http://127.0.0.1:${address.port}`);
 await page.evaluate(()=>{const host=document.createElement('div');host.id='images';document.getElementById('rail')!.append(host);});
 await page.getByRole('combobox',{name:'Image'}).selectOption('wise');
 await page.evaluate(()=>{const old=document.getElementById('images')!;const next=document.createElement('div');next.id='images';old.replaceWith(next);});
 await page.waitForFunction(()=>document.querySelector<HTMLSelectElement>('#images select')?.value==='wise');
 assert.equal(await page.getByRole('combobox',{name:'Image'}).count(),1);
 await page.getByRole('combobox',{name:'Image'}).selectOption('vista');assert.equal(await page.getByRole('combobox',{name:'Image'}).inputValue(),'vista');
 }finally{await browser.close();await new Promise<void>((done,reject)=>server.close(e=>e?reject(e):done()));}
});
