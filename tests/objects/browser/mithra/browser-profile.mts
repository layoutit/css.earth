import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/mithra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mithra',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/mithra/mithra-shape-surface@2x.webp",
    "/scenes/mithra/mithra-directional-sun@2x.webp"
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
    "slowAsset": "/scenes/mithra/mithra-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
