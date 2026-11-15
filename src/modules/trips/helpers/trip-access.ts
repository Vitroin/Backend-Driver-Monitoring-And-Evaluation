import { UserRole } from '@common/enums';
import type { Types } from 'mongoose';

export type TripOwnership = { driver: Types.ObjectId; organization: Types.ObjectId };
export type TripViewer = { _id: Types.ObjectId; role: UserRole; organization?: Types.ObjectId | null };

export function canViewTrip(viewer: TripViewer, trip: TripOwnership): boolean {
  // 1. Super admins can see every trip
  if (viewer.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  // 2. Drivers can only see trips they drove
  if (viewer.role === UserRole.DRIVER) {
    return trip.driver.equals(viewer._id);
  }

  // 3. Staff can see trips from their organization
  if (!viewer.organization) {
    return false;
  }
  
  return trip.organization.equals(viewer.organization);
}