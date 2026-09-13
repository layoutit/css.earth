import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/ilse/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ilse',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/ilse/ilse-shape-surface@2x.webp",
    "/scenes/ilse/ilse-directional-sun@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/ilse/ilse-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
