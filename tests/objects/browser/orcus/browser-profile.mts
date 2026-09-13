import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/orcus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'orcus',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/orcus/orcus-directional-sun.webp',two:'/scenes/orcus/orcus-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/orcus/orcus-model-surface@2x.webp','/scenes/orcus/orcus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
