/**
 * Shared building blocks for the database seeds (seed.ts, seed-organizations.ts, seed-incidents.ts,
 * seed-super-admin.ts) and the integrity check (verify-seed.ts).
 *
 * Every seed goes through the same steps, so the data it leaves behind is always fully connected:
 *   1. Every id is worked out up front from a stable key (seededId), before anything is written.
 *      A dependent record carries the id its parent is inserted with, and a run gives the same ids every time.
 *   2. Without --fresh, a seed refuses to start when its data is already there, instead of failing half-way.
 *   3. The whole seed runs in one transaction, so it lands complete or not at all.
 *   4. --fresh removes the previous seeded data together with everything that points at it (deleteSeeded),
 *      including what older, random-id runs left behind.
 *   5. Before the transaction commits, every reference of the seeded records is checked (integrity.ts);
 *      a broken one rolls everything back.
 */

import { createHash } from 'node:crypto';
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Faker, en, faker } from '@faker-js/faker';
import { Model, Types } from 'mongoose';
import { IncidentSeverity, Language, UserGender, UserRole, UserStatus } from '@common/enums';
import { User } from '@modules/users/user.model';
import { Instructor } from '@modules/instructors/instructors.model';
import { Organization } from '@modules/organizations/organization.model';
import { OrganizationTypes } from '@modules/organizations/organizations.enum';
import { Trip } from '@modules/trips/trips.model';
import { TripRoutePoint } from '@modules/trips/trip-map/trip-route-point.model';
import { roundToOneDecimal } from '@modules/trips/helpers/trip-scoring';
import { Incident } from '@modules/incidents/incidents.model';
import { Notification } from '@modules/notifications/notifications.model';
import { RefreshToken } from '@modules/auth/token/refresh/token.model';
import { TransactionService } from '@shared/modules/transactions/transactions.service';
import { AppModule } from '../../app.module';
import { assertIntact } from './integrity';

// ---------------------------------------------------------------------------
// App context and models
// ---------------------------------------------------------------------------
export interface SeedModels {
  user: Model<User>;
  instructor: Model<Instructor>;
  organization: Model<Organization>;
  trip: Model<Trip>;
  routePoint: Model<TripRoutePoint>;
  incident: Model<Incident>;
  notification: Model<Notification>;
  refreshToken: Model<RefreshToken>;
}

export interface SeedContext {
  app: INestApplicationContext;
  models: SeedModels;
  transactions: TransactionService;
}

export async function bootstrap({ allowProduction = false } = {}): Promise<SeedContext> {
  if (!allowProduction && process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const models: SeedModels = {
    user: app.get(getModelToken(User.name)),
    instructor: app.get(getModelToken(Instructor.name)),
    organization: app.get(getModelToken(Organization.name)),
    trip: app.get(getModelToken(Trip.name)),
    routePoint: app.get(getModelToken(TripRoutePoint.name)),
    incident: app.get(getModelToken(Incident.name)),
    notification: app.get(getModelToken('Notification')),
    refreshToken: app.get(getModelToken(RefreshToken.name)),
  };

  // Collections and indexes have to exist before a transaction starts: creating them inside one
  // can clash with the index builds Mongoose starts at boot. init() waits for those builds.
  for (const model of Object.values(models) as Model<unknown>[]) {
    await model.init();
  }

  return { app, models, transactions: app.get(TransactionService) };
}

// ---------------------------------------------------------------------------
// Deterministic data
// ---------------------------------------------------------------------------

/** The same key always gives the same ObjectId, so a reseed keeps every id, and a dependent can't miss its parent. */
export const seededId = (key: string): Types.ObjectId =>
  new Types.ObjectId(createHash('sha256').update(`sdems-seed:${key}`).digest('hex').slice(0, 24));

/**
 * Seeds faker and anchors its dates to the start of today (UTC): runs on the same day give identical data,
 * and the dashboards' "last 30 days" views still have data on later days.
 */
export function seedFaker(seed: number): Date {
  faker.seed(seed);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  faker.setDefaultRefDate(today);
  return today;
}

/**
 * A second, separately seeded faker for incident locations and speeds, so adding them didn't shift
 * the main sequence: names, trips and scores stay what they were before.
 */
export function makeGeoFaker(seed: number): Faker {
  const geo = new Faker({ locale: [en] });
  geo.seed(seed);
  return geo;
}

// Cairo — where incidents go when the trip has no recorded route
const FALLBACK_CENTER: [number, number] = [30.0444, 31.2357];
const FALLBACK_RADIUS_KM = 10;

export function fallbackLocation(geo: Faker) {
  const [latitude, longitude] = geo.location.nearbyGPSCoordinate({
    origin: FALLBACK_CENTER,
    radius: FALLBACK_RADIUS_KM,
    isMetric: true,
  });
  return { latitude, longitude };
}

// Points lost per incident, by severity
export const POINTS_DEDUCTED: Record<IncidentSeverity, { min: number; max: number }> = {
  [IncidentSeverity.LOW]: { min: 1, max: 3 },
  [IncidentSeverity.MEDIUM]: { min: 3, max: 7 },
  [IncidentSeverity.HIGH]: { min: 7, max: 15 },
};

export const pickSeverity = (f: Faker = faker) =>
  f.helpers.weightedArrayElement([
    { weight: 6, value: IncidentSeverity.LOW },
    { weight: 3, value: IncidentSeverity.MEDIUM },
    { weight: 1, value: IncidentSeverity.HIGH },
  ]);

export const pickPointsDeducted = (severity: IncidentSeverity, f: Faker = faker) =>
  f.number.float({ ...POINTS_DEDUCTED[severity], fractionDigits: 1 });

/** The trip score rule: 100 minus the points of the trip's incidents, never below 0. */
export const scoreFor = (totalDeducted: number) => Math.max(roundToOneDecimal(100 - totalDeducted), 0);

export interface SeedUser {
  _id: Types.ObjectId;
  username: string;
  fullName: string;
  email: string;
  passwordHash: string;
  gender: UserGender;
  age: number;
  language: Language;
  status: UserStatus;
  mustChangePassword: boolean;
  organization: Types.ObjectId;
  role: UserRole;
}

/** A user whose id comes from their email, in the organization whose (already worked out) id is given. */
export function mkUser(
  role: UserRole,
  username: string,
  email: string,
  organization: Types.ObjectId,
  passwordHash: string,
): SeedUser {
  // Same faker calls in the same order as the earlier seeds, so the seeded people keep their names
  const sex = faker.person.sexType(); // 'male' | 'female'
  return {
    _id: seededId(`user:${email}`),
    username,
    fullName: `${faker.person.firstName(sex)} ${faker.person.lastName()}`,
    email,
    passwordHash,
    gender: sex === 'male' ? UserGender.MALE : UserGender.FEMALE, // the enum values are uppercase
    age: faker.number.int({ min: 18, max: 60 }),
    language: faker.helpers.arrayElement([Language.ENGLISH, Language.ARABIC]),
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
    organization,
    role,
  };
}

export interface SeedOrganization {
  _id: Types.ObjectId;
  name: string;
  organizationType: OrganizationTypes;
  organizationOwner: Types.ObjectId | null;
}

export const mkOrganization = (name: string, organizationType: OrganizationTypes): SeedOrganization => ({
  _id: seededId(`organization:${name}`),
  name,
  organizationType,
  organizationOwner: null,
});

// ---------------------------------------------------------------------------
// What a seed owns
// ---------------------------------------------------------------------------
export interface SeedScope {
  users: Types.ObjectId[];
  organizations: Types.ObjectId[];
  trips: Types.ObjectId[];
  incidents: Types.ObjectId[];
}

export const scopeSize = (scope: SeedScope) =>
  scope.users.length + scope.organizations.length + scope.trips.length + scope.incidents.length;

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const emailDomainPattern = (domain: string) => new RegExp(`@${escapeRegex(domain)}$`, 'i');

/**
 * Everything in the database that belongs to one seed: what this run is about to insert, plus whatever
 * earlier runs left, found by the seed's email domain, organization names and trip codes rather than
 * through its users alone, so data whose users are already gone is found too.
 */
export async function findSeededScope(
  models: SeedModels,
  options: { emailDomain: string; organizationNames: string[]; tripCode?: RegExp; planned: SeedScope },
): Promise<SeedScope> {
  const { emailDomain, organizationNames, tripCode, planned } = options;

  const users = (await models.user.distinct('_id', {
    $or: [{ email: emailDomainPattern(emailDomain) }, { _id: { $in: planned.users } }],
  })) as Types.ObjectId[];
  const seededUsers = new Set(users.map(String));

  // An organization with this seed's name is the seed's when its owner is seeded, unset or gone
  // (older runs inserted organizations first, so a failed run left them with an owner that was never created)
  const named = await models.organization
    .find({ name: { $in: organizationNames } }, { _id: 1, organizationOwner: 1 })
    .lean();
  const ownerIds = named.flatMap((organization) =>
    organization.organizationOwner ? [organization.organizationOwner] : [],
  );
  const existingOwners = new Set((await models.user.distinct('_id', { _id: { $in: ownerIds } })).map(String));
  const leftOver = named
    .filter(
      ({ organizationOwner: owner }) => !owner || seededUsers.has(String(owner)) || !existingOwners.has(String(owner)),
    )
    .map((organization) => organization._id);

  const organizations = (await models.organization.distinct('_id', {
    $or: [{ _id: { $in: planned.organizations } }, { organizationOwner: { $in: users } }, { _id: { $in: leftOver } }],
  })) as Types.ObjectId[];

  const tripFilters: object[] = [
    { _id: { $in: planned.trips } },
    { driver: { $in: users } },
    { organization: { $in: organizations } },
  ];
  if (tripCode) tripFilters.push({ code: tripCode });
  const trips = (await models.trip.distinct('_id', { $or: tripFilters })) as Types.ObjectId[];

  const incidents = (await models.incident.distinct('_id', {
    $or: [{ _id: { $in: planned.incidents } }, { trip: { $in: trips } }, { driver: { $in: users } }],
  })) as Types.ObjectId[];

  return { users, organizations, trips, incidents };
}

/** Without --fresh, existing seeded data stops the seed before anything is written. */
export function assertCanSeed(existing: SeedScope, fresh: boolean) {
  if (fresh || scopeSize(existing) === 0) return;
  const { users, organizations, trips, incidents } = existing;
  throw new Error(
    `Seeded data is already there (${users.length} users, ${organizations.length} organizations, ` +
      `${trips.length} trips, ${incidents.length} incidents). Run the :fresh script to replace it.`,
  );
}

/**
 * Seeded organizations can only be replaced when nobody else is in them: removing one would leave a real
 * user pointing at nothing, and removing that user would delete real data. So the seed stops and says who.
 */
export async function assertNoForeignMembers(models: SeedModels, scope: SeedScope) {
  const foreign = await models.user
    .find(
      { organization: { $in: scope.organizations }, _id: { $nin: scope.users } },
      { email: 1, role: 1, organization: 1 },
    )
    .lean();
  if (foreign.length === 0) return;
  console.table(
    foreign.map((user) => ({ email: user.email, role: user.role, organization: String(user.organization) })),
  );
  throw new Error(
    `${foreign.length} non-seeded user(s) belong to seeded organizations (listed above). ` +
      'Move them to another organization, or remove them, before replacing the seeded data.',
  );
}

/**
 * Removes a seed's data and everything that points at it, children before parents, so no step ever
 * leaves a reference to something already deleted. Runs one operation at a time: a transaction
 * can't run operations in parallel.
 */
export async function deleteSeeded(models: SeedModels, scope: SeedScope) {
  const { users, organizations, trips, incidents } = scope;
  const removed = {
    notifications: (
      await models.notification.deleteMany({
        $or: [{ recipient: { $in: users } }, { trip: { $in: trips } }, { incident: { $in: incidents } }],
      })
    ).deletedCount,
    incidents: (await models.incident.deleteMany({ _id: { $in: incidents } })).deletedCount,
    routePoints: (await models.routePoint.deleteMany({ trip: { $in: trips } })).deletedCount,
    trips: (await models.trip.deleteMany({ _id: { $in: trips } })).deletedCount,
    refreshTokens: (await models.refreshToken.deleteMany({ userId: { $in: users } })).deletedCount,
    // other instructors may have been given seeded drivers as students (assignStudent)
    studentLinks: (
      await models.instructor.updateMany(
        { _id: { $nin: users }, drivingStudents: { $in: users } },
        { $pull: { drivingStudents: { $in: users } } },
      )
    ).modifiedCount,
    users: (await models.user.deleteMany({ _id: { $in: users } })).deletedCount,
    organizations: (await models.organization.deleteMany({ _id: { $in: organizations } })).deletedCount,
  };
  return removed;
}

/**
 * Inserts organizations and their people the way createOrganization does: the organization first,
 * without an owner, then the users who point at it, then the owner is set. In one transaction, so no
 * moment is ever committed with an owner or an organization missing.
 */
export async function insertOrganizationsAndUsers(
  models: SeedModels,
  data: {
    organizations: SeedOrganization[];
    users: SeedUser[];
    instructors: (SeedUser & { drivingStudents: Types.ObjectId[] })[];
  },
) {
  await models.organization.insertMany(
    data.organizations.map((organization) => ({ ...organization, organizationOwner: null })),
  );
  if (data.users.length) await models.user.insertMany(data.users);
  // through the discriminator model so the instructor-only field (drivingStudents) is kept
  if (data.instructors.length) await models.instructor.insertMany(data.instructors);
  for (const organization of data.organizations) {
    if (!organization.organizationOwner) continue;
    await models.organization.updateOne(
      { _id: organization._id },
      { $set: { organizationOwner: organization.organizationOwner } },
    );
  }
}

/**
 * Runs a seed's writes: in one transaction, after --fresh's cleanup, and checked before it commits.
 * `write` may run more than once (the driver retries transient transaction errors), so it only inserts
 * data that was fully built beforehand.
 */
export async function runSeedTransaction<T>(
  { models, transactions }: SeedContext,
  options: { fresh: boolean; existing: SeedScope; seeded: SeedScope },
  write: () => Promise<T>,
) {
  return transactions.run(async () => {
    const removed = options.fresh ? await deleteSeeded(models, options.existing) : null;
    const result = await write();
    await assertIntact(models, options.seeded);
    return { removed, result };
  });
}
