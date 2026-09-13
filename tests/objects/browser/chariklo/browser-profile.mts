import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/chariklo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'chariklo',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/chariklo/chariklo-model-surface@2x.webp','/scenes/chariklo/chariklo-lighting.webp','/scenes/chariklo/chariklo-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
