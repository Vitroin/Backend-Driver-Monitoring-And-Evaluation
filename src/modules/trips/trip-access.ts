import { UserRole } from '@common/enums';
import type { Types } from 'mongoose';

export type TripOwnership = { driver: Types.ObjectId; organization: Types.ObjectId };
export type TripViewer = { _id: Types.ObjectId; role: UserRole; organization?: Types.ObjectId | null };

// Who may open a trip: the driver who drove it, staff of the driver's organization (instructors, analysts, managers),
// and super admins
export function canViewTrip(viewer: TripViewer, trip: TripOwnership): boolean {
  if (viewer.role === UserRole.SUPER_ADMIN) return true;
  if (viewer.role === UserRole.DRIVER) return trip.driver.equals(viewer._id);
  return !!viewer.organization && trip.organization.equals(viewer.organization);
}
