import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/styx/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'styx',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/styx/styx-model-surface@2x.webp','/scenes/styx/styx-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
