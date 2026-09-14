import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/mani/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mani',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/mani/mani-model-surface@2x.webp','/scenes/mani/mani-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
