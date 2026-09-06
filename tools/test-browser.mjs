import { spawn } from "node:child_process";
import { resolve } from "node:path";

const args = process.argv.slice(2).filter(arg=>arg!=="--");
if(args.length>1)throw new Error("Use pnpm test:browser [application-origin].");
const origin=args[0]??"http://127.0.0.1:4210",url=new URL(origin);
if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw new Error("Choose an HTTP application origin.");
const root=resolve(import.meta.dirname,"..");
for(const [file,...argumentsList] of [["tools/run-implemented-planets.mjs","browser",origin],["site/test/planet-browser-conformance.mjs",origin]]){
  await new Promise((accept,reject)=>{
    const child=spawn(process.execPath,[resolve(root,file),...argumentsList],{cwd:root,stdio:"inherit"});
    child.once("error",reject);child.once("close",code=>code===0?accept():reject(new Error(`Browser qualification exited ${code}: ${file}`)));
  });
}
