import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeFrameDefinitions,unsignedAddress} from './native-symbols.mts';
test('native frames retain UUID, architecture and ASLR load address through binary references',()=>{
 const frames=nativeFrameDefinitions('<frame id="1" name="0x1010" addr="0x1010"><binary id="2" UUID="ABC" path="/lib/Test" arch="arm64e" load-addr="0x1000"/></frame><frame id="3" name="0x1020" addr="0x1020"><binary ref="2"/></frame>');
 assert.equal(frames.length,2);assert.equal(frames[1].binary.UUID,'ABC');assert.equal(frames[1].binary['load-addr'],'0x1000');
 assert.equal(nativeFrameDefinitions('<frame id="1" name="0x1010" addr="bad"><binary ref="2"/></frame>').length,0);
});
test('a frame defined after a reference to an earlier one is kept: the leaf of the next sample',()=>{
 const binary='<binary id="2" UUID="ABC" path="/lib/Test" arch="arm64e" load-addr="0x1000"/>';
 const frames=nativeFrameDefinitions(`<backtrace id="9"><frame id="1" name="0x1010" addr="0x1010">${binary}</frame></backtrace><backtrace id="10"><frame ref="1"/></backtrace><backtrace id="11"><frame id="3" name="0x1020" addr="0x1020"><binary ref="2"/></frame><frame ref="1"/></backtrace>`);
 assert.deepEqual(frames.map(frame=>frame.id),['1','3']);
});
test('a signed return address is placed by the address under its signature',()=>{
 assert.equal(unsignedAddress('0x1aadfb9f9','0x1a9f31000'),'0x1aadfb9f9');
 assert.equal(unsignedAddress('0x17770b81aae46034','0x1a9f31000'),'0x1aae46034','an iPad: 39 bits of address');
 assert.equal(unsignedAddress('0x0020700123456789','0x700123400000'),'0x700123456789','a Mac: 47 bits of address');
 const frames=nativeFrameDefinitions('<frame id="1" name="0x17770b81aae46033" addr="0x17770b81aae46034"><binary id="2" UUID="ABC" path="/lib/Test" arch="arm64e" load-addr="0x1a9f31000"/></frame>');
 assert.equal(frames[0].address,'0x1aae46034');
});
