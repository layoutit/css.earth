import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/cressida/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cressida',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/cressida/cressida-model-surface@2x.webp','/scenes/cressida/cressida-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
