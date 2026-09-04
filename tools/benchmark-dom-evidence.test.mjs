import assert from "node:assert/strict";
import test from "node:test";

import {
  countTags,
  RETAINED_SCENE_LEAF_TAGS,
  selectorForTags,
  TRANSFORM_GROUP_TAGS,
} from "./benchmark-dom-evidence.mjs";

test("retained scene-leaf accounting includes Mars moon u leaves", () => {
  const marsTags = { main: 1, div: 15, s: 581, u: 160, span: 2 };
  const saturnTags = { main: 1, div: 47, s: 483, span: 8 };

  assert.equal(countTags(marsTags, RETAINED_SCENE_LEAF_TAGS), 741);
  assert.equal(countTags(saturnTags, RETAINED_SCENE_LEAF_TAGS), 483);
  assert.equal(countTags(marsTags, TRANSFORM_GROUP_TAGS), 0);
  assert.equal(selectorForTags(RETAINED_SCENE_LEAF_TAGS), "b, i, s, u");
});
