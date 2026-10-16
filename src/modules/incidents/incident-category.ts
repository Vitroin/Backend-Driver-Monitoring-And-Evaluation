import { IncidentCategory, IncidentType } from '@common/enums';

// Which timeline row each incident type goes in. A Record, so adding an IncidentType without a row fails to compile.
export const INCIDENT_CATEGORY: Record<IncidentType, IncidentCategory> = {
  [IncidentType.HARSH_BRAKING]: IncidentCategory.DRIVING_ACTION,
  [IncidentType.HARSH_ACCELERATION]: IncidentCategory.DRIVING_ACTION,
  [IncidentType.SPEEDING]: IncidentCategory.DRIVING_ACTION,
  [IncidentType.POOR_LATERAL_CONTROL]: IncidentCategory.DRIVING_ACTION,
  [IncidentType.UNSAFE_FOLLOWING_DISTANCE]: IncidentCategory.DRIVING_ACTION,
  [IncidentType.DISTRACTION]: IncidentCategory.DRIVER_STATE,
  [IncidentType.PHONE_USAGE]: IncidentCategory.DRIVER_STATE,
  [IncidentType.DROWSINESS]: IncidentCategory.DRIVER_STATE,
  [IncidentType.EYE_CLOSURE]: IncidentCategory.DRIVER_STATE,
};
