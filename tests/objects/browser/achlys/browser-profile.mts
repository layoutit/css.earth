import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/achlys/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'achlys',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/achlys/achlys-model-surface@2x.webp','/scenes/achlys/achlys-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
