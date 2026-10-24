import { roundToOneDecimal } from './trip-scoring';

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

type Coordinates = { latitude: number; longitude: number };

/** Great-circle distance between two GPS fixes, in km. */
export function haversineKm(from: Coordinates, to: Coordinates): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export type RouteMeasurement = { distanceKm: number; topSpeedKmh: number | null; lastRecordedAt: Date | null };

/** Distance along the route, top recorded speed and the time of the last fix. The points must be in chronological order. */
export async function measureRoute(
  points: AsyncIterable<Coordinates & { speedKmh: number | null; recordedAt: Date }>,
): Promise<RouteMeasurement> {
  let distanceKm = 0;
  let topSpeedKmh: number | null = null;
  let previous: Coordinates | undefined;
  let lastRecordedAt: Date | null = null;

  for await (const point of points) {
    if (previous) distanceKm += haversineKm(previous, point);
    // ?? null: lean() documents leave out fields that were never set
    const speed = point.speedKmh ?? null;
    if (speed !== null && (topSpeedKmh === null || speed > topSpeedKmh)) topSpeedKmh = speed;
    previous = point;
    lastRecordedAt = point.recordedAt;
  }
  return { distanceKm, topSpeedKmh, lastRecordedAt };
}

export type TripMeasurements = {
  durationSeconds: number;
  distanceKm: number;
  averageSpeedKmh: number | null;
  topSpeedKmh: number | null;
};

/** The completed trip's figures from its route, its speed readings and its start and end times. */
export function tripMeasurements(startedAt: Date, endedAt: Date, route: RouteMeasurement, readingsTopSpeedKmh: number | null): TripMeasurements {
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const distanceKm = Math.round(route.distanceKm * 100) / 100;
  const speeds = [route.topSpeedKmh, readingsTopSpeedKmh].filter((speed): speed is number => speed !== null);
  return {
    durationSeconds,
    distanceKm,
    averageSpeedKmh: durationSeconds > 0 ? roundToOneDecimal(distanceKm / (durationSeconds / 3600)) : null,
    topSpeedKmh: speeds.length ? Math.max(...speeds) : null,
  };
}
