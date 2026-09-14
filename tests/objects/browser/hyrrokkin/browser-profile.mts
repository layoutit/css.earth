import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/hyrrokkin/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hyrrokkin',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/hyrrokkin/hyrrokkin-model-surface@2x.webp','/scenes/hyrrokkin/hyrrokkin-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
