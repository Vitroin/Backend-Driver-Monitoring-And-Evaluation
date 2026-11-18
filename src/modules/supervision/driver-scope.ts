import { Types } from 'mongoose';

export type DriverScope =
  | { kind: 'all' }
  | { kind: 'organization'; organization: Types.ObjectId }
  | { kind: 'drivers'; drivers: Types.ObjectId[]; organization: Types.ObjectId };

export function scopeMatch(scope: DriverScope, driverId?: Types.ObjectId): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  if (scope.kind !== 'all') match.organization = scope.organization;
  if (scope.kind === 'drivers') match.driver = { $in: scope.drivers };
  if (driverId) {
    const allowed = scope.kind !== 'drivers' || scope.drivers.some((d) => d.equals(driverId));
    match.driver = allowed ? driverId : { $in: [] };
  }
  return match;
}
