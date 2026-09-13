import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/lutetia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lutetia',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/lutetia/lutetia-osiris-surface@2x.webp",
    "/scenes/lutetia/lutetia-directional-sun@2x.webp"
  ],
  "lensRace": {
    "defaultId": "osiris",
    "slowId": "shape",
    "winnerId": "osiris",
    "slowAsset": "/scenes/lutetia/lutetia-shape-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "osiris",
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
