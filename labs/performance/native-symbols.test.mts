import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeFrameDefinitions} from './native-symbols.mts';
test('native frames retain UUID, architecture and ASLR load address through binary references',()=>{
 const frames=nativeFrameDefinitions('<frame id="1" name="0x1010" addr="0x1010"><binary id="2" UUID="ABC" path="/lib/Test" arch="arm64e" load-addr="0x1000"/></frame><frame id="3" name="0x1020" addr="0x1020"><binary ref="2"/></frame>');
 assert.equal(frames.length,2);assert.equal(frames[1].binary.UUID,'ABC');assert.equal(frames[1].binary['load-addr'],'0x1000');
 assert.equal(nativeFrameDefinitions('<frame id="1" name="0x1010" addr="bad"><binary ref="2"/></frame>').length,0);
});
