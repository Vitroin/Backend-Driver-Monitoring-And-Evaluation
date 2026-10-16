import { describe, expect, it } from 'vitest';
import { SpeedCategory, SpeedLimitSource } from '@common/enums';
import { buildSpeedSegments, classifySpeed, resolveSpeedLimit, sampleRoute } from './trip-route';

const { WITHIN_LIMIT: WITHIN, NEAR_LIMIT: NEAR, OVER_LIMIT: OVER, UNKNOWN } = SpeedCategory;

async function* stream<T>(items: T[]) {
  yield* items;
}

describe('classifySpeed', () => {
  it.each([
    [30, WITHIN],
    [35, WITHIN],
    [36, NEAR],
    [38.5, NEAR],
    [39, OVER],
  ])('at a 35 km/h limit, %d km/h is %s', (speed, category) => {
    expect(classifySpeed(speed, 35)).toBe(category);
  });

  it('counts exactly 10% over as near the limit', () => {
    expect(classifySpeed(55, 50)).toBe(NEAR);
    expect(classifySpeed(55.1, 50)).toBe(OVER);
  });

  it('never calls a missing speed or limit safe', () => {
    expect(classifySpeed(null, 35)).toBe(UNKNOWN);
    expect(classifySpeed(20, null)).toBe(UNKNOWN);
  });

  it('takes a different near-limit tolerance', () => {
    expect(classifySpeed(39, 35, 20)).toBe(NEAR);
    expect(classifySpeed(36, 35, 0)).toBe(OVER);
  });
});

describe('resolveSpeedLimit', () => {
  it("prefers the limit recorded at the point over the trip's", () => {
    expect(resolveSpeedLimit(50, 35)).toEqual({ speedLimitKmh: 50, speedLimitSource: SpeedLimitSource.ROUTE });
  });

  it("falls back to the trip's limit", () => {
    expect(resolveSpeedLimit(null, 35)).toEqual({ speedLimitKmh: 35, speedLimitSource: SpeedLimitSource.TRIP });
  });

  it('reports no limit when neither is known', () => {
    expect(resolveSpeedLimit(null, null)).toEqual({ speedLimitKmh: null, speedLimitSource: null });
  });
});

describe('buildSpeedSegments', () => {
  it('gives nothing to draw for fewer than 2 points', () => {
    expect(buildSpeedSegments([])).toEqual([]);
    expect(buildSpeedSegments([OVER])).toEqual([]);
  });

  it('groups runs, each ending on the first point of the next so the lines join', () => {
    expect(buildSpeedSegments([WITHIN, WITHIN, OVER, OVER, NEAR, WITHIN])).toEqual([
      { speedCategory: WITHIN, startIndex: 0, endIndex: 2 },
      { speedCategory: OVER, startIndex: 2, endIndex: 4 },
      { speedCategory: NEAR, startIndex: 4, endIndex: 5 },
    ]);
  });

  it('keeps a single over-limit point visible between safe ones', () => {
    expect(buildSpeedSegments([WITHIN, OVER, WITHIN])).toEqual([
      { speedCategory: WITHIN, startIndex: 0, endIndex: 1 },
      { speedCategory: OVER, startIndex: 1, endIndex: 2 },
    ]);
  });
});

describe('sampleRoute', () => {
  const points = (categories: SpeedCategory[]) => categories.map((speedCategory, i) => ({ i, speedCategory }));

  it('keeps every point with a stride of 1', async () => {
    const input = points([WITHIN, OVER, WITHIN]);
    expect(await sampleRoute(stream(input), 1)).toEqual({ points: input, total: 3 });
  });

  it('keeps every stride-th point and the last one', async () => {
    const { points: kept, total } = await sampleRoute(stream(points(Array(10).fill(WITHIN))), 4);
    expect(kept.map((p) => p.i)).toEqual([0, 4, 8, 9]);
    expect(total).toBe(10);
  });

  it('keeps both points around a change of category, even between strides', async () => {
    const input = points([WITHIN, WITHIN, WITHIN, OVER, OVER, OVER, OVER, OVER]);
    const { points: kept } = await sampleRoute(stream(input), 5);
    expect(kept.map((p) => p.i)).toEqual([0, 2, 3, 5, 7]);
  });

  it('handles an empty route', async () => {
    expect(await sampleRoute(stream([]), 3)).toEqual({ points: [], total: 0 });
  });
});
