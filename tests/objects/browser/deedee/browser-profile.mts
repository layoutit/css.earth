import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/deedee/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'deedee',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/deedee/deedee-model-surface@2x.webp','/scenes/deedee/deedee-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
