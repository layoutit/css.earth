import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/dimorphos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dimorphos',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/dimorphos/dimorphos-directional-sun.webp",
      "two": "/scenes/dimorphos/dimorphos-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/dimorphos/dimorphos-shape-surface@2x.webp"
  ],
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/dimorphos/dimorphos-elevation-surface@2x.webp",
    "preReadyDisabled": true
  },
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
