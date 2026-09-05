#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareCaptures } from './object-contract-visual.mjs';
import { requireRepresentationReceipt, representationHash as sha } from './prepared-representation-receipt.mjs';

const comparisonCode = ['tools/audit-shared-runtime.mjs', 'tools/runtime-audit-poses.mjs',
  'tools/audit-source-identity.mjs', 'tools/readback-sequence.mjs',
  'tools/object-contract-visual.mjs', 'tools/saturn-scene-coverage.mjs'];
export function requireCaptureReports(before, after) {
  for (const report of [before, after]) {
    assert.equal(report.complete, true, 'Complete source-bound capture required');
    assert.deepEqual(report.errors, [], 'Capture errors cannot qualify');
    assert.equal(report.captures.length, report.expectedCaptureCount, 'Complete capture count');
    assert.equal(new Set(report.captures.map(c => `${c.prefix}:${c.kind}`)).size, report.captures.length, 'Unique capture cases');
    assert.equal(report.sourceIdentity?.sha256, report.sourceIdentity?.sha256?.match(/^[0-9a-f]{64}$/)?.[0], 'Bound source identity');
    assert.ok(report.sourceIdentity?.sha256, 'Source identity is required');
  }
  for (const field of ['protocol','browser','headless','browserArgs','objectIds','scenarios','expectedCaptureCount']) {
    assert.deepEqual(after[field], before[field], `Same capture ${field}`);
  }
  for (const file of comparisonCode) {
    assert.ok(before.harnessHashes[file], `Missing pinned capture implementation: ${file}`);
    assert.equal(after.harnessHashes[file], before.harnessHashes[file], `Pinned capture implementation: ${file}`);
  }
}
export function selectCaptureObjects(report, objectIds) {
  requireCaptureReports(report, report);
  assert.ok(Array.isArray(objectIds) && objectIds.length && new Set(objectIds).size === objectIds.length, 'Explicit unique capture subset');
  for (const id of objectIds) assert.ok(report.objectIds.includes(id), `Missing captured object ${id}`);
  const matches = prefix => objectIds.some(id => prefix.startsWith(`${id}-`));
  const scenarios = Object.fromEntries(objectIds.map(id => [id, report.scenarios[id]]));
  const expectedCaptureCount = Object.values(scenarios).reduce((total, scenario) => total +
    scenario.dprs.length * (scenario.defaultWidths.length * 2 + scenario.poseWidths.length * scenario.poses.length), 0);
  return { ...report, objectIds, scenarios, expectedCaptureCount,
    captures: report.captures.filter(capture => matches(capture.prefix)),
    repeatabilityFailures: (report.repeatabilityFailures ?? []).filter(matches),
    visualFailures: (report.visualFailures ?? []).filter(failure => matches(failure.prefix)) };
}
export function requireCaptureState(before, after, expectedControlChange = null) {
  for (const field of ['prefix','kind','pose','loadedAssets','versionLabel','gpu']) {
    assert.deepEqual(after[field], before[field], `Matched capture ${field}`);
  }
  for (const field of ['poseState','observedPose']) {
    if (expectedControlChange) {
      const withoutLens = value => value == null ? value : Object.fromEntries(Object.entries(value)
        .filter(([key]) => !['lens', 'lensId', 'visibleLens', 'view'].includes(key)));
      assert.deepEqual(withoutLens(after[field]), withoutLens(before[field]), `Unchanged non-lens ${field}`);
      assert.deepEqual(before[field], expectedControlChange.before[field], `Exact legacy ${field}`);
      assert.deepEqual(after[field], expectedControlChange.after[field], `Exact corrected ${field}`);
    } else assert.deepEqual(after[field], before[field], `Matched capture ${field}`);
  }
  assert.equal(after.frameSha256s.length, before.frameSha256s.length, 'All scheduled readbacks');
  assert.ok(after.frameSha256s.length >= 2, 'Repeated native readbacks required');
}

export async function comparePreparedPresentations({ baselineFile, candidateFile, receiptFile, output, objectIds = null }) {
  const json = async path => JSON.parse(await readFile(path, 'utf8'));
  let before = await json(baselineFile), after = await json(candidateFile);
  if (objectIds) { before = selectCaptureObjects(before, objectIds); after = selectCaptureObjects(after, objectIds); }
  requireCaptureReports(before, after);
  const bundle = receiptFile ? await json(receiptFile) : { objects: {} };
  const receiptRoot = receiptFile ? dirname(receiptFile) : process.cwd();
  const result = { schema:'cssearth-prepared-presentation-comparison@1', complete:false,
    baselineReport:{path:baselineFile,sha256:sha(await readFile(baselineFile))},
    candidateReport:{path:candidateFile,sha256:sha(await readFile(candidateFile))},
    receipt:receiptFile ? {path:receiptFile,sha256:sha(await readFile(receiptFile))}:null,
    objectIds: before.objectIds, comparisons:[], sourceChanges:[], errors:[] };
  await mkdir(output); // Evidence is immutable; never overwrite an earlier run.
  try {
    for(const id of before.objectIds) {
      const original=before.fingerprints[id], candidate=after.fingerprints[id];
      const entry=bundle.objects[id];
      if(entry) {
        const baselineFacts=await json(resolve(receiptRoot,entry.baselineFacts));
        const candidateFacts=await json(resolve(receiptRoot,entry.candidateFacts));
        requireRepresentationReceipt(entry.receipt,{objectId:id,baselineSource:before.sourceIdentity.sha256,
          candidateSource:after.sourceIdentity.sha256,before:original,after:candidate,baselineFacts,candidateFacts,
          behaviorCorrection:entry.behaviorCorrection});
        result.sourceChanges.push({id,changes:entry.receipt.changes});
      } else assert.deepEqual(candidate,original,`${id}: undeclared representation change`);
    }
    for(const candidate of after.captures) {
      const reference=before.captures.find(c=>c.prefix===candidate.prefix&&c.kind===candidate.kind);
      assert.ok(reference,`Missing reference ${candidate.prefix}`);
      const change=bundle.controlCases?.[`${candidate.prefix}:${candidate.kind}`];
      requireCaptureState(reference,candidate,change);
      for(let phase=0;phase<reference.frameSha256s.length;phase++) {
        const filename=`${candidate.prefix}-${candidate.kind}${phase?`-phase${phase}`:''}.png`;
        const a=await readFile(resolve(dirname(baselineFile),filename));
        const b=await readFile(resolve(dirname(candidateFile),filename));
        assert.equal(sha(a),reference.frameSha256s[phase],'Reference readback hash');
        assert.equal(sha(b),candidate.frameSha256s[phase],'Candidate readback hash');
        const {diff,...comparison}=await compareCaptures(a,b);
        const difference=`${candidate.prefix}-${candidate.kind}-phase${phase}-absolute-diff.png`;
        await writeFile(resolve(output,difference),diff);
        result.comparisons.push({prefix:candidate.prefix,kind:candidate.kind,phase,...comparison,difference});
      }
    }
    result.complete=true;
    result.exactPixels=result.comparisons.every(c=>c.changedPixels===0);
    result.baselineRepeatabilityFailures=before.repeatabilityFailures??[];
    result.candidateRepeatabilityFailures=after.repeatabilityFailures??[];
    result.strictPass=result.exactPixels&&!result.baselineRepeatabilityFailures.length&&!result.candidateRepeatabilityFailures.length;
  } catch(error) {result.errors.push(error.stack);result.strictPass=false;}
  await writeFile(resolve(output,'report.json'),JSON.stringify(result,null,2)+'\n');
  return result;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) {
  const [baselineFile,candidateFile,receiptArgument,output,...options]=process.argv.slice(2);
  assert.ok(!options.length || options.length === 2 && options[0] === "--object", "Use an explicit --object ID subset");
  assert.ok(output,'Use BASELINE_REPORT CANDIDATE_REPORT RECEIPT_BUNDLE_OR_DASH FRESH_OUTPUT_DIRECTORY');
  const result=await comparePreparedPresentations({baselineFile:resolve(baselineFile),candidateFile:resolve(candidateFile),
    receiptFile:receiptArgument==='-'?null:resolve(receiptArgument),output:resolve(output),objectIds:options.length?[options[1]]:null});
  console.log(JSON.stringify({complete:result.complete,strictPass:result.strictPass,frames:result.comparisons.length,errors:result.errors}));
  if(!result.strictPass)process.exitCode=1;
}
