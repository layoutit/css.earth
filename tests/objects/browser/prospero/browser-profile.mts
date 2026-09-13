import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/prospero/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'prospero',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/prospero/prospero-model-surface@2x.webp','/scenes/prospero/prospero-lighting.webp','/scenes/prospero/prospero-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
