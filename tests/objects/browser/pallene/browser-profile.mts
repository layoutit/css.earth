import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/pallene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pallene',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/pallene/pallene-normal-surface@2x.webp','/scenes/pallene/pallene-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
