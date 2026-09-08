import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/reinmuthia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'reinmuthia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/reinmuthia/reinmuthia-directional-sun.webp",
      "two": "/scenes/reinmuthia/reinmuthia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/reinmuthia/reinmuthia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/reinmuthia/reinmuthia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
