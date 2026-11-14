/**
 * Referential integrity checks for every reference in the schema, and the rules that tie them together.
 * Used by every seed before it commits (scoped to what it seeded) and by verify-seed.ts (the whole database).
 *
 *   users.organization            → organizations           (every role but super_admin needs one)
 *   organizations.owner           → users, a member of that organization, with the OWNER_ROLES role (warning)
 *   instructors.drivingStudents   → users: drivers of the instructor's organization
 *   trips.driver                  → users: a driver
 *   trips.organization            → organizations: the driver's organization
 *   incidents.trip / .driver      → trips / users: the trip's driver, on a completed trip
 *   trips.eventsCount / .score    ↔ the trip's incidents
 *   trippoints.trip               → trips
 *   notifications.recipient/trip/incident → users / trips / incidents, the incident on that trip
 *   refreshtokens.userId          → users
 */

import type { Model, PipelineStage, Types } from 'mongoose';
import { TripStatus, UserRole } from '@common/enums';
import { OWNER_ROLES } from '@modules/organizations/organizations.enum';
import type { SeedModels, SeedScope } from './seed-kit';

export interface IntegrityProblem {
  check: string;
  level: 'error' | 'warning';
  count: number;
  samples: string[];
}

// Trip scores are stored rounded to one decimal; a smaller difference is rounding, not a mismatch
const SCORE_TOLERANCE = 0.05;

/** $lookup by _id, as one document (missing when nothing matches) instead of an array. */
const lookupOne = (from: string, localField: string, as: string): PipelineStage[] => [
  { $lookup: { from, localField, foreignField: '_id', as } },
  { $set: { [as]: { $first: `$${as}` } } },
];

interface Check {
  check: string;
  level: 'error' | 'warning';
  model: Model<any>;
  pipeline: PipelineStage[];
}

/**
 * Returns every broken reference. With a scope, only the scope's records are checked
 * (what a seed is about to commit); without one, the whole database.
 */
export async function verifyIntegrity(models: SeedModels, scope?: SeedScope): Promise<IntegrityProblem[]> {
  const collections = {
    users: models.user.collection.collectionName,
    organizations: models.organization.collection.collectionName,
    trips: models.trip.collection.collectionName,
    incidents: models.incident.collection.collectionName,
  };
  // With a scope, start from the scope's records only
  const only = (field: string, ids: (s: SeedScope) => Types.ObjectId[]): PipelineStage[] =>
    scope ? [{ $match: { [field]: { $in: ids(scope) } } }] : [];

  const ownerRole = {
    $switch: {
      branches: Object.entries(OWNER_ROLES).map(([type, role]) => ({ case: { $eq: ['$organizationType', type] }, then: role })),
      default: null,
    },
  };

  const checks: Check[] = [
    // ---------------- users ----------------
    {
      check: 'users.organization → organizations',
      level: 'error',
      model: models.user,
      pipeline: [
        ...only('_id', (s) => s.users),
        { $match: { organization: { $ne: null } } },
        ...lookupOne(collections.organizations, 'organization', 'org'),
        { $match: { org: null } },
      ],
    },
    {
      check: 'user without an organization (only super_admin may have none)',
      level: 'error',
      model: models.user,
      pipeline: [...only('_id', (s) => s.users), { $match: { role: { $ne: UserRole.SUPER_ADMIN }, organization: null } }],
    },

    // ---------------- organizations ----------------
    {
      check: 'organizations.organizationOwner → users',
      level: 'error',
      model: models.organization,
      pipeline: [
        ...only('_id', (s) => s.organizations),
        { $match: { organizationOwner: { $ne: null } } },
        ...lookupOne(collections.users, 'organizationOwner', 'owner'),
        { $match: { owner: null } },
      ],
    },
    {
      check: 'organization owner is a member of another organization',
      level: 'error',
      model: models.organization,
      pipeline: [
        ...only('_id', (s) => s.organizations),
        { $match: { organizationOwner: { $ne: null } } },
        ...lookupOne(collections.users, 'organizationOwner', 'owner'),
        { $match: { owner: { $ne: null }, $expr: { $ne: ['$owner.organization', '$_id'] } } },
      ],
    },
    {
      check: "organization owner's role is not the OWNER_ROLES role for its type",
      level: 'warning',
      model: models.organization,
      pipeline: [
        ...only('_id', (s) => s.organizations),
        { $match: { organizationOwner: { $ne: null } } },
        ...lookupOne(collections.users, 'organizationOwner', 'owner'),
        { $match: { owner: { $ne: null }, $expr: { $ne: ['$owner.role', ownerRole] } } },
      ],
    },

    // ---------------- instructors ----------------
    {
      check: "instructors.drivingStudents → drivers of the instructor's organization",
      level: 'error',
      // the discriminator model only reads instructors
      model: models.instructor,
      pipeline: [
        ...only('_id', (s) => s.users),
        { $unwind: '$drivingStudents' },
        ...lookupOne(collections.users, 'drivingStudents', 'student'),
        {
          $match: {
            $or: [
              { student: null },
              { 'student.role': { $ne: UserRole.DRIVER } },
              { $expr: { $ne: ['$student.organization', '$organization'] } },
            ],
          },
        },
      ],
    },

    // ---------------- trips ----------------
    {
      check: 'trips.driver → users (role driver)',
      level: 'error',
      model: models.trip,
      pipeline: [
        ...only('_id', (s) => s.trips),
        ...lookupOne(collections.users, 'driver', 'd'),
        { $match: { $or: [{ d: null }, { 'd.role': { $ne: UserRole.DRIVER } }] } },
      ],
    },
    {
      check: 'trips.organization → organizations',
      level: 'error',
      model: models.trip,
      pipeline: [
        ...only('_id', (s) => s.trips),
        ...lookupOne(collections.organizations, 'organization', 'org'),
        { $match: { org: null } },
      ],
    },
    {
      check: "trip organization differs from its driver's organization",
      level: 'error',
      model: models.trip,
      pipeline: [
        ...only('_id', (s) => s.trips),
        ...lookupOne(collections.users, 'driver', 'd'),
        { $match: { d: { $ne: null }, $expr: { $ne: ['$organization', '$d.organization'] } } },
      ],
    },
    {
      check: 'trip eventsCount / score do not match its incidents',
      level: 'error',
      model: models.trip,
      pipeline: [
        ...only('_id', (s) => s.trips),
        { $match: { status: TripStatus.COMPLETED, eventsCount: { $ne: null } } },
        { $lookup: { from: collections.incidents, localField: '_id', foreignField: 'trip', as: 'inc' } },
        {
          $set: {
            count: { $size: '$inc' },
            expectedScore: { $max: [{ $round: [{ $subtract: [100, { $sum: '$inc.pointsDeducted' }] }, 1] }, 0] },
          },
        },
        {
          $match: {
            $expr: {
              $or: [
                { $ne: ['$eventsCount', '$count'] },
                { $gt: [{ $abs: { $subtract: [{ $ifNull: ['$score', -1] }, '$expectedScore'] } }, SCORE_TOLERANCE] },
              ],
            },
          },
        },
      ],
    },

    // ---------------- incidents ----------------
    {
      check: 'incidents.trip → trips',
      level: 'error',
      model: models.incident,
      pipeline: [...only('_id', (s) => s.incidents), ...lookupOne(collections.trips, 'trip', 't'), { $match: { t: null } }],
    },
    {
      check: 'incidents.driver → users',
      level: 'error',
      model: models.incident,
      pipeline: [...only('_id', (s) => s.incidents), ...lookupOne(collections.users, 'driver', 'd'), { $match: { d: null } }],
    },
    {
      check: "incident driver differs from its trip's driver",
      level: 'error',
      model: models.incident,
      pipeline: [
        ...only('_id', (s) => s.incidents),
        ...lookupOne(collections.trips, 'trip', 't'),
        { $match: { t: { $ne: null }, $expr: { $ne: ['$driver', '$t.driver'] } } },
      ],
    },
    {
      check: 'incident on a trip that is not completed',
      level: 'error',
      model: models.incident,
      pipeline: [
        ...only('_id', (s) => s.incidents),
        ...lookupOne(collections.trips, 'trip', 't'),
        { $match: { t: { $ne: null }, 't.status': { $ne: TripStatus.COMPLETED } } },
      ],
    },

    // ---------------- route points ----------------
    {
      check: 'trippoints.trip → trips',
      level: 'error',
      model: models.routePoint,
      pipeline: [...only('trip', (s) => s.trips), ...lookupOne(collections.trips, 'trip', 't'), { $match: { t: null } }],
    },

    // ---------------- notifications ----------------
    ...notificationChecks(models, collections, scope),

    // ---------------- refresh tokens ----------------
    {
      check: 'refreshtokens.userId → users',
      level: 'error',
      model: models.refreshToken,
      pipeline: [...only('userId', (s) => s.users), ...lookupOne(collections.users, 'userId', 'u'), { $match: { u: null } }],
    },
  ];

  const problems: IntegrityProblem[] = [];
  // one at a time: inside a transaction, operations can't run in parallel
  for (const { check, level, model, pipeline } of checks) {
    const rows = await model.aggregate<{ _id: Types.ObjectId }>([...pipeline, { $project: { _id: 1 } }]);
    if (rows.length === 0) continue;
    const samples = [...new Set(rows.map((row) => String(row._id)))];
    problems.push({ check, level, count: samples.length, samples: samples.slice(0, 5) });
  }
  return problems;
}

function notificationChecks(
  models: SeedModels,
  collections: { users: string; trips: string; incidents: string },
  scope?: SeedScope,
): Check[] {
  const start: PipelineStage[] = scope
    ? [{ $match: { $or: [{ recipient: { $in: scope.users } }, { trip: { $in: scope.trips } }, { incident: { $in: scope.incidents } }] } }]
    : [];
  return [
    {
      check: 'notifications.recipient → users',
      level: 'error',
      model: models.notification,
      pipeline: [...start, ...lookupOne(collections.users, 'recipient', 'u'), { $match: { u: null } }],
    },
    {
      check: 'notifications.trip → trips',
      level: 'error',
      model: models.notification,
      pipeline: [...start, { $match: { trip: { $ne: null } } }, ...lookupOne(collections.trips, 'trip', 't'), { $match: { t: null } }],
    },
    {
      check: 'notifications.incident → incidents (on the notification\'s trip)',
      level: 'error',
      model: models.notification,
      pipeline: [
        ...start,
        { $match: { incident: { $ne: null } } },
        ...lookupOne(collections.incidents, 'incident', 'i'),
        { $match: { $or: [{ i: null }, { $expr: { $ne: ['$i.trip', '$trip'] } }] } },
      ],
    },
  ];
}

export function printProblems(problems: IntegrityProblem[]) {
  if (problems.length === 0) {
    console.log('Referential integrity: every reference points to an existing, matching record.');
    return;
  }
  console.table(
    problems.map(({ check, level, count, samples }) => ({ level, check, count, samples: samples.join(', ') })),
  );
}

/** Throws when any reference is broken; inside a seed's transaction that rolls the whole seed back. */
export async function assertIntact(models: SeedModels, scope: SeedScope) {
  const problems = await verifyIntegrity(models, scope);
  const errors = problems.filter((problem) => problem.level === 'error');
  const warnings = problems.filter((problem) => problem.level === 'warning');
  if (warnings.length) {
    console.warn('Integrity warnings (not blocking):');
    printProblems(warnings);
  }
  if (errors.length) {
    printProblems(errors);
    throw new Error(`Seed rolled back: ${errors.length} referential integrity check(s) failed (listed above).`);
  }
}
