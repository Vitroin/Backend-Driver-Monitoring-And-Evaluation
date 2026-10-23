import { UserRole } from '@common/enums';

export enum OrganizationTypes{
  DRIVING_SCHOOL = 'driving_school',
  INSURANCE_COMPANY = 'insurance_company',
  FLEET_COMPANY = 'fleet_company',
}

// The role a new organization's owner gets, by organization type
export const OWNER_ROLES: Record<OrganizationTypes, UserRole> = {
  [OrganizationTypes.DRIVING_SCHOOL]: UserRole.SCHOOL_ADMINISTRATOR,
  [OrganizationTypes.FLEET_COMPANY]: UserRole.FLEET_MANAGER,
  [OrganizationTypes.INSURANCE_COMPANY]: UserRole.INSURANCE_MANAGER,
};

// The role an employee invited into an organization gets, by organization type
export const EMPLOYEE_ROLES: Record<OrganizationTypes, UserRole> = {
  [OrganizationTypes.DRIVING_SCHOOL]: UserRole.DRIVER_INSTRUCTOR,
  [OrganizationTypes.FLEET_COMPANY]: UserRole.FLEET_ANALYST,
  [OrganizationTypes.INSURANCE_COMPANY]: UserRole.INSURANCE_ANALYST,
};
