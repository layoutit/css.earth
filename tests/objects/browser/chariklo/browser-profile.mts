import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/chariklo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'chariklo',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/chariklo/chariklo-directional-sun.webp',two:'/scenes/chariklo/chariklo-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/chariklo/chariklo-model-surface@2x.webp','/scenes/chariklo/chariklo-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
