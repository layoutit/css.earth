/** Cross-validate one Node V8 run against its own LCOV, on both physical lines and shared AST lines. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const checkoutRoot = fileURLToPath(new URL('../../../', import.meta.url));
import ts from 'typescript';
import { sourceUnits } from './units.mts';
import { convert } from './convert.mts';
import { merge, metric } from './merge.mts';
import { scopeFiles } from './report.mts';

export interface Lcov { file:string; lines:Map<number,number>; functions:{hit:number;total:number}; branches:{hit:number;total:number} }
export function parseLcov(source:string,root:string):Lcov[] {
  const result:Lcov[]=[]; let current:Lcov|undefined;
  const integer=(s:string)=>{const n=Number(s);if(!Number.isSafeInteger(n)||n<0) throw new Error(`Invalid LCOV integer ${s}`);return n;};
  for(const line of source.split('\n')) {
    const colon=line.indexOf(':'); if(colon<0) continue;
    const kind=line.slice(0,colon),value=line.slice(colon+1);
    if(kind==='SF') {const file=value.startsWith('/')?relative(root,value):value;current={file,lines:new Map(),functions:{hit:0,total:0},branches:{hit:0,total:0}};result.push(current);}
    else if(current && kind==='DA') {const [a,b]=value.split(',');if(a===undefined || b===undefined) throw new Error('Invalid DA');current.lines.set(integer(a),integer(b));}
    else if(current && kind==='FNF') current.functions.total=integer(value);
    else if(current && kind==='FNH') current.functions.hit=integer(value);
    else if(current && kind==='BRF') current.branches.total=integer(value);
    else if(current && kind==='BRH') current.branches.hit=integer(value);
  }
  if(!result.length) throw new Error('Empty LCOV');return result;
}
export function compareNode(root:string,rawDir:string,lcovFile:string) {
  const scope=scopeFiles(root,'root'),evidence=convert(rawDir,root),summary=merge(root,scope,[evidence]);
  const lcov=new Map(parseLcov(readFileSync(lcovFile,'utf8'),root).map(r=>[r.file,r]));
  let agreed=0, compared=0;
  const files=summary.files.map(row=>{
    const reference=lcov.get(row.file),units=sourceUnits(row.file,readFileSync(resolve(root,row.file),'utf8')).units;
    const mismatched:number[]=[];let comparisons=0;
    for(const unit of units.filter(u=>u.kind==='lines')) {
      const node=reference?.lines.get(unit.line); if(node===undefined) continue;
      const hit=(evidence.files.get(row.file)??[]).some(r=>r.covered && r.start<unit.end && r.end>unit.start);
      comparisons++;compared++; if(hit === (node>0)) agreed++; else mismatched.push(unit.line);
    }
    const physical=reference?metric([...reference.lines.values()].filter(v=>v>0).length,reference.lines.size):row.lines;
    return {file:row.file,loaded:row.loaded,physicalLines:physical,astLines:row.lines,lineComparisons:comparisons,mismatched,
      nodeFunctions:reference?.functions??{hit:0,total:row.functions.total},astFunctions:row.functions,
      nodeBranches:reference?.branches??{hit:0,total:row.branches.total},astBranches:row.branches};
  });
  const baselineAggregate=metric(files.reduce((s,f)=>s+f.physicalLines.hit,0),files.reduce((s,f)=>s+f.physicalLines.total,0));
  const legacyTotal=files.reduce((sum,f)=> {
    if(f.loaded) return sum+f.physicalLines.total;
    const sf=ts.createSourceFile(f.file,readFileSync(resolve(root,f.file),'utf8'),ts.ScriptTarget.Latest,true),lines=new Set<number>();
    const visit=(n:ts.Node):void=>{if(ts.isStatement(n) && !ts.isBlock(n) && !ts.isImportDeclaration(n) && !ts.isInterfaceDeclaration(n) && !ts.isTypeAliasDeclaration(n) && !ts.isExportDeclaration(n)) lines.add(sf.getLineAndCharacterOfPosition(n.getStart(sf)).line);ts.forEachChild(n,visit);};visit(sf);return sum+lines.size;
  },0);
  const legacyPhysicalAggregate=metric(files.reduce((sum,f)=>sum+f.physicalLines.hit,0),legacyTotal);
  return {version:1,reference:'same-run Node LCOV',baselineAggregate,legacyPhysicalAggregate,astAggregate:summary.aggregate,lineAgreement:metric(agreed,compared),files,
    limits:['Node physical lines include comments, blank lines and continuation lines in positive ranges; AST counts only runtime statement/declaration start lines.',
      'LCOV marks physical lines containing any executed part; AST uses the first executable token, so same-line partial execution can disagree.',
      'Node V8 branch counts are observed functions/blocks and do not include source arms that V8 omits. AST includes explicit source arms even without evidence.',
      'AST counts every function-like body including methods and arrows; LCOV reports V8 functions only. Function/body token hits differ from V8 entry counts for empty/optimized bodies.']};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values}=parseArgs({options:{root:{type:'string',default:checkoutRoot},raw:{type:'string'},lcov:{type:'string'},out:{type:'string',default:'output/coverage/node-comparison.json'}}});
  if(!values.raw || !values.lcov) throw new Error('--raw and --lcov required');
  const result=compareNode(resolve(values.root),resolve(values.root,values.raw),resolve(values.root,values.lcov));mkdirSync(dirname(resolve(values.root,values.out)),{recursive:true});writeFileSync(values.out,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({physicalLines:result.baselineAggregate,legacyPhysicalLines:result.legacyPhysicalAggregate,ast:result.astAggregate,lineAgreement:result.lineAgreement}));
}
