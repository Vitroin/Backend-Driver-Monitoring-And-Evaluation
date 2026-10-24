import { TripRisk } from '@common/enums';

// Risk levels (SRS §8.5): 85–100 low ("Safe driving"), 65–84 medium ("Needs improvement"), below 65 high
export const LOW_RISK_MIN_SCORE = 85;
export const MEDIUM_RISK_MIN_SCORE = 65;

export function riskForScore(score: number): TripRisk {
  if (score >= LOW_RISK_MIN_SCORE) return TripRisk.LOW;
  if (score >= MEDIUM_RISK_MIN_SCORE) return TripRisk.MEDIUM;
  return TripRisk.HIGH;
}

export const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

// A trip starts at 100 and loses each counted incident's points, never going below 0
export const scoreForDeductions = (pointsDeducted: number): number => Math.max(0, roundToOneDecimal(100 - pointsDeducted));

export const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

// Long-term score (SRS §8.4): mean of trip scores weighted by duration × exp(−age / 30 days),
// so longer and more recent trips count more. null before the first scored trip.
const LONG_TERM_TAU_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScoredTrip {
  score: number;
  durationSeconds: number | null;
  startedAt: Date;
}

export function longTermScore(trips: ScoredTrip[], now: Date = new Date()): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const trip of trips) {
    const ageDays = (now.getTime() - trip.startedAt.getTime()) / DAY_MS;
    const weight = (trip.durationSeconds ?? 0) * Math.exp(-ageDays / LONG_TERM_TAU_DAYS);
    weightedSum += weight * trip.score;
    totalWeight += weight;
  }
  return totalWeight === 0 ? null : roundToOneDecimal(weightedSum / totalWeight);
}

