// How a GPS point's speed compares with the speed limit there (the route's blue / orange / red colours)
export enum SpeedCategory {
  WITHIN_LIMIT = 'within_limit',
  NEAR_LIMIT = 'near_limit',
  OVER_LIMIT = 'over_limit',
  // The speed or the limit is missing, so the point can't be judged either way
  UNKNOWN = 'unknown',
}
