import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/philosophia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'philosophia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/philosophia/philosophia-directional-sun.webp",
      "two": "/scenes/philosophia/philosophia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/philosophia/philosophia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/philosophia/philosophia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
