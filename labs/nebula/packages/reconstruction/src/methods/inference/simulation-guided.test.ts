import { test } from 'node:test';import assert from 'node:assert/strict';
import { conditionSimulationComponents, fitSimulationGuidedEmission, type SimulationDepthPrior, type SimulationDepthSettings } from './simulation-guided.ts';
import { fitEmissionField } from './fit.ts';
import { createEmissionField, projectEmissionComponent, type EmissionComponent, type EmissionFitInput } from '@cssearth/bake/volume';
const prior:SimulationDepthPrior={identity:'a'.repeat(64),bounds:{min:[-5,-5,-12],max:[5,5,12]},sampleDensity:(x,_y,z)=>Math.abs(x)>3?0:Math.exp(-.5*((z+4)/.8)**2)+2*Math.exp(-.5*((z-3)/.6)**2)};
const settings:SimulationDepthSettings={depthSamples:256,modeRelativeThreshold:.25,maximumModes:2,minimumSigmaZ:.15,maximumSigmaZ:1,featureThicknessRatio:.85,supportSigma:4};
const component:EmissionComponent={id:'feature',basisId:'feature',center:[0,0,0],sigma:[.5,.4,4],angleRadians:0,projectedWeight:2,depthAssignment:'halo-diffuse',velocityCovered:false};
test('prior modes condition finite depth without changing fitted projected light or source input',()=>{
 const source=structuredClone(component),conditioned=conditionSimulationComponents([component],prior,settings);
 assert.deepEqual(component,source);assert.equal(conditioned.components.length,2);assert.equal(conditioned.unsupportedComponents,0);
 assert.ok(Math.abs(conditioned.components[0]!.center[2]+4)<.1);assert.ok(Math.abs(conditioned.components[1]!.center[2]-3)<.1);
 assert.ok(conditioned.components.every(c=>c.sigma[2]<=.4*.85&&c.sigma[2]>=.15));
 assert.ok(Math.abs(conditioned.components.reduce((s,c)=>s+c.projectedWeight,0)-2)<1e-12);
 for(const[x,y]of[[0,0],[.2,-.3],[-.5,.2]])assert.ok(Math.abs(conditioned.components.reduce((s,c)=>s+projectEmissionComponent(c,x!,y!),0)-projectEmissionComponent(component,x!,y!))<1e-12);
 const brighter=conditionSimulationComponents([{...component,projectedWeight:200}],prior,settings);
 assert.deepEqual(brighter.assignments[0]!.modes,conditioned.assignments[0]!.modes,'image brightness must not set depth');
});
test('unsupported image structures remain finite and explicit rather than silently discarded',()=>{
 const result=conditionSimulationComponents([{...component,center:[4,0,0],sigma:[.1,.1,4]}],prior,settings);
 assert.equal(result.unsupportedComponents,1);assert.equal(result.unsupportedProjectedLightFraction,1);assert.equal(result.components.length,1);
 assert.equal(result.components[0]!.depthAssignment,'unsupported-local');assert.equal(result.components[0]!.sigma[2],.15);assert.equal(result.components[0]!.projectedWeight,2);
 assert.throws(()=>conditionSimulationComponents([component],{...prior,sampleDensity:()=>NaN},settings));
 assert.throws(()=>conditionSimulationComponents([component],prior,{...settings,supportSigma:3}));
});
test('adapter projection agrees with conditioned field; default image-only fitting remains unchanged',()=>{
 const width=24,height=24,target=Float32Array.from({length:width*height},(_,i)=>Math.exp(-((i%width-9)**2+(Math.floor(i/width)-12)**2)/8));
 const input:EmissionFitInput={width,height,target,bounds:{min:[-3,-3],max:[3,3]},coverage:new Uint8Array(target.length).fill(1)};
 const controls={detail:1,faint:.6,depth:1};
 const fit=fitSimulationGuidedEmission(input,controls,prior,settings),field=createEmissionField(fit.field);
 for(let i=0;i<target.length;i++){const x=-3+(i%width+.5)*6/width,y=3-(Math.floor(i/width)+.5)*6/height;const projected=fit.field.components.reduce((sum,c)=>sum+projectEmissionComponent(c,x,y),0);assert.ok(Math.abs(projected-fit.projection[i]!)<2e-6);}
 const rgb:[number,number,number]=[0,0,0];field.sampleEmission(0,0,0,rgb);assert.equal(rgb[0],0,'separated finite supports must not fill their empty depth interval');
 const baseline=fitEmissionField(input,controls);assert.ok(baseline.field.components.every(c=>c.center[2]===0&&c.depthAssignment==='halo-diffuse'));
 assert.equal(fit.field.assumptions.equalNearFarSplit,false);assert.ok(fit.metrics.afterRmse<fit.metrics.beforeRmse);
 assert.throws(()=>fitSimulationGuidedEmission(input,{...controls,depth:2},prior,settings),/depth=1/);
});
