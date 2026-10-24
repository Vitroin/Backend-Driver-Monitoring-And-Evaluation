import { StandardSchemaValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IncidentType, TripStatus, UserRole, UserStatus } from '@common/enums';
import { Authenticator } from '@modules/auth/authenticator.service';
import { AuthenticationGuard } from '@modules/auth/guards/authentication.guard';
import { TokenService } from '@modules/auth/token/token.service';
import { IncidentsService } from '@modules/incidents/incidents.service';
import { UsersService } from '@modules/users/users.service';
import { TripMapController } from './trip-map.controller';
import { TripMapService } from './trip-map.service';
import { TripRouteRepository } from './trip-route.repository';
import { TripsRepository } from './trips.repository';

async function* stream<T>(items: T[]) {
  yield* items;
}

// HTTP-level: the real AuthenticationGuard, validation pipe, controller and service, with the database mocked out
describe('TripMapController (HTTP)', () => {
  let app: NestFastifyApplication;

  const organizationId = new Types.ObjectId();
  const tripId = new Types.ObjectId();
  const user = (role: UserRole, organization = organizationId) => ({
    _id: new Types.ObjectId(),
    role,
    organization,
    securityStamp: new Types.ObjectId(),
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  });
  // Keyed by the bearer token each one "logs in" with
  const users = {
    driver: user(UserRole.DRIVER),
    otherDriver: user(UserRole.DRIVER),
    instructor: user(UserRole.DRIVER_INSTRUCTOR),
    otherAnalyst: user(UserRole.FLEET_ANALYST, new Types.ObjectId()),
  };
  const trip = {
    _id: tripId,
    code: 'T-24013',
    status: TripStatus.COMPLETED,
    startedAt: new Date('2026-10-16T12:00:00.000Z'),
    durationSeconds: 300,
    distanceKm: 2.4,
    speedLimitKmh: 35,
    driver: users.driver._id,
    organization: organizationId,
  };

  const tokenService = {
    verifyAccessToken: vi.fn((token: keyof typeof users) => ({
      sid: new Types.ObjectId().toString(),
      userId: users[token]._id.toString(),
      securityStamp: users[token].securityStamp.toString(),
      iat: 1,
      exp: 2_000_000_000,
    })),
    isAccessTokenBlocked: vi.fn(async () => false),
  };
  const usersService = {
    findForAuthentication: vi.fn(async (id: string) => Object.values(users).find((u) => u._id.toString() === id) ?? null),
  };
  const tripsRepository = { findMapTrip: vi.fn() };
  const tripRouteRepository = { countPoints: vi.fn(), streamPoints: vi.fn() };
  const incidentsService = { findByTrip: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TripMapController],
      providers: [
        TripMapService,
        Authenticator,
        { provide: TripsRepository, useValue: tripsRepository },
        { provide: TripRouteRepository, useValue: tripRouteRepository },
        { provide: IncidentsService, useValue: incidentsService },
        { provide: TokenService, useValue: tokenService },
        { provide: UsersService, useValue: usersService },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    tripsRepository.findMapTrip.mockImplementation(async (id: Types.ObjectId) => (id.equals(tripId) ? trip : null));
    tripRouteRepository.countPoints.mockResolvedValue(2);
    tripRouteRepository.streamPoints.mockImplementation(() =>
      stream([
        { recordedAt: new Date('2026-10-16T12:00:00.000Z'), latitude: 31.2001, longitude: 29.9187, speedKmh: 30, speedLimitKmh: null, headingDeg: null },
        { recordedAt: new Date('2026-10-16T12:00:02.000Z'), latitude: 31.2005, longitude: 29.9192, speedKmh: 39, speedLimitKmh: null, headingDeg: null },
      ]),
    );
    incidentsService.findByTrip.mockResolvedValue([]);
  });

  const get = (path: string, token?: keyof typeof users) => {
    const req = request(app.getHttpServer()).get(path);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('needs a login', async () => {
    await get(`/trips/${tripId}/map`).expect(401);
  });

  it("returns the map of the driver's own trip", async () => {
    const { body } = await get(`/trips/${tripId}/map`, 'driver').expect(200);

    expect(body.message).toBe('Trip map data');
    expect(body.data.trip.id).toBe(tripId.toString());
    expect(body.data.route.points.map((p: { speedCategory: string }) => p.speedCategory)).toEqual(['within_limit', 'over_limit']);
    expect(body.data.route.segments).toEqual([{ speedCategory: 'within_limit', startIndex: 0, endIndex: 1 }]);
    expect(body.data.metadata).toMatchObject({ hasRoute: true, hasIncidents: false });
  });

  it("lets organization staff in, and 404s for everyone else's trip", async () => {
    await get(`/trips/${tripId}/route`, 'instructor').expect(200);
    await get(`/trips/${tripId}/route`, 'otherDriver').expect(404);
    await get(`/trips/${tripId}/incidents`, 'otherAnalyst').expect(404);
  });

  it('404s for a trip that does not exist', async () => {
    await get(`/trips/${new Types.ObjectId()}/map`, 'driver').expect(404);
  });

  it('rejects an invalid trip id', async () => {
    await get('/trips/not-an-id/map', 'driver').expect(400);
  });

  it('parses the route query into dates and a number', async () => {
    await get(`/trips/${tripId}/route?from=2026-10-16T12:00:00Z&to=2026-10-16T12:01:00Z&maxPoints=500`, 'driver').expect(200);
    expect(tripRouteRepository.countPoints).toHaveBeenLastCalledWith(tripId, {
      from: new Date('2026-10-16T12:00:00Z'),
      to: new Date('2026-10-16T12:01:00Z'),
    });
  });

  it.each([
    ['a time range that ends before it starts', `route?from=2026-10-16T12:01:00Z&to=2026-10-16T12:00:00Z`],
    ['a non-date', 'route?from=yesterday'],
    ['too few points', 'map?maxPoints=1'],
    ['an unknown incident type', 'incidents?eventType=crash'],
    ['an unknown query parameter', 'incidents?driver=me'],
    ['an unknown sort', 'incidents?sort=type'],
  ])('rejects %s', async (_, path) => {
    await get(`/trips/${tripId}/${path}`, 'driver').expect(400);
  });

  it('passes the incident filters through', async () => {
    await get(`/trips/${tripId}/incidents?eventType=harsh_braking&severity=high`, 'driver').expect(200);
    expect(incidentsService.findByTrip).toHaveBeenLastCalledWith(
      tripId,
      { eventType: IncidentType.HARSH_BRAKING, severity: 'high' },
      { sort: { occurredAt: 1 }, limit: undefined },
    );
  });
});
