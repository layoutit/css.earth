import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/virginia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'virginia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/virginia/virginia-directional-sun.webp",
      "two": "/scenes/virginia/virginia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/virginia/virginia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/virginia/virginia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
