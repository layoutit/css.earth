import assert from "node:assert/strict";
import test from "node:test";
import { createPreparedTextureOverlay } from "./prepared-texture-overlay.mjs";

test("observation textures reuse retained slots and restore the latest base after a normal selection publication", () => {
  const styles = new Map([["--surface", 'url("base.webp")']]);
  const node = {style:{getPropertyValue:key=>styles.get(key),setProperty:(key,value)=>styles.set(key,value)}};
  const overlay = createPreparedTextureOverlay([{id:"surface",bindings:[{target:0,name:"--surface"}]}],[node]);
  overlay.set(new Map([["surface","blob:observation"]]));
  assert.equal(styles.get("--surface"),'url("blob:observation"),url("base.webp")');
  assert.equal(overlay.write(0,"--surface",'url("new-base.webp")'),true);
  assert.equal(styles.get("--surface"),'url("blob:observation"),url("new-base.webp")');
  assert.equal(overlay.write(0,"--unrelated","leave-alone"),false);
  overlay.clear(); assert.equal(styles.get("--surface"),'url("new-base.webp")');
  assert.throws(()=>overlay.set(new Map([["wrong","blob:observation"]])),/slots/);
  assert.throws(()=>overlay.set(new Map([["surface","https://unverified.example/image"]])),/slots/);
});
