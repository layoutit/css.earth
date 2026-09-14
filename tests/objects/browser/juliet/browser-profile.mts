import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/juliet/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'juliet',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/juliet/juliet-model-surface@2x.webp','/scenes/juliet/juliet-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
