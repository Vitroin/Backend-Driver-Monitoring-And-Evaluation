/**
 * Database seed — Driver Monitoring & Evaluation API
 *
 * Usage (runs through the Nest build — do NOT run with `bun file.ts`,
 * Bun's ESM loader breaks on decorator metadata referencing mongoose types):
 *   bun run seed          # nest build && node dist/database/scripts/seed.js
 *   bun run seed:fresh    # same, with --fresh (replaces previously seeded data)
 *
 * Seeds: organizations, users (instructors, analysts, drivers), trips, incidents.
 * The super admin is not seeded here — use `bun run seed:super-admin`.
 *
 * Every record that points at another one carries the id its parent is inserted with: all ids are worked
 * out up front from stable keys, so the same run gives the same ids every time. Everything is written in
 * one transaction and checked before it commits (see ../seed/seed-kit.ts).
 */

import { Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import * as argon2 from 'argon2';
import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { roundToOneDecimal } from '@modules/trips/helpers/trip-scoring';
import { IncidentType, TripStatus, UserRole } from '@common/enums';
import {
  assertCanSeed,
  assertNoForeignMembers,
  bootstrap,
  fallbackLocation,
  findSeededScope,
  insertOrganizationsAndUsers,
  makeGeoFaker,
  mkOrganization,
  mkUser,
  pickPointsDeducted,
  pickSeverity,
  runSeedTransaction,
  scoreFor,
  seededId,
  seedFaker,
  SeedScope,
  SeedUser,
} from '../seed/seed-kit';

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
  emailDomain: 'sdems.dev', // identifies seeded users, and through them the rest of the seeded data
  organizations: { school: 'Seed Driving School', fleet: 'Seed Fleet Company' },
  firstTripCode: 90000, // seeded trips get T-90000, T-90001, ... to stay clear of real codes
  fakerSeed: 42,
  geoSeed: 4242, // incident locations and speeds come from their own sequence (see makeGeoFaker)
};
// Also finds trips that older, random-id runs left behind
const SEEDED_TRIP_CODE = /^T-9\d{4}$/;

const mkVehicle = () => `${faker.vehicle.manufacturer()} ${faker.vehicle.model()} (${faker.vehicle.vrm()})`;

// ---------------------------------------------------------------------------
// Plan: every document, with every id, before anything is written
// ---------------------------------------------------------------------------
function buildPlan(passwordHash: string) {
  const geo = makeGeoFaker(CONFIG.geoSeed);

  // ---------------- Organizations ----------------
  const school = mkOrganization(CONFIG.organizations.school, OrganizationTypes.DRIVING_SCHOOL);
  const fleet = mkOrganization(CONFIG.organizations.fleet, OrganizationTypes.FLEET_COMPANY);

  // ---------------- Users ----------------
  const instructors = Array.from({ length: CONFIG.instructors }, (_, i) => {
    const email = `instructor${i + 1}@${CONFIG.emailDomain}`;
    return {
      ...mkUser(UserRole.DRIVER_INSTRUCTOR, email.split('@')[0], email, school._id, passwordHash),
      drivingStudents: [] as Types.ObjectId[],
    };
  });
  const analysts = Array.from({ length: CONFIG.analysts }, (_, i) => {
    const email = `analyst${i + 1}@${CONFIG.emailDomain}`;
    return mkUser(UserRole.FLEET_ANALYST, email.split('@')[0], email, fleet._id, passwordHash);
  });
  // Kept as before: the first instructor owns the school and the first analyst the fleet company
  // (OWNER_ROLES would make them a school administrator and a fleet manager; the integrity check warns about it)
  school.organizationOwner = instructors[0]._id;
  fleet.organizationOwner = analysts[0]._id;

  // half the drivers are learners (driving school, taught by an instructor), half are employees (fleet)
  const drivers: SeedUser[] = Array.from({ length: CONFIG.drivers }, (_, i) => {
    const isLearner = i % 2 === 0;
    const email = `driver${i + 1}@${CONFIG.emailDomain}`;
    const driver = mkUser(
      UserRole.DRIVER,
      email.split('@')[0],
      email,
      isLearner ? school._id : fleet._id,
      passwordHash,
    );
    // an instructor of the learner's own organization, so the student link stays inside the school
    if (isLearner) faker.helpers.arrayElement(instructors).drivingStudents.push(driver._id);
    return driver;
  });

  // ---------------- Trips + Incidents ----------------
  const trips: Record<string, unknown>[] = [];
  const incidents: Record<string, unknown>[] = [];
  let nextTripCode = CONFIG.firstTripCode;

  for (const driver of drivers) {
    const vehicle = mkVehicle();
    const tripCount = faker.number.int(CONFIG.tripsPerDriver);

    for (let t = 0; t < tripCount; t++) {
      const code = `T-${nextTripCode++}`;
      const tripId = seededId(`trip:${code}`);
      const startedAt = faker.date.recent({ days: 60 });
      const durationSeconds = faker.number.int({ min: 10 * 60, max: 90 * 60 });
      const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
      const speedLimitKmh = faker.helpers.arrayElement([60, 80, 100]);
      const averageSpeedKmh = faker.number.int({ min: 25, max: speedLimitKmh - 10 });
      const distanceKm = roundToOneDecimal((durationSeconds / 3600) * averageSpeedKmh);

      const incidentCount = faker.number.int(CONFIG.incidentsPerTrip);
      let totalDeducted = 0;

      for (let n = 0; n < incidentCount; n++) {
        const severity = pickSeverity();
        const pointsDeducted = pickPointsDeducted(severity);
        totalDeducted += pointsDeducted;
        const type = faker.helpers.enumValue(IncidentType);

        incidents.push({
          _id: seededId(`incident:${code}#${n}`),
          trip: tripId, // the trip inserted below
          driver: driver._id, // the trip's own driver, as Incident.driver requires
          type,
          severity,
          occurredAt: faker.date.between({ from: startedAt, to: endedAt }),
          // no recorded route for seeded trips, so incidents are placed near Cairo to show on the trip map
          location: fallbackLocation(geo),
          // a speeding event is above the trip's limit, or the report contradicts itself
          speedKmh:
            type === IncidentType.SPEEDING
              ? geo.number.int({ min: speedLimitKmh + 5, max: speedLimitKmh + 40 })
              : geo.number.int({ min: 20, max: speedLimitKmh }),
          clipUrl: null,
          clipPublicId: null,
          pointsDeducted,
        });
      }

      trips.push({
        _id: tripId,
        code,
        driver: driver._id,
        organization: driver.organization, // copied from the driver, as Trip.organization requires
        vehicle,
        status: TripStatus.COMPLETED,
        startedAt,
        speedLimitKmh,
        durationSeconds,
        distanceKm,
        averageSpeedKmh,
        topSpeedKmh: faker.number.int({ min: speedLimitKmh - 5, max: speedLimitKmh + 30 }),
        eventsCount: incidentCount,
        score: scoreFor(totalDeducted),
      });
    }

    // one upcoming trip per driver: measurements and score stay null until it's processed
    const code = `T-${nextTripCode++}`;
    trips.push({
      _id: seededId(`trip:${code}`),
      code,
      driver: driver._id,
      organization: driver.organization,
      vehicle,
      status: TripStatus.PLANNED,
      startedAt: faker.date.soon({ days: 7 }),
      speedLimitKmh: faker.helpers.arrayElement([60, 80, 100]),
    });
  }

  const organizations = [school, fleet];
  const users = [...analysts, ...drivers];
  const scope: SeedScope = {
    users: [...users, ...instructors].map((user) => user._id),
    organizations: organizations.map((organization) => organization._id),
    trips: trips.map((trip) => trip._id as Types.ObjectId),
    incidents: incidents.map((incident) => incident._id as Types.ObjectId),
  };
  return { organizations, users, instructors, trips, incidents, scope };
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
      tripCode: SEEDED_TRIP_CODE,
      planned: plan.scope,
    });
    assertCanSeed(existing, fresh);
    await assertNoForeignMembers(models, existing);

    const { removed } = await runSeedTransaction(context, { fresh, existing, seeded: plan.scope }, async () => {
      await insertOrganizationsAndUsers(models, plan); // organizations, then users, then owners
      await models.trip.insertMany(plan.trips); // then trips, which point at both
      await models.incident.insertMany(plan.incidents); // then incidents, which point at trips and drivers
    });

    if (removed) {
      console.log('Replaced the previously seeded data:');
      console.table(removed);
    }
    console.table({
      organizations: plan.organizations.length,
      users: plan.users.length + plan.instructors.length,
      trips: plan.trips.length,
      incidents: plan.incidents.length,
    });
    console.log('Every seeded reference checked: no orphans.');
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
