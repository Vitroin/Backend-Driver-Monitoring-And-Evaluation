/**
 * Organizations seed — for testing the organization and instructor models
 *
 * Usage (runs through the Nest build, like seed.ts):
 *   bun run seed:organizations          # nest build && node dist/database/scripts/seed-organizations.js
 *   bun run seed:organizations:fresh    # same, with --fresh (wipes this seed's previous data first)
 *
 * Seeds one organization of each type, each with its owner (OWNER_ROLES) and employees (EMPLOYEE_ROLES),
 * and drivers for the driving school and the fleet company. The school's instructors get its drivers as
 * students (Instructor.drivingStudents).
 * It then reads everything back through the organization virtuals and populate, next to the expected counts,
 * so a wrong ref, foreignField or match shows up as a mismatch.
 * Uses its own email domain, so it never clashes with seed.ts or cleans up its data.
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';
import { User } from '@modules/users/user.model';
import { Instructor } from '@modules/instructors/instructors.model';
import { Organization } from '@modules/organizations/organization.model';
import { EMPLOYEE_ROLES, OrganizationTypes, OWNER_ROLES } from '@modules/organizations/organizations.enum';
import { Language, UserRole, UserStatus } from '@common/enums';
import { AppModule } from '../../app.module';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  employeesPerOrganization: 2,
  driversPerOrganization: 4, // for the driving school and the fleet company only
  defaultPassword: 'Password123!',
  emailDomain: 'orgs.sdems.dev', // used to identify (and clean up) this seed's users, and the organizations they own
};

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const oid = () => new Types.ObjectId();

const mkOrganization = (name: string, organizationType: OrganizationTypes) => ({
  _id: oid(),
  name,
  organizationType,
  organizationOwner: null as Types.ObjectId | null,
});

const mkUser = (role: UserRole, username: string, organization: Types.ObjectId, passwordHash: string) => {
  const sex = faker.person.sexType(); // 'male' | 'female'
  return {
    _id: oid(),
    username, // school-owner, fleet-driver1, ... (unique, readable)
    fullName: `${faker.person.firstName(sex)} ${faker.person.lastName()}`,
    email: `${username}@${CONFIG.emailDomain}`,
    passwordHash,
    gender: sex,
    age: faker.number.int({ min: 18, max: 60 }),
    language: faker.helpers.arrayElement([Language.ENGLISH, Language.ARABIC]),
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    organization,
    role,
  };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }
  const fresh = process.argv.includes('--fresh');

  faker.seed(42); // deterministic data across runs

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const organizationModel = app.get<Model<Organization>>(getModelToken(Organization.name));
  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const instructorModel = app.get<Model<Instructor>>(getModelToken(Instructor.name));

  try {
    if (fresh) {
      // only this seed's data — real accounts and seed.ts's data are left untouched
      const seededUsers = await userModel
        .find({ email: { $regex: `@${CONFIG.emailDomain.replace(/\./g, '\\.')}$` } }, { _id: 1 })
        .lean();
      const seededUserIds = seededUsers.map((user) => user._id);

      await Promise.all([
        userModel.deleteMany({ _id: { $in: seededUserIds } }),
        organizationModel.deleteMany({ organizationOwner: { $in: seededUserIds } }),
      ]);
      console.log('Cleared seeded organizations and users');
    }

    // ---------------- Organizations ----------------
    const organizations = {
      school: mkOrganization('Org Seed Driving School', OrganizationTypes.DRIVING_SCHOOL),
      fleet: mkOrganization('Org Seed Fleet Company', OrganizationTypes.FLEET_COMPANY),
      insurance: mkOrganization('Org Seed Insurance Company', OrganizationTypes.INSURANCE_COMPANY),
    };

    // ---------------- Owners + employees ----------------
    const passwordHash = await argon2.hash(CONFIG.defaultPassword);

    // the roles createOrganization and inviteEmployee give, by organization type
    const staff = Object.entries(organizations).flatMap(([key, organization]) => {
      const owner = mkUser(OWNER_ROLES[organization.organizationType], `${key}-owner`, organization._id, passwordHash);
      organization.organizationOwner = owner._id;
      const employees = Array.from({ length: CONFIG.employeesPerOrganization }, (_, i) =>
        mkUser(EMPLOYEE_ROLES[organization.organizationType], `${key}-employee${i + 1}`, organization._id, passwordHash),
      );
      return [owner, ...employees];
    });
    const instructors = staff
      .filter((user) => user.role === UserRole.DRIVER_INSTRUCTOR)
      .map((user) => ({ ...user, drivingStudents: [] as Types.ObjectId[] }));
    const otherStaff = staff.filter((user) => user.role !== UserRole.DRIVER_INSTRUCTOR);

    // ---------------- Drivers ----------------
    const learners = Array.from({ length: CONFIG.driversPerOrganization }, (_, i) =>
      mkUser(UserRole.DRIVER, `school-driver${i + 1}`, organizations.school._id, passwordHash),
    );
    const fleetDrivers = Array.from({ length: CONFIG.driversPerOrganization }, (_, i) =>
      mkUser(UserRole.DRIVER, `fleet-driver${i + 1}`, organizations.fleet._id, passwordHash),
    );
    // learners are shared out between the instructors in turn, so each one has students
    learners.forEach((learner, i) => instructors[i % instructors.length].drivingStudents.push(learner._id));
    const drivers = [...learners, ...fleetDrivers];

    await organizationModel.insertMany(Object.values(organizations));
    await userModel.insertMany([...otherStaff, ...drivers]);
    // through the discriminator model so the instructor-only field (drivingStudents) is kept
    await instructorModel.insertMany(instructors);

    // ---------------- Read back ----------------
    const inOrganization = (user: { organization: Types.ObjectId }, organizationId: Types.ObjectId) =>
      user.organization.equals(organizationId);

    const seededOrganizations = await organizationModel
      .find({ _id: { $in: Object.values(organizations).map((organization) => organization._id) } })
      .populate([
        { path: 'organizationDrivers', select: 'username' },
        { path: 'organizationEmployees', select: 'username' },
      ]);
    console.table(
      seededOrganizations.map((organization) => ({
        organization: organization.name,
        drivers: organization.organizationDrivers?.length ?? 0,
        expectedDrivers: drivers.filter((user) => inOrganization(user, organization._id)).length,
        employees: organization.organizationEmployees?.length ?? 0,
        expectedEmployees: staff.filter((user) => inOrganization(user, organization._id)).length,
      })),
    );

    // found through the Instructor model, so this also checks the discriminator stored them with the instructor role
    const seededInstructors = await instructorModel
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
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
