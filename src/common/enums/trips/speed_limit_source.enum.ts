// Where a route point's speed limit came from
export enum SpeedLimitSource {
  // Recorded for that location along with the GPS point
  ROUTE = 'route',
  // The trip-wide limit set when the trip was planned
  TRIP = 'trip',
}
