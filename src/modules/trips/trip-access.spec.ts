import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { UserRole } from '@common/enums';
import { canViewTrip } from './trip-access';

describe('canViewTrip', () => {
  const driver = new Types.ObjectId();
  const organization = new Types.ObjectId();
  const trip = { driver, organization };

  it('lets the driver see their own trip', () => {
    expect(canViewTrip({ _id: new Types.ObjectId(driver.toString()), role: UserRole.DRIVER, organization }, trip)).toBe(true);
  });

  it("hides another driver's trip, even in the same organization", () => {
    expect(canViewTrip({ _id: new Types.ObjectId(), role: UserRole.DRIVER, organization }, trip)).toBe(false);
  });

  it("lets staff see their organization's trips only", () => {
    expect(canViewTrip({ _id: new Types.ObjectId(), role: UserRole.DRIVER_INSTRUCTOR, organization }, trip)).toBe(true);
    expect(canViewTrip({ _id: new Types.ObjectId(), role: UserRole.FLEET_ANALYST, organization: new Types.ObjectId() }, trip)).toBe(false);
    expect(canViewTrip({ _id: new Types.ObjectId(), role: UserRole.FLEET_ANALYST, organization: null }, trip)).toBe(false);
  });

  it('lets a super admin see any trip', () => {
    expect(canViewTrip({ _id: new Types.ObjectId(), role: UserRole.SUPER_ADMIN }, trip)).toBe(true);
  });
});
