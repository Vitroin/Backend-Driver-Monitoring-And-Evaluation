/**
 * Database seed — Driver Monitoring & Evaluation API
 *
 * Usage (runs through the Nest build — do NOT run with `bun file.ts`,
 * Bun's ESM loader breaks on decorator metadata referencing mongoose types):
 *   bun run seed          # nest build && node dist/database/scripts/seed.js
 *   bun run seed:fresh    # same, with --fresh (wipes previously seeded data first)
 *
 * Seeds: organizations, users (instructors, analysts, drivers), trips, incidents.
 * The super admin is not seeded here — use `bun run seed:super-admin`.
 */

import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';
import { User } from '@modules/users/user.model';
import { Instructor } from '@modules/instructors/instructors.model';
import { Organization } from '@modules/organizations/organization.model';
import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { Trip } from '@modules/trips/trips.model';
import { roundToOneDecimal } from '@modules/trips/trip-scoring';
import { Incident } from '@modules/incidents/incidents.model';
import { IncidentSeverity, IncidentType, Language, TripStatus, UserRole, UserStatus } from '@common/enums';
import { AppModule } from '../../app.module';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CONFIG = {
  instructors: 2,
  analysts: 2,
  drivers: 8,
  tripsPerDriver: { min: 3, max: 6 },
  incidentsPerTrip: { min: 0, max: 8 },
  defaultPassword: 'Password123!',
  emailDomain: 'sdems.dev', // used to identify (and clean up) seeded users, and the organizations they own
  firstTripCode: 90000, // seeded trips get T-90000, T-90001, ... to stay clear of real codes
};

// Points lost per incident, by severity
const POINTS_DEDUCTED: Record<IncidentSeverity, { min: number; max: number }> = {
  [IncidentSeverity.LOW]: { min: 1, max: 3 },
  [IncidentSeverity.MEDIUM]: { min: 3, max: 7 },
  [IncidentSeverity.HIGH]: { min: 7, max: 15 },
};

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const oid = () => new Types.ObjectId();

const mkUser = (role: UserRole, email: string, organization: Types.ObjectId, passwordHash: string) => {
  const sex = faker.person.sexType(); // 'male' | 'female'
  return {
    _id: oid(),
    username: email.split('@')[0], // instructor1, driver1, ... (unique, readable)
    fullName: `${faker.person.firstName(sex)} ${faker.person.lastName()}`,
    email,
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

const mkVehicle = () => `${faker.vehicle.manufacturer()} ${faker.vehicle.model()} (${faker.vehicle.vrm()})`;

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
  const tripModel = app.get<Model<Trip>>(getModelToken(Trip.name));
  const incidentModel = app.get<Model<Incident>>(getModelToken(Incident.name));

  try {
    if (fresh) {
      // only seeded data — real accounts and their trips are left untouched
      const seededUsers = await userModel
        .find({ email: { $regex: `@${CONFIG.emailDomain.replace(/\./g, '\\.')}$` } }, { _id: 1 })
        .lean();
      const seededUserIds = seededUsers.map((user) => user._id);

      await Promise.all([
        tripModel.deleteMany({ driver: { $in: seededUserIds } }),
        incidentModel.deleteMany({ driver: { $in: seededUserIds } }),
        userModel.deleteMany({ _id: { $in: seededUserIds } }),
        organizationModel.deleteMany({ organizationOwner: { $in: seededUserIds } }),
      ]);
      console.log('Cleared seeded organizations, users, trips and incidents');
    }

    // ---------------- Organizations ----------------
    const school = {
      _id: oid(),
      name: 'Seed Driving School',
      organizationType: OrganizationTypes.DRIVING_SCHOOL,
      organizationOwner: null as Types.ObjectId | null,
    };
    const fleet = {
      _id: oid(),
      name: 'Seed Fleet Company',
      organizationType: OrganizationTypes.FLEET_COMPANY,
      organizationOwner: null as Types.ObjectId | null,
    };

    // ---------------- Users ----------------
    const passwordHash = await argon2.hash(CONFIG.defaultPassword);

    const instructors = Array.from({ length: CONFIG.instructors }, (_, i) => ({
      ...mkUser(UserRole.DRIVER_INSTRUCTOR, `instructor${i + 1}@${CONFIG.emailDomain}`, school._id, passwordHash),
      drivingStudents: [] as Types.ObjectId[],
    }));
    const analysts = Array.from({ length: CONFIG.analysts }, (_, i) =>
      mkUser(UserRole.FLEET_ANALYST, `analyst${i + 1}@${CONFIG.emailDomain}`, fleet._id, passwordHash),
    );
    school.organizationOwner = instructors[0]._id;
    fleet.organizationOwner = analysts[0]._id;

    // half the drivers are learners (driving school, taught by an instructor), half are employees (fleet)
    const drivers = Array.from({ length: CONFIG.drivers }, (_, i) => {
      const isLearner = i % 2 === 0;
      const driver = mkUser(UserRole.DRIVER, `driver${i + 1}@${CONFIG.emailDomain}`, isLearner ? school._id : fleet._id, passwordHash);
      if (isLearner) faker.helpers.arrayElement(instructors).drivingStudents.push(driver._id);
      return driver;
    });

    await organizationModel.insertMany([school, fleet]);
    await userModel.insertMany([...analysts, ...drivers]);
    // through the discriminator model so the instructor-only field (drivingStudents) is kept
    await instructorModel.insertMany(instructors);

    // ---------------- Trips + Incidents ----------------
    const trips: Record<string, unknown>[] = [];
    const incidents: Record<string, unknown>[] = [];
    let nextTripCode = CONFIG.firstTripCode;

    for (const driver of drivers) {
      const vehicle = mkVehicle();
      const tripCount = faker.number.int(CONFIG.tripsPerDriver);

      for (let t = 0; t < tripCount; t++) {
        const tripId = oid();
        const startedAt = faker.date.recent({ days: 60 });
        const durationSeconds = faker.number.int({ min: 10 * 60, max: 90 * 60 });
        const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
        const speedLimitKmh = faker.helpers.arrayElement([60, 80, 100]);
        const averageSpeedKmh = faker.number.int({ min: 25, max: speedLimitKmh - 10 });
        const distanceKm = roundToOneDecimal((durationSeconds / 3600) * averageSpeedKmh);

        const incidentCount = faker.number.int(CONFIG.incidentsPerTrip);
        let totalDeducted = 0;

        for (let n = 0; n < incidentCount; n++) {
          const severity = faker.helpers.weightedArrayElement([
            { weight: 6, value: IncidentSeverity.LOW },
            { weight: 3, value: IncidentSeverity.MEDIUM },
            { weight: 1, value: IncidentSeverity.HIGH },
          ]);
          const pointsDeducted = faker.number.float({ ...POINTS_DEDUCTED[severity], fractionDigits: 1 });
          totalDeducted += pointsDeducted;

          incidents.push({
            _id: oid(),
            trip: tripId,
            driver: driver._id,
            type: faker.helpers.enumValue(IncidentType),
            severity,
            occurredAt: faker.date.between({ from: startedAt, to: endedAt }),
            clipUrl: null,
            clipPublicId: null,
            pointsDeducted,
          });
        }

        trips.push({
          _id: tripId,
          code: `T-${nextTripCode++}`,
          driver: driver._id,
          organization: driver.organization,
          vehicle,
          status: TripStatus.COMPLETED,
          startedAt,
          speedLimitKmh,
          durationSeconds,
          distanceKm,
          averageSpeedKmh,
          topSpeedKmh: faker.number.int({ min: speedLimitKmh - 5, max: speedLimitKmh + 30 }),
          eventsCount: incidentCount,
          score: Math.max(roundToOneDecimal(100 - totalDeducted), 0),
        });
      }

      // one upcoming trip per driver: measurements and score stay null until it's processed
      trips.push({
        _id: oid(),
        code: `T-${nextTripCode++}`,
        driver: driver._id,
        organization: driver.organization,
        vehicle,
        status: TripStatus.PLANNED,
        startedAt: faker.date.soon({ days: 7 }),
        speedLimitKmh: faker.helpers.arrayElement([60, 80, 100]),
      });
    }

    await tripModel.insertMany(trips);
    await incidentModel.insertMany(incidents);

    console.table({
      organizations: 2,
      users: instructors.length + analysts.length + drivers.length,
      trips: trips.length,
      incidents: incidents.length,
    });
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
