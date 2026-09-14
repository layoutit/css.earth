import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ixion/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ixion',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/ixion/ixion-model-surface@2x.webp','/scenes/ixion/ixion-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
