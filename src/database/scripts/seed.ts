/**
 * Database seed — Driver Monitoring & Evaluation API
 *
 * Usage (runs through the Nest build — do NOT run with `bun file.ts`,
 * Bun's ESM loader breaks on decorator metadata referencing mongoose types):
 *   bun run seed          # nest build && node dist/database/scripts/seed.js
 *   bun run seed:fresh    # same, with --fresh (wipes previously seeded data first)
 *
 * Seeds: organizations, users (instructors, analysts, drivers), trips with their GPS route and motion readings, incidents.
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
import { TripRoutePoint } from '@modules/trips/trip-route-point.model';
import { roundToOneDecimal, scoreForDeductions } from '@modules/trips/trip-scoring';
import { haversineKm } from '@modules/trips/trip-stats';
import { Incident } from '@modules/incidents/incidents.model';
import { Gender, IncidentSeverity, IncidentType, Language, TripStatus, UserRole, UserStatus } from '@common/enums';
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
  sampleEverySeconds: 5, // one GPS fix and one motion reading every 5 s
  defaultPassword: 'Password123!',
  emailDomain: 'sdems.dev', // used to identify (and clean up) seeded users, and the organizations they own
  firstTripCode: 90000, // seeded trips get T-90000, T-90001, ... to stay clear of real codes
  origin: { latitude: 31.2001, longitude: 29.9187 }, // Alexandria; routes start somewhere around it
};

// Points lost per incident, by severity
const POINTS_DEDUCTED: Record<IncidentSeverity, { min: number; max: number }> = {
  [IncidentSeverity.LOW]: { min: 1, max: 3 },
  [IncidentSeverity.MEDIUM]: { min: 3, max: 7 },
  [IncidentSeverity.HIGH]: { min: 7, max: 15 },
};

const KM_PER_DEGREE_LATITUDE = 111.32;

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const oid = () => new Types.ObjectId();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mkUser = (role: UserRole, email: string, organization: Types.ObjectId, passwordHash: string) => {
  const gender = faker.helpers.enumValue(Gender);
  return {
    _id: oid(),
    username: email.split('@')[0], // instructor1, driver1, ... (unique, readable)
    fullName: `${faker.person.firstName(gender)} ${faker.person.lastName()}`,
    email,
    passwordHash,
    gender,
    age: faker.number.int({ min: 18, max: 60 }),
    language: faker.helpers.arrayElement([Language.ENGLISH, Language.ARABIC]),
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    organization,
    role,
  };
};

const mkVehicle = () => `${faker.vehicle.manufacturer()} ${faker.vehicle.model()} (${faker.vehicle.vrm()})`;

type Sample = { recordedAt: Date; latitude: number; longitude: number; speedKmh: number; headingDeg: number; accelerationMs2: number; steeringAngleDeg: number };

// A drive as a random walk: speed drifts around the limit, the heading turns gradually, and the position follows both
function mkDrive(startedAt: Date, durationSeconds: number, speedLimitKmh: number): Sample[] {
  const samples: Sample[] = [];
  let latitude = CONFIG.origin.latitude + faker.number.float({ min: -0.05, max: 0.05 });
  let longitude = CONFIG.origin.longitude + faker.number.float({ min: -0.05, max: 0.05 });
  let speedKmh = 0;
  let headingDeg = faker.number.float({ min: 0, max: 360 });
  let steeringAngleDeg = 0;

  for (let t = 0; t <= durationSeconds; t += CONFIG.sampleEverySeconds) {
    const previousSpeed = speedKmh;
    const target = speedLimitKmh * faker.number.float({ min: 0.6, max: 1.15 });
    speedKmh = clamp(speedKmh + (target - speedKmh) * 0.2 + faker.number.float({ min: -6, max: 6 }), 0, speedLimitKmh + 35);
    steeringAngleDeg = clamp(steeringAngleDeg * 0.6 + faker.number.float({ min: -40, max: 40 }), -540, 540);
    headingDeg = (headingDeg + steeringAngleDeg / 30 + 360) % 360;

    const km = (speedKmh * CONFIG.sampleEverySeconds) / 3600;
    const heading = (headingDeg * Math.PI) / 180;
    latitude += (km * Math.cos(heading)) / KM_PER_DEGREE_LATITUDE;
    longitude += (km * Math.sin(heading)) / (KM_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180));

    samples.push({
      recordedAt: new Date(startedAt.getTime() + t * 1000),
      latitude: Math.round(latitude * 1e6) / 1e6,
      longitude: Math.round(longitude * 1e6) / 1e6,
      speedKmh: roundToOneDecimal(speedKmh),
      headingDeg: Math.round(headingDeg),
      accelerationMs2: Math.round(((speedKmh - previousSpeed) / 3.6 / CONFIG.sampleEverySeconds) * 100) / 100,
      steeringAngleDeg: roundToOneDecimal(steeringAngleDeg),
    });
  }
  return samples;
}

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
  const routePointModel = app.get<Model<TripRoutePoint>>(getModelToken(TripRoutePoint.name));
  const incidentModel = app.get<Model<Incident>>(getModelToken(Incident.name));

  try {
    if (fresh) {
      // only seeded data — real accounts and their trips are left untouched
      const seededUsers = await userModel
        .find({ email: { $regex: `@${CONFIG.emailDomain.replace(/\./g, '\\.')}$` } }, { _id: 1 })
        .lean();
      const seededUserIds = seededUsers.map((user) => user._id);
      const seededTripIds = (await tripModel.find({ driver: { $in: seededUserIds } }, { _id: 1 }).lean()).map((trip) => trip._id);

      await Promise.all([
        routePointModel.deleteMany({ trip: { $in: seededTripIds } }),
        tripModel.deleteMany({ _id: { $in: seededTripIds } }),
        incidentModel.deleteMany({ driver: { $in: seededUserIds } }),
        userModel.deleteMany({ _id: { $in: seededUserIds } }),
        organizationModel.deleteMany({ organizationOwner: { $in: seededUserIds } }),
      ]);
      console.log('Cleared seeded organizations, users, trips, routes and incidents');
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

    // ---------------- Trips (with their motion readings), routes, incidents ----------------
    const trips: Record<string, unknown>[] = [];
    const routePoints: Record<string, unknown>[] = [];
    const incidents: Record<string, unknown>[] = [];
    let motionReadings = 0;
    let nextTripCode = CONFIG.firstTripCode;

    for (const driver of drivers) {
      const vehicle = mkVehicle();
      const tripCount = faker.number.int(CONFIG.tripsPerDriver);

      for (let t = 0; t < tripCount; t++) {
        const tripId = oid();
        const startedAt = faker.date.recent({ days: 60 });
        const durationSeconds = faker.number.int({ min: 10 * 60, max: 90 * 60 });
        const speedLimitKmh = faker.helpers.arrayElement([60, 80, 100]);
        const drive = mkDrive(startedAt, durationSeconds, speedLimitKmh);

        let distanceKm = 0;
        for (let i = 1; i < drive.length; i++) distanceKm += haversineKm(drive[i - 1], drive[i]);
        distanceKm = Math.round(distanceKm * 100) / 100;

        // the motion graphs' readings live on the trip itself, timed in ISO 8601 like the uploaded ones
        const tripSpeeds: { time: string; speed: number }[] = [];
        const tripAccelerations: { time: string; acceleration: number }[] = [];
        const steeringWheelAngle: { time: string; steeringWheelAngle: number }[] = [];
        for (const { recordedAt, latitude, longitude, speedKmh, headingDeg, accelerationMs2, steeringAngleDeg } of drive) {
          routePoints.push({ trip: tripId, recordedAt, latitude, longitude, speedKmh, speedLimitKmh: null, headingDeg });
          const time = recordedAt.toISOString();
          tripSpeeds.push({ time, speed: speedKmh });
          tripAccelerations.push({ time, acceleration: accelerationMs2 });
          steeringWheelAngle.push({ time, steeringWheelAngle: steeringAngleDeg });
        }
        motionReadings += drive.length;

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
          // placed on the route where it happened, at the speed the car had there
          const at = faker.helpers.arrayElement(drive);

          incidents.push({
            _id: oid(),
            trip: tripId,
            driver: driver._id,
            type: faker.helpers.enumValue(IncidentType),
            severity,
            occurredAt: new Date(at.recordedAt.getTime() + faker.number.int({ min: 0, max: CONFIG.sampleEverySeconds * 1000 - 1 })),
            location: { latitude: at.latitude, longitude: at.longitude },
            speedKmh: at.speedKmh,
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
          averageSpeedKmh: roundToOneDecimal(distanceKm / (durationSeconds / 3600)),
          topSpeedKmh: Math.max(...drive.map((sample) => sample.speedKmh)),
          eventsCount: incidentCount,
          score: scoreForDeductions(totalDeducted),
          tripSpeeds,
          tripAccelerations,
          steeringWheelAngle,
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
    await routePointModel.insertMany(routePoints);
    await incidentModel.insertMany(incidents);

    console.table({
      organizations: 2,
      users: instructors.length + analysts.length + drivers.length,
      trips: trips.length,
      routePoints: routePoints.length,
      motionReadings,
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
