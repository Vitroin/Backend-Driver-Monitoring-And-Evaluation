/**
 * Organizations seed — for testing the organization and instructor models
 *
 * Usage (runs through the Nest build, like seed.ts):
 *   bun run seed:organizations          # nest build && node dist/database/scripts/seed-organizations.js
 *   bun run seed:organizations:fresh    # same, with --fresh (replaces this seed's previous data)
 *
 * Seeds one organization of each type, each with its owner (OWNER_ROLES) and employees (EMPLOYEE_ROLES),
 * and drivers for the driving school and the fleet company. The school's instructors get its drivers as
 * students (Instructor.drivingStudents).
 * It then reads everything back through the organization virtuals and populate, next to the expected counts,
 * so a wrong ref, foreignField or match shows up as a mismatch.
 * Uses its own email domain, so it never clashes with seed.ts or cleans up its data.
 *
 * Like seed.ts: every id is worked out up front from a stable key, everything is written in one transaction,
 * and every seeded reference is checked before it commits (see ../seed/seed-kit.ts).
 */

import { Types } from 'mongoose';
import * as argon2 from 'argon2';
import { User } from '@modules/users/user.model';
import { EMPLOYEE_ROLES, OrganizationTypes, OWNER_ROLES } from '@modules/organizations/organizations.enum';
import { UserRole } from '@common/enums';
import {
  assertCanSeed,
  assertNoForeignMembers,
  bootstrap,
  findSeededScope,
  insertOrganizationsAndUsers,
  mkOrganization,
  mkUser,
  runSeedTransaction,
  seedFaker,
  SeedScope,
} from '../seed/seed-kit';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  employeesPerOrganization: 2,
  driversPerOrganization: 4, // for the driving school and the fleet company only
  defaultPassword: 'Password123!',
  emailDomain: 'orgs.sdems.dev', // identifies this seed's users, and through them the rest of its data
  organizations: {
    school: 'Org Seed Driving School',
    fleet: 'Org Seed Fleet Company',
    insurance: 'Org Seed Insurance Company',
  },
  fakerSeed: 42,
};

// ---------------------------------------------------------------------------
// Plan: every document, with every id, before anything is written
// ---------------------------------------------------------------------------
function buildPlan(passwordHash: string) {
  const user = (role: UserRole, username: string, organization: Types.ObjectId) =>
    mkUser(role, username, `${username}@${CONFIG.emailDomain}`, organization, passwordHash);

  // ---------------- Organizations ----------------
  const organizations = {
    school: mkOrganization(CONFIG.organizations.school, OrganizationTypes.DRIVING_SCHOOL),
    fleet: mkOrganization(CONFIG.organizations.fleet, OrganizationTypes.FLEET_COMPANY),
    insurance: mkOrganization(CONFIG.organizations.insurance, OrganizationTypes.INSURANCE_COMPANY),
  };

  // ---------------- Owners + employees ----------------
  // the roles createOrganization and inviteEmployee give, by organization type
  const staff = Object.entries(organizations).flatMap(([key, organization]) => {
    const owner = user(OWNER_ROLES[organization.organizationType], `${key}-owner`, organization._id);
    organization.organizationOwner = owner._id;
    const employees = Array.from({ length: CONFIG.employeesPerOrganization }, (_, i) =>
      user(EMPLOYEE_ROLES[organization.organizationType], `${key}-employee${i + 1}`, organization._id),
    );
    return [owner, ...employees];
  });
  const instructors = staff
    .filter((member) => member.role === UserRole.DRIVER_INSTRUCTOR)
    .map((member) => ({ ...member, drivingStudents: [] as Types.ObjectId[] }));
  const otherStaff = staff.filter((member) => member.role !== UserRole.DRIVER_INSTRUCTOR);

  // ---------------- Drivers ----------------
  const learners = Array.from({ length: CONFIG.driversPerOrganization }, (_, i) =>
    user(UserRole.DRIVER, `school-driver${i + 1}`, organizations.school._id),
  );
  const fleetDrivers = Array.from({ length: CONFIG.driversPerOrganization }, (_, i) =>
    user(UserRole.DRIVER, `fleet-driver${i + 1}`, organizations.fleet._id),
  );
  // learners are shared out between the school's instructors in turn, so each one has students
  learners.forEach((learner, i) => instructors[i % instructors.length].drivingStudents.push(learner._id));
  const drivers = [...learners, ...fleetDrivers];

  const scope: SeedScope = {
    users: [...staff, ...drivers].map((member) => member._id),
    organizations: Object.values(organizations).map((organization) => organization._id),
    trips: [],
    incidents: [],
  };
  return { organizations, staff, instructors, users: [...otherStaff, ...drivers], drivers, scope };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  const fresh = process.argv.includes('--fresh');

  seedFaker(CONFIG.fakerSeed); // deterministic data across runs
  const passwordHash = await argon2.hash(CONFIG.defaultPassword);
  const plan = buildPlan(passwordHash);

  const context = await bootstrap();
  const { models } = context;

  try {
    const existing = await findSeededScope(models, {
      emailDomain: CONFIG.emailDomain,
      organizationNames: Object.values(CONFIG.organizations),
      planned: plan.scope,
    });
    assertCanSeed(existing, fresh);
    await assertNoForeignMembers(models, existing);

    const { removed } = await runSeedTransaction(context, { fresh, existing, seeded: plan.scope }, () =>
      insertOrganizationsAndUsers(models, {
        organizations: Object.values(plan.organizations),
        users: plan.users,
        instructors: plan.instructors,
      }),
    );
    if (removed) {
      console.log("Replaced this seed's previous data:");
      console.table(removed);
    }
    console.log('Every seeded reference checked: no orphans.');

    // ---------------- Read back ----------------
    const { staff, drivers, instructors } = plan;
    const inOrganization = (member: { organization: Types.ObjectId }, organizationId: Types.ObjectId) =>
      member.organization.equals(organizationId);

    const seededOrganizations = await models.organization
      .find({ _id: { $in: plan.scope.organizations } })
      .populate([
        { path: 'organizationDrivers', select: 'username' },
        { path: 'organizationEmployees', select: 'username' },
      ]);
    console.table(
      seededOrganizations.map((organization) => ({
        organization: organization.name,
        drivers: organization.organizationDrivers?.length ?? 0,
        expectedDrivers: drivers.filter((member) => inOrganization(member, organization._id)).length,
        employees: organization.organizationEmployees?.length ?? 0,
        expectedEmployees: staff.filter((member) => inOrganization(member, organization._id)).length,
      })),
    );

    // found through the Instructor model, so this also checks the discriminator stored them with the instructor role
    const seededInstructors = await models.instructor
      .find({ _id: { $in: instructors.map((instructor) => instructor._id) } })
      .populate<{ drivingStudents: Pick<User, 'username'>[] }>({ path: 'drivingStudents', select: 'username' });
    const usernameById = new Map(drivers.map((driver) => [driver._id.toString(), driver.username]));
    console.table(
      seededInstructors.map((instructor) => ({
        instructor: instructor.username,
        role: instructor.role,
        students: instructor.drivingStudents.map((student) => student.username).join(', '),
        expectedStudents: instructors
          .find((seeded) => seeded._id.equals(instructor._id))
          ?.drivingStudents.map((id) => usernameById.get(id.toString()))
          .join(', '),
      })),
    );
    console.log(`Login with any *@${CONFIG.emailDomain} account / ${CONFIG.defaultPassword}`);
  } finally {
    await context.app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
