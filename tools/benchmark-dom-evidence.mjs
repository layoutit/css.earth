export const RETAINED_SCENE_LEAF_TAGS = Object.freeze(["b", "i", "s", "u"]);
export const TRANSFORM_GROUP_TAGS = Object.freeze(["em"]);

export function selectorForTags(tags) {
  return tags.join(", ");
}

export function countTags(tagCounts, tags) {
  return tags.reduce((total, tag) => total + (tagCounts[tag] ?? 0), 0);
}
