import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/aldebaran/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'aldebaran',controls,audit:{canonicalPreparedAssets:['/scenes/aldebaran/aldebaran-surface-shape@2x.webp'],retained:{lensIds:['shape'],allowedMountSelectors:[]}}});
