import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/brucia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'brucia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/brucia/brucia-shape-surface@2x.webp",
    "/scenes/brucia/brucia-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/brucia/brucia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
