import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/panopaea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'panopaea',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/panopaea/panopaea-directional-sun.webp",
      "two": "/scenes/panopaea/panopaea-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/panopaea/panopaea-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/panopaea/panopaea-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
