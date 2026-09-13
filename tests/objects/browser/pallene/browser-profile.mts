import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/pallene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pallene',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/pallene/pallene-directional-sun.webp',two:'/scenes/pallene/pallene-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/pallene/pallene-normal-surface@2x.webp','/scenes/pallene/pallene-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
