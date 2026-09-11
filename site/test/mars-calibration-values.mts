import { shape, array, text, number, optional } from '../../tools/objects/terrestrial-layers/source-records.mts';
import { parseNativeView, parseCalibrationManifest } from '../../tests/objects/oracle/mars/google-earth-pro/native-capture-values.mts';
export { parseNativeView, parseCalibrationManifest };
export const crop = shape({left:number,top:number,width:number,height:number});
export const disc = shape({centerX:number,centerY:number,width:number,height:number});
export const atlas = shape({id:text,path:text,width:number,height:number,encodedSha256:text,decodedRgbaSha256:text,sourceDecodedRgbaSha256:text});
export const parseAtlasManifest = shape({sourceDecodedRgbaSha256:text,atlases:array(atlas)});
export const registrationCapture = shape({nativeCamera:parseNativeView,nativeDisc:disc,zoom:number,
  browserEndpoint:shape({controlPitch:number,controlYaw:number,screenRollDegrees:optional(number)})});
export const parseBrowserRegistration = shape({qualification:text,viewport:shape({width:number,height:number}),crop,
  densities:array(shape({density:number,captures:array(registrationCapture)}))});
export const parseNativeRegistration = shape({qualification:text,calibration:shape({sourceDecodedRgbaSha256:text}),
  captures:array(shape({id:text,camera:parseNativeView,coverage:array(text),final:shape({path:text,raw:shape({path:text}),crop})}))});
export const qualification = shape({id:text,qualification:text});
export const parseNativeTraining = shape({qualification:text,scenarioQualifications:array(qualification),
  runs:array(shape({repeat:number,scenarios:array(shape({id:text,trace:shape({path:text,sha256:text,frameCount:number})}))}))});
export type NativeCamera = ReturnType<typeof parseNativeView>;
export type Crop = ReturnType<typeof crop>;
export type BrowserRegistration = ReturnType<typeof parseBrowserRegistration>;
export type RegistrationCapture = ReturnType<typeof registrationCapture>;
