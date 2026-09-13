import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/siarnaq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'siarnaq',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/siarnaq/siarnaq-model-surface@2x.webp','/scenes/siarnaq/siarnaq-lighting.webp','/scenes/siarnaq/siarnaq-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
