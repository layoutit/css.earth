import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/hygiea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hygiea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/hygiea/hygiea-directional-sun.webp",
      "two": "/scenes/hygiea/hygiea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/hygiea/hygiea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/hygiea/hygiea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
