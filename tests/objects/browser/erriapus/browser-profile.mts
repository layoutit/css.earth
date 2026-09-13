import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/erriapus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'erriapus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/erriapus/erriapus-model-surface@2x.webp','/scenes/erriapus/erriapus-lighting.webp','/scenes/erriapus/erriapus-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
