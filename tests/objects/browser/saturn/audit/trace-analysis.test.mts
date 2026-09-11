import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChromeTrace } from '../../comets/chrome-trace-values.mts';
import { analyzeTrace, metricDelta } from './trace-analysis.mts';

const event = (name:string,ph:string,ts:number,fields:Record<string,unknown>={}) => ({name,ph,ts,pid:7,tid:9,...fields});
test('trace analysis preserves measured intervals, frame forks and byte receipts', () => {
  const trace=parseChromeTrace({traceEvents:[
    event('thread_name','M',0,{args:{name:'CrRendererMain'}}),
    event('saturn-trace-start','I',1),event('saturn-trace-interaction-start','I',100),
    event('saturn-trace-interaction-end','I',100000),event('saturn-trace-end','I',120000),
    event('RunTask','X',200,{dur:60000}),event('Paint','X',300,{dur:1200}),
    event('PipelineReporter','b',400,{args:{frame_reporter:{state:'STATE_PRESENTED_PARTIAL',frame_source:1,frame_sequence:2,frame_type:'FORKED',affects_smoothness:true}}}),
    event('PipelineReporter','b',401,{args:{frame_reporter:{state:'STATE_PRESENTED_ALL',frame_source:1,frame_sequence:2}}}),
    event('PipelineReporter','b',402,{args:{frame_reporter:{state:'STATE_DROPPED',frame_source:1,frame_sequence:3,has_missing_content:true}}}),
    event('ResourceSendRequest','I',500,{args:{data:{url:'https://example.test/saturn-orbit-material-row-01.webp',requestId:'asset-1'}}}),
    event('ResourceFinish','I',600,{args:{data:{requestId:'asset-1',encodedDataLength:1234}}}),
    event('ResourceFinish','I',601,{args:{data:{encodedDataLength:9999}}}),
  ]});
  const result=analyzeTrace(trace.traceEvents);
  assert.equal(result.timeline.paint.totalMilliseconds,1.2);
  assert.equal(result.longMainThreadTasks[0]?.durationMilliseconds,60);
  assert.equal(result.pipeline.uniqueFrameSequences,2);
  assert.equal(result.pipeline.partialPairedWithPresentedAll,1);
  assert.equal(result.pipeline.droppedWithoutPresentation,1);
  assert.equal(result.pipeline.missingContent,1);
  assert.equal(result.preparedRowRequests.encodedBytes,1234);
  assert.equal(result.windows.interaction?.preparedRowRequests.requestCount,1);
  assert.equal(result.windows.idle?.pipeline.reporterCount,0);
});
test('trace analysis rejects absent renderer ownership and keeps metric deltas', () => {
  assert.throws(()=>analyzeTrace([]), /renderer main thread/);
  assert.equal(metricDelta([{name:'TaskDuration',value:1}], [{name:'TaskDuration',value:1.25}]).TaskDuration,.25);
});
