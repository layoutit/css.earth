import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/anthe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'anthe',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/anthe/anthe-model-surface@2x.webp','/scenes/anthe/anthe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
