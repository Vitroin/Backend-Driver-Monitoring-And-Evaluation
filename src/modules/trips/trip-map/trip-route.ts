import { SpeedCategory, SpeedLimitSource } from '@common/enums';

// "Near limit" is up to this many percent above the limit; anything faster is "over limit"
export const DEFAULT_NEAR_LIMIT_TOLERANCE_PERCENT = 10;

// Within: speed ≤ limit. Near: at most `nearLimitTolerancePercent` above it. Over: more than that.
// Unknown when either value is missing, so a gap in the readings is never shown as safe driving.
export function classifySpeed(
  speedKmh: number | null,
  speedLimitKmh: number | null,
  nearLimitTolerancePercent = DEFAULT_NEAR_LIMIT_TOLERANCE_PERCENT,
): SpeedCategory {
  if (speedKmh === null || speedLimitKmh === null) return SpeedCategory.UNKNOWN;
  if (speedKmh <= speedLimitKmh) return SpeedCategory.WITHIN_LIMIT;
  // Compared in percent units, so 55 km/h at a limit of 50 is exactly 10% over, without floating-point drift
  if (speedKmh * 100 <= speedLimitKmh * (100 + nearLimitTolerancePercent)) return SpeedCategory.NEAR_LIMIT;
  return SpeedCategory.OVER_LIMIT;
}

export type ResolvedSpeedLimit = { speedLimitKmh: number | null; speedLimitSource: SpeedLimitSource | null };

// The limit at a GPS point: the one recorded for that location, else the trip-wide limit set when it was planned
export function resolveSpeedLimit(pointLimitKmh: number | null, tripLimitKmh: number | null): ResolvedSpeedLimit {
  if (pointLimitKmh !== null) return { speedLimitKmh: pointLimitKmh, speedLimitSource: SpeedLimitSource.ROUTE };
  if (tripLimitKmh !== null) return { speedLimitKmh: tripLimitKmh, speedLimitSource: SpeedLimitSource.TRIP };
  return { speedLimitKmh: null, speedLimitSource: null };
}

export type SpeedSegment = { speedCategory: SpeedCategory; startIndex: number; endIndex: number };

// Runs of consecutive points with the same category, as index ranges into the points (both ends inclusive).
// The line between two points takes the first point's colour, and each segment ends on the next one's first point,
// so the polylines join up. Fewer than 2 points can't be drawn as a line, so they give no segments.
export function buildSpeedSegments(categories: SpeedCategory[]): SpeedSegment[] {
  const segments: SpeedSegment[] = [];
  for (let i = 1; i < categories.length; i++) {
    const current = segments.at(-1);
    if (current?.speedCategory === categories[i - 1]) current.endIndex = i;
    else segments.push({ speedCategory: categories[i - 1], startIndex: i - 1, endIndex: i });
  }
  return segments;
}

// Keeps every `stride`-th point, the last point, and the points on both sides of every change of speed category,
// so a long trip shrinks to about 1/stride of its points without moving where the route changes colour.
// Only the kept points are held in memory. `total` is how many points were read.
export async function sampleRoute<T extends { speedCategory: SpeedCategory }>(
  points: AsyncIterable<T>,
  stride: number,
): Promise<{ points: T[]; total: number }> {
  const kept: T[] = [];
  let previous: T | undefined;
  let previousKept = false;
  let index = 0;

  for await (const point of points) {
    const categoryChanged = previous !== undefined && previous.speedCategory !== point.speedCategory;
    if (categoryChanged && !previousKept) kept.push(previous as T);

    const keep = index % stride === 0 || categoryChanged;
    if (keep) kept.push(point);

    previous = point;
    previousKept = keep;
    index++;
  }
  if (previous !== undefined && !previousKept) kept.push(previous);

  return { points: kept, total: index };
}
