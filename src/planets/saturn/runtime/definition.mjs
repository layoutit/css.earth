import { PREPARED_OBJECT_RUNTIME_SCHEMA } from "../../../platform/prepared-schema.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_PRESENTATION } from "./preparedPresentation.mjs";

export const runtimeDefinition = Object.freeze({
  ...PREPARED_PRESENTATION,
  schema: PREPARED_OBJECT_RUNTIME_SCHEMA,
  id: "saturn",
  controls: objectControls,
});
