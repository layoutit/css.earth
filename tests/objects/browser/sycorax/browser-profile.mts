import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/sycorax/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sycorax',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/sycorax/sycorax-model-surface@2x.webp','/scenes/sycorax/sycorax-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
