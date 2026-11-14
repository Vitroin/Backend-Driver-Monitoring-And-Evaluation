/**
 * Incidents seed — adds mock incidents to trips that already exist
 *
 * Usage (through the Nest build, like seed.ts):
 *   bun run seed:incidents                               # every completed trip
 *   bun run seed:incidents -- --trip=T-90001             # one trip
 *   bun run seed:incidents -- --driver=driver1@sdems.dev # one driver's trips
 *   bun run seed:incidents -- --count=5                  # exactly 5 per trip (default: random 1–4)
 *   bun run seed:incidents -- --seed=7                   # repeatable: the same seed adds the same incidents,
 *                                                        # and refuses to add them twice
 *
 * Only trips whose parents are all in place get incidents: the driver exists and is a driver, the
 * organization exists, and the driver belongs to it. Any other trip is listed and skipped, since an
 * incident on it would copy a broken reference (run `bun run seed:verify` to see the whole picture).
 *
 * Each incident is placed on the trip's recorded route when it has one (time, location and speed of a
 * real GPS fix), otherwise near Cairo. Afterwards each touched trip's eventsCount and score are
 * recalculated from ALL of its incidents. Everything is written in one transaction and checked before it commits.
 */

import { faker } from '@faker-js/faker';
import { QueryFilter, Types } from 'mongoose';
import { Trip } from '@modules/trips/trips.model';
import { IncidentType, TripStatus, UserRole } from '@common/enums';
import {
  bootstrap,
  fallbackLocation,
  pickPointsDeducted,
  pickSeverity,
  runSeedTransaction,
  scoreFor,
  seededId,
  SeedScope,
} from '../seed/seed-kit';

const CONFIG = {
  incidentsPerTrip: { min: 1, max: 4 },
};

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

const positiveInt = (name: string, value: string | undefined) => {
  if (value === undefined) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`--${name} must be a positive integer`);
  return number;
};

async function seedIncidents() {
  const fixedCount = positiveInt('count', arg('count'));
  const seed = positiveInt('seed', arg('seed'));
  if (seed !== null) faker.seed(seed);

  const context = await bootstrap();
  const { models } = context;

  try {
    // Completed trips only: a planned trip has no duration, and its score must stay null
    const filter: QueryFilter<Trip> = { status: TripStatus.COMPLETED, durationSeconds: { $ne: null } };

    const tripCode = arg('trip');
    if (tripCode) filter.code = tripCode;

    const driverEmail = arg('driver');
    if (driverEmail) {
      const driver = await models.user.findOne({ email: driverEmail.toLowerCase() }, { _id: 1 }).lean();
      if (!driver) throw new Error(`No user with email ${driverEmail}`);
      filter.driver = driver._id;
    }

    // lean() also skips the incidents autopopulate on Trip
    const trips = await models.trip
      .find(filter, { _id: 1, code: 1, driver: 1, organization: 1, startedAt: 1, durationSeconds: 1, speedLimitKmh: 1 })
      .sort({ code: 1 }) // a fixed order, so --seed gives the same incidents every time
      .lean();
    if (trips.length === 0) {
      // say why, so an empty database isn't mistaken for a broken filter
      const byStatus = await models.trip.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      console.log('No matching completed trips.');
      console.table(byStatus.length ? byStatus.map((s) => ({ status: s._id, trips: s.count })) : [{ status: '(none)', trips: 0 }]);
      if (byStatus.length === 0) console.log('The database has no trips yet: run `bun run seed:fresh` first.');
      return;
    }

    // ---------------- Parents of every trip, checked before anything is written ----------------
    const drivers = await models.user
      .find({ _id: { $in: trips.map((trip) => trip.driver) } }, { role: 1, organization: 1 })
      .lean();
    const driverById = new Map(drivers.map((driver) => [String(driver._id), driver]));
    const existingOrganizations = new Set(
      (await models.organization.distinct('_id', { _id: { $in: trips.map((trip) => trip.organization) } })).map(String),
    );

    const skipped: { trip: string; reason: string }[] = [];
    const usable = trips.filter((trip) => {
      const driver = driverById.get(String(trip.driver));
      const reason = !driver
        ? `driver ${trip.driver} is not in users`
        : driver.role !== UserRole.DRIVER
          ? `driver ${trip.driver} has role ${driver.role}`
          : !existingOrganizations.has(String(trip.organization))
            ? `organization ${trip.organization} is not in organizations`
            : !driver.organization || !driver.organization.equals(trip.organization)
              ? "the trip's organization is not its driver's"
              : null;
      if (reason) skipped.push({ trip: trip.code, reason });
      return reason === null;
    });
    if (skipped.length) {
      console.warn(`Skipping ${skipped.length} trip(s) with a broken reference (run \`bun run seed:verify\` for details):`);
      console.table(skipped);
    }
    if (usable.length === 0) {
      console.log('No trip with all its references in place, nothing added.');
      return;
    }

    // ---------------- Plan: every incident built before the transaction ----------------
    const incidents: Record<string, unknown>[] = [];
    for (const trip of usable) {
      const endedAt = new Date(trip.startedAt.getTime() + trip.durationSeconds! * 1000);
      const limit = trip.speedLimitKmh ?? 60;
      const route = await models.routePoint
        .find({ trip: trip._id }, { recordedAt: 1, latitude: 1, longitude: 1, speedKmh: 1 })
        .sort({ recordedAt: 1 })
        .lean();

      const count = fixedCount ?? faker.number.int(CONFIG.incidentsPerTrip);
      for (let n = 0; n < count; n++) {
        const point = route.length > 0 ? faker.helpers.arrayElement(route) : null;
        const type = faker.helpers.enumValue(IncidentType);
        const severity = pickSeverity();
        const recordedSpeed = point?.speedKmh ?? faker.number.int({ min: 20, max: limit });

        incidents.push({
          // with --seed the ids are fixed too, so adding the same incidents twice is refused
          _id: seed !== null ? seededId(`extra-incident:${seed}:${trip._id}:${n}`) : new Types.ObjectId(),
          trip: trip._id,
          driver: trip.driver, // the trip's driver, checked above
          type,
          severity,
          occurredAt: point?.recordedAt ?? faker.date.between({ from: trip.startedAt, to: endedAt }),
          location: point ? { latitude: point.latitude, longitude: point.longitude } : fallbackLocation(faker),
          // a speeding event has to be above the trip's limit, or the report contradicts itself
          speedKmh:
            type === IncidentType.SPEEDING
              ? Math.max(recordedSpeed, faker.number.int({ min: limit + 5, max: limit + 40 }))
              : recordedSpeed,
          clipUrl: null,
          clipPublicId: null,
          pointsDeducted: pickPointsDeducted(severity),
        });
      }
    }

    const tripIds = usable.map((trip) => trip._id);
    const seeded: SeedScope = {
      users: [],
      organizations: [],
      trips: tripIds,
      incidents: incidents.map((incident) => incident._id as Types.ObjectId),
    };

    const { result: tripsUpdated } = await runSeedTransaction(
      context,
      { fresh: false, existing: seeded, seeded },
      async () => {
        await models.incident.insertMany(incidents);

        // Recalculate from every incident of the trip (old + new), not just the ones added now
        const totals = await models.incident.aggregate<{ _id: Types.ObjectId; count: number; deducted: number }>([
          { $match: { trip: { $in: tripIds } } },
          { $group: { _id: '$trip', count: { $sum: 1 }, deducted: { $sum: '$pointsDeducted' } } },
        ]);
        await models.trip.bulkWrite(
          totals.map((total) => ({
            updateOne: {
              filter: { _id: total._id },
              update: { $set: { eventsCount: total.count, score: scoreFor(total.deducted) } },
            },
          })),
        );
        return totals.length;
      },
    );

    console.table({ tripsUpdated, incidentsAdded: incidents.length, tripsSkipped: skipped.length });
    console.log('Every added incident checked: no orphans.');
  } catch (err) {
    if ((err as { code?: number }).code === 11000 && seed !== null) {
      throw new Error(`These incidents were already added with --seed=${seed}. Use another seed, or leave it out.`);
    }
    throw err;
  } finally {
    await context.app.close();
  }
}

seedIncidents()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Incidents seed failed:', err);
    process.exit(1);
  });
