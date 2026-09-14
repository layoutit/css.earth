import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/hiiaka/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hiiaka',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/hiiaka/hiiaka-model-surface@2x.webp','/scenes/hiiaka/hiiaka-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
