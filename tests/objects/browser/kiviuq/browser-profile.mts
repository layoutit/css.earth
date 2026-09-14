import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/kiviuq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kiviuq',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/kiviuq/kiviuq-model-surface@2x.webp','/scenes/kiviuq/kiviuq-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
