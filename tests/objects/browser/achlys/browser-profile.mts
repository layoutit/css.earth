import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/achlys/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'achlys',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/achlys/achlys-directional-sun.webp',two:'/scenes/achlys/achlys-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/achlys/achlys-model-surface@2x.webp','/scenes/achlys/achlys-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
