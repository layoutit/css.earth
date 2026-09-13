import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/annefrank/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'annefrank',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/annefrank/annefrank-model-surface@2x.webp','/scenes/annefrank/annefrank-lighting.webp','/scenes/annefrank/annefrank-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
