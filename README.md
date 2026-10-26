# Sahi: Driver Monitoring and Evaluation API

Backend for **Sahi**, a driver monitoring and evaluation system. In-vehicle units record trips (GPS route, speed/acceleration/steering readings and detected incidents such as harsh braking or drowsiness). This API scores those trips and serves the dashboards that drivers, driving-school staff, fleet companies and insurance companies use: trip reports, maps, progress charts, incident analysis, notifications, PDF reports and AI coaching (through a separate FastAPI service).

> Everything in this document was derived from the source code. Where the code's behaviour differs from its own Swagger annotations or comments, this README describes **what the code actually does** and flags the difference. Those differences are collected in [Known caveats](#known-caveats).

---

## Table of contents

- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Running the application](#running-the-application)
- [Seeding data](#seeding-data)
- [Tests, linting and type checking](#tests-linting-and-type-checking)
- [API conventions](#api-conventions)
- [Authentication and authorization](#authentication-and-authorization)
- [Endpoint summary](#endpoint-summary)
- Endpoints by module
  - [Auth (`/auth`)](#auth-endpoints)
  - [Users (`/users`)](#users-endpoints)
  - [Organizations (`/organizations`)](#organizations-endpoints)
  - [Instructors (`/instructors`)](#instructors-endpoints)
  - [Trips: driver dashboards (`/trips`)](#trips-endpoints)
  - [Trips: map (`/trips/:tripId/...`)](#trip-map-endpoints)
  - [Incidents (`/incidents`)](#incidents-endpoints)
  - [Drivers (`/drivers`)](#drivers-endpoints)
  - [Coaching (`/drivers/:driverId/coaching`)](#coaching-endpoints)
  - [Notifications (`/notifications`) and Socket.IO events](#notifications-endpoints)
  - [Reports (`/reports`)](#reports-endpoints)
  - [Health (`/health`)](#health-endpoints)
- [Background jobs and internals](#background-jobs-and-internals)
- [Domain reference (enums)](#domain-reference)
- [Known caveats](#known-caveats)

---

<a id="technology-stack"></a>
## Technology stack

| Concern | Technology |
| --- | --- |
| Framework | [NestJS 12](https://nestjs.com) on the **Fastify** adapter (`@nestjs/platform-fastify`) |
| Language / build | TypeScript 6, compiled with **SWC** (`nest-cli.json` → `"builder": "swc"`) |
| Package manager | **Bun** (`bun.lock`) |
| Runtime | Node.js 24 (production image `node:24-alpine`) |
| Database | **MongoDB 8** via Mongoose 9. **Must be a replica set** (the code uses transactions) |
| Cache / ephemeral state | **Redis 8** via `@nestjs/cache-manager` + `@keyv/redis` (OTPs, one-time tokens, access-token blocklist, cached stats) |
| Queue | **BullMQ** on the same Redis (outgoing email) |
| Validation | **Zod 4** schemas, applied by Nest's global `StandardSchemaValidationPipe` |
| Auth | `@nestjs/jwt` (HS256 access tokens), opaque rotating refresh tokens, **argon2** password hashing |
| Email | Nodemailer over Gmail SMTP, sent from a BullMQ worker |
| Real-time | Socket.IO (`@nestjs/websockets` + `@nestjs/platform-socket.io`) |
| Rate limiting | `@nestjs/throttler` |
| Scheduling | `@nestjs/schedule` (cron) |
| Health checks | `@nestjs/terminus` |
| API docs | `@nestjs/swagger` (UI at `/docs`) |
| PDF | `pdfmake-rtl` (Roboto for English, Cairo for Arabic) |
| AI coaching | External **FastAPI** service, called over HTTP with a shared service token |
| Tests / lint / format | Vitest 4 + Supertest, oxlint, Prettier |

---

<a id="project-structure"></a>
## Project structure

```
src/
├── main.ts                    # Loads .env, validates env with Zod, creates the Fastify app, mounts Swagger, listens on 0.0.0.0:PORT
├── app.module.ts              # Infrastructure + Core + Features + Config
├── config/                    # registerAs() configs and the Zod env schema (config.validation.ts)
├── core/                      # Global pipe + throttler guard, event emitter, scheduler, mail queue, Fastify adapter, Swagger
├── infrastructure/            # MongoDB connection, Redis cache, BullMQ connection
├── common/                    # Decorators (@Public, @AllowedRoles, @CurrentUser), enums, shared Zod types, BaseRepository
├── shared/                    # TransactionService (Mongo transactions); unused interceptors/filter (see caveats)
├── database/scripts/          # seed.ts, seed-organizations.ts, seed-super-admin.ts
└── modules/
    ├── auth/                  # Login, tokens, OTP, invitations, global AuthenticationGuard + RolesGuard
    ├── users/                 # User model (Mongoose discriminator on `role`), self-service endpoints
    ├── organizations/         # Organizations, owner/employee/driver invitations
    ├── instructors/           # Instructor discriminator (drivingStudents), student assignment
    ├── trips/                 # Trip model, dashboards, trip map, route points, scoring, ingestion service (no routes)
    ├── incidents/             # Incident model and incident statistics
    ├── drivers/               # Cross-trip driver stats
    ├── fast-api/              # FastAPI client + coaching proxy endpoints
    ├── notifications/         # Notification model, HTTP endpoints, Socket.IO gateway
    ├── reports/               # Driver PDF report
    └── health/                # Liveness/readiness checks
```

---

<a id="prerequisites"></a>
## Prerequisites

- **Bun** (installs dependencies, runs the scripts; `seed:super-admin` runs a `.ts` file directly with Bun).
- **Node.js 24** (`start:prod` and the seed scripts run the compiled output with `node`; `main.ts` uses `process.loadEnvFile()`).
- **MongoDB as a replica set.** Creating an organization, changing/resetting a password and revoking sessions run inside MongoDB transactions, which need a replica set. `docker compose up mongo` starts a single-node replica set (`rs0`).
- **Redis** (cache, OTPs, one-time tokens, logout blocklist and the mail queue).
- **A Gmail account with an App Password** for outgoing mail (invitations, OTPs).
- **The FastAPI coaching service** (optional at runtime). Only the [coaching endpoints](#coaching-endpoints), [`GET /health/coaching`](#ep-health-coaching) and the recommendations section of the [PDF report](#ep-reports-download) depend on it. The `FASTAPI_URL` and `SERVICE_TOKEN` variables are still **required** for the app to start.
- **Docker + Docker Compose** (optional, for running MongoDB/Redis or the whole stack).

---

<a id="setup"></a>
## Setup

```bash
# 1. Install dependencies
bun install

# 2. Create your environment file and fill in the values (see the table below)
cp .env.example .env

# 3. Start MongoDB (single-node replica set rs0) and Redis
docker compose up -d mongo redis
#    From your machine to the compose MongoDB, use:
#    DB_URL=mongodb://127.0.0.1:27017/Sahi?replicaSet=rs0&directConnection=true

# 4. Create the first super admin (does nothing if one already exists)
bun run seed:super-admin <username> <email> <password> "<full name>"

# 5. (Optional) Load demo data
bun run seed

# 6. Start the API in watch mode
bun run r
```

Swagger UI is then available at <http://localhost:3000/docs> (JSON at `/docs-json`).

---

<a id="environment-variables"></a>
## Environment variables

Validated at startup by `src/config/validations/config.validation.ts` (`main.ts` parses `process.env` with this Zod schema and the app refuses to start if it fails). `.env` is loaded from the project root; variables already set in the environment (Docker, CI) take precedence.

| Variable | Required | Default | Rules / purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production`. `production` disables Swagger. |
| `PORT` | no | `3000` | Integer. The server listens on `0.0.0.0:PORT`. |
| `TRUST_PROXY` | no | `false` | Boolean string. Set `true` behind a reverse proxy so the rate limiter uses the `X-Forwarded-For` client IP. |
| `LOG_LEVEL` | no | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` (Fastify/pino request logs). |
| `APP_CLIENT_URL` | **yes** | none (example: `http://localhost:5173`) | Must be a URL. Invitation emails link to `<APP_CLIENT_URL>/activate-account?token=…`. |
| `DB_URL` | **yes** | none | MongoDB connection string to a **replica set**. |
| `REDIS_HOST` | **yes** | none (example: `localhost`) | Non-empty. |
| `REDIS_PORT` | no | `6379` | Integer. |
| `MAILER_USERNAME` | **yes** | none | Gmail address used to send mail. |
| `MAILER_PASSWORD` | **yes** | none | Gmail **App Password** (not the account password). |
| `JWT_SECRET` | **yes** | none | At least 32 characters. Signs access tokens (HS256). |
| `JWT_ACCESS_TOKEN_TTL_MINUTES` | no | `15` | Positive number. |
| `JWT_REFRESH_TOKEN_TTL_DAYS` | no | `7` | Positive number. Restarted on every refresh. |
| `OTP_SECRET` | **yes** | none | At least 32 characters. HMAC key for stored OTP hashes. |
| `OTP_EXPIRY_MINUTES` | no | `5` | Positive number. Lifetime of emailed 6-digit codes. |
| `FASTAPI_URL` | **yes** | none (example: `http://127.0.0.1:8000`) | Must be a URL. Base URL of the coaching service. |
| `FASTAPI_TIMEOUT_MS` | no | `5000` | Positive integer. Per-call timeout to FastAPI. |
| `SERVICE_TOKEN` | **yes** | none | Shared secret sent to FastAPI as the `X-Service-Token` header. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | none | Reserved for incident video clips; not used by any code yet. |

> `.env.example` says "variables with a value here are optional", but `APP_CLIENT_URL`, `REDIS_HOST` and `FASTAPI_URL` have example values there and are **required** by the schema (no default).

Generate secrets with, for example, `openssl rand -base64 48`. Never commit `.env`.

---

<a id="running-the-application"></a>
## Running the application

| Script | Command | What it does |
| --- | --- | --- |
| `bun run start` | `nest start` | Build and run once. |
| `bun run r` | `nest start --watch` | Watch mode (clears the console first). |
| `bun run start:debug` | `nest start --debug --watch` | Watch mode with the Node inspector. |
| `bun run build` | `nest build` | Compile to `dist/` with SWC. |
| `bun run start:prod` | `node dist/main` | Run the compiled build. |

### Docker

```bash
docker compose up --build
```

Starts `api` (port 3000), `mongo` (single-node replica set, data in the `mongo-data` volume) and `redis`. The API container reads `.env` and overrides `DB_URL`, `REDIS_HOST` and `REDIS_PORT` so it talks to the other containers. The image sets `NODE_ENV=production` (Swagger off) unless your `.env` sets a different value.

---

<a id="seeding-data"></a>
## Seeding data

All seed scripts connect with the variables from `.env`. `seed` and `seed:organizations` refuse to run when `NODE_ENV=production`.

| Script | What it creates |
| --- | --- |
| `bun run seed:super-admin <username> <email> <password> "<full name>"` | Inserts one active `super_admin` (no organization, `mustChangePassword: false`). Does nothing if a super admin already exists. The script does not enforce the 12-character password policy, so choose a strong password yourself. |
| `bun run seed` / `bun run seed:fresh` | "Seed Driving School" + "Seed Fleet Company", 2 driver instructors, 2 fleet analysts, 8 drivers (learners assigned to instructors), 3–6 trips per driver with GPS routes, motion readings and incidents. Usernames are `instructor1`, `analyst1`, `driver1`…`driver8` (emails `@sdems.dev`). `--fresh` first deletes data previously created by this seed only. |
| `bun run seed:organizations` / `bun run seed:organizations:fresh` | One organization of each type with an owner, employees and drivers. Usernames like `school-owner`, `fleet-employee1`, `school-driver1` (emails `@orgs.sdems.dev`). |

Seeded accounts share a development password, defined as `CONFIG.defaultPassword` in each seed script and printed when the script finishes.

---

<a id="tests-linting-and-type-checking"></a>
## Tests, linting and type checking

```bash
bun run test        # unit tests (Vitest, **/*.spec.ts)
bun run test:watch  # watch mode
bun run test:cov    # coverage
bun run test:e2e    # e2e tests (**/*.e2e-spec.ts); needs a MongoDB replica set at E2E_DB_URL
                    # (default mongodb://127.0.0.1:27017/sahi_e2e?replicaSet=rs0)
bun run lint        # oxlint src/ test/
bun run typecheck   # tsc --noEmit
bun run format      # prettier --write
```

---

<a id="api-conventions"></a>
## API conventions

### Base URL and documentation
- No global prefix and no versioning: routes are mounted at the root, e.g. `http://localhost:3000/auth/login`.
- Swagger UI at `/docs` and the OpenAPI JSON at `/docs-json`, **only when `NODE_ENV` is not `production`**. Swagger "Authorize" persists the Bearer token between page reloads.
- CORS is **not** enabled (`main.ts` doesn't call `enableCors`), so cross-origin browser requests are blocked unless you serve the client from the same origin or go through a proxy.

### Requests
- JSON bodies (`Content-Type: application/json`). Malformed JSON is rejected by Fastify with `400`.
- IDs are MongoDB ObjectIds (24 hex characters). Date-times are ISO 8601 strings, returned in UTC.
- Fastify assigns each request a UUID (or uses the incoming `x-request-id` header) and writes one JSON log line per request. The id appears in the logs only; it isn't returned in a response header.

### Response envelope
Most endpoints return:

```json
{ "message": "Human-readable result", "data": { } }
```

Paginated lists add `meta`:

```json
{ "message": "Users", "data": [ ], "meta": { "page": 1, "limit": 20, "total": 57 } }
```

Pagination query parameters (where supported): `page` (integer ≥ 1, default `1`) and `limit` (integer 1–100, default `20`).

A few endpoints don't use the envelope: `GET /trips/filteredTrips/:driverId` and `GET /incidents/recentCounts` return bare arrays, `GET /health*` return Terminus health objects, `GET /reports/downloadReport` returns a PDF and `POST /auth/logout` returns `204` with no body.

### Serialization
No serializer or transform interceptor is registered. Endpoints that map data to DTOs return exactly the documented fields. Endpoints that return **Mongoose documents directly** (noted per endpoint) are serialized with the schema's `toJSON` (virtuals on), so they contain both `_id` and `id`, and `__v` unless a projection excludes it.

### Validation
Request bodies, queries and params are validated with Zod through `StandardSchemaValidationPipe` (values are transformed: trimmed, lowercased, coerced, defaulted). Most schemas are **strict**: unknown keys produce `Unrecognized key: "<name>"`. The exceptions are the `POST /organizations` body (unknown keys are silently dropped) and the path-parameter schemas. Some path ids are checked by `ParseObjectIdPipe` instead (different error message, shown below).

### Errors
Errors use Nest's default exception body:

```json
{ "message": "Invalid credentials", "error": "Unauthorized", "statusCode": 401 }
```

| Situation | Status | Body |
| --- | --- | --- |
| Zod validation failed | 400 | `{ "message": ["username: Username must be at least 3 characters long", "password: Password is required"], "error": "Bad Request", "statusCode": 400 }`. Each entry is `<path>: <issue>`. |
| Path id rejected by `ParseObjectIdPipe` | 400 | `{ "message": "Invalid ObjectId: 'abc' is not a valid MongoDB ObjectId", "error": "Bad Request", "statusCode": 400 }` |
| Path id rejected by the Zod id schema | 400 | `{ "message": ["id: Must be a valid ID"], "error": "Bad Request", "statusCode": 400 }` |
| Missing/invalid/expired token | 401 | See [token checks](#token-checks). |
| Inactive account / password change pending | 403 | See [token checks](#token-checks). |
| Role not allowed | 404 | `{ "message": "Resource not found", "error": "Not Found", "statusCode": 404 }` (deliberately 404, not 403). |
| Rate limit exceeded | 429 | `{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }` |
| OTP requested again within 60 s | 429 | `{ "statusCode": 429, "message": "Please wait 60 seconds before requesting another code" }` |
| Unknown route | 404 | `{ "message": "Cannot GET /nope", "error": "Not Found", "statusCode": 404 }` |
| Unhandled error | 500 | `{ "statusCode": 500, "message": "Internal server error" }` |

### Rate limiting
- **Global:** 60 requests per minute per client IP, on every route (public ones included) and every Socket.IO message.
- **Strict:** 5 requests per minute per client IP on `POST /auth/login`, `/auth/forced-change-password`, `/auth/accept-invitation`, `/auth/forgot-password`, `/auth/reset-password` and `PATCH /auth/change-password`.
- Counters are kept in the throttler's default in-memory storage, so each API process counts separately.

---

<a id="authentication-and-authorization"></a>
## Authentication and authorization

### Global guards
Three guards are registered with `APP_GUARD`, so they apply to **every HTTP route and every Socket.IO message** with no per-controller setup:

1. **`ThrottlerGuard`** (`CoreModule`): rate limiting, as described above.
2. **`AuthenticationGuard`** (`AuthModule`): requires a valid access token unless the route or its controller is marked `@Public()`. It attaches the user document and the session (`sid`, `exp`) to the request.
3. **`RolesGuard`** (`AuthModule`): enforces `@AllowedRoles([...])` (on a handler, or on the controller for all its handlers).
   - No `@AllowedRoles` → any authenticated user.
   - `super_admin` **always passes** a role check.
   - Any other role not in the list gets **`404 Resource not found`**, so the route's existence isn't revealed.

Public routes: `POST /auth/login`, `/auth/refresh`, `/auth/forced-change-password`, `/auth/accept-invitation`, `/auth/forgot-password`, `/auth/reset-password`, `GET /organizations`, `GET /health` and `GET /health/coaching`.

### Tokens
Send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

| Token | Format | Lifetime | Storage | Notes |
| --- | --- | --- | --- | --- |
| Access token | JWT, HS256, `iss: sahi-api`, `aud: sahi-web`; claims `sid`, `userId`, `securityStamp`, `iat`, `exp` | `JWT_ACCESS_TOKEN_TTL_MINUTES` (15 min) | Not stored | `sid` is the session id. |
| Refresh token | 128 hex characters (random) | `JWT_REFRESH_TOKEN_TTL_DAYS` (7 days), restarted on each refresh | `refreshtokens` collection, **SHA-256 hash only**, document `_id` = `sid` | Single use: every refresh returns a new one for the same session. |
| One-time tokens | 32 random bytes, base64url | Forced password change: 15 min. Account activation: 8 h | Redis (`one_time_token:<purpose>:<sha256>`) | Consumed atomically on first use. |
| OTP | 6 digits | `OTP_EXPIRY_MINUTES` (5 min) | Redis, HMAC-SHA256 of the code | Single use, at most 5 wrong guesses, 60 s cooldown between codes. |

<a id="token-checks"></a>
### Token checks (every protected request)

| Check | Result |
| --- | --- |
| No `Authorization` header | 401 `Authorization token is required` |
| Header isn't `Bearer <token>` | 401 `Invalid token format. Please login again` |
| Signature, algorithm, issuer, audience or claims invalid | 401 `Invalid token. Please login again` |
| Token expired | 401 `Token has expired. Please login again` |
| Session logged out (`sid` on the Redis blocklist) | 401 `Invalid token. Please login again` |
| User deleted, or token's `securityStamp` ≠ user's current stamp | 401 `Invalid token. Please login again` |
| User `status` isn't `active` | 403 `Account is not active. Please contact system administrator` |
| User has `mustChangePassword: true` | 403 `Password change required. Please change your password to continue` |

**Security stamp.** Every user has a `securityStamp`. It is rotated on password change, password reset, forced password change, account activation and "log out everywhere", which immediately invalidates every access token issued before (including the one used for the request). Refresh tokens are deleted at the same time.

### Roles

| Role | Who | Notes |
| --- | --- | --- |
| `super_admin` | Platform administrator; belongs to no organization | Passes every role check. Created with `seed:super-admin`. |
| `school_administrator` | Owner of a `driving_school` | Owner role (marked "Future Work" in the enum). |
| `fleet_manager` | Owner of a `fleet_company` | Owner role (marked "Future Work" in the enum). |
| `insurance_manager` | Owner of an `insurance_company` | Owner role (marked "Future Work" in the enum). |
| `driver_instructor` | Employee of a driving school | Stored with the `Instructor` discriminator (`drivingStudents`). |
| `fleet_analyst` | Employee of a fleet company | |
| `insurance_analyst` | Employee of an insurance company | |
| `driver` | A driver (learner or fleet employee) | |

Account `status`: `waiting_for_activation` (invited, default), `active`, `inactive`. No endpoint currently sets `inactive`.

<a id="account-lifecycle"></a>
### Account lifecycle

1. A **super admin** creates an organization ([`POST /organizations`](#ep-org-create)). Its owner is created as an invited user (`waiting_for_activation`) with a role that depends on the organization type.
2. The **owner** (or a super admin) invites employees ([`POST /organizations/:id/employees`](#ep-org-invite-employee)) and drivers ([`POST /organizations/:id/drivers`](#ep-org-invite-driver)).
3. Each invitee receives an email with `<APP_CLIENT_URL>/activate-account?token=<token>` (valid **8 hours**). The front end posts that token and a password to [`POST /auth/accept-invitation`](#ep-auth-accept-invitation), which activates the account.
4. The user logs in ([`POST /auth/login`](#ep-auth-login)) with their **generated username** and the password they chose. Usernames are generated from the email's local part plus 5 random characters (e.g. `jane.doe@mail.com` → `jane-doe-k3x9q`). The invitation email does **not** include the username; it is returned in the invite response.
5. **Forced password change:** if a user has `mustChangePassword: true` and is active, login returns a `passwordChangeToken` (15 min) instead of tokens; [`POST /auth/forced-change-password`](#ep-auth-forced-change) sets the password and logs them in.
6. **Forgotten password:** [`POST /auth/forgot-password`](#ep-auth-forgot) emails a 6-digit OTP; [`POST /auth/reset-password`](#ep-auth-reset) uses it.
7. **Super admins** must confirm a password change with an emailed OTP (two calls to [`PATCH /auth/change-password`](#ep-auth-change-password)).

### Quick start

```bash
# Log in
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"driver1","password":"<password>"}'

# Use data.tokens.accessToken
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"

# When it expires (401), exchange the refresh token for a new pair
curl -s -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
```

---

<a id="endpoint-summary"></a>
## Endpoint summary

Roles column: **Public** = no token; **Any** = any authenticated user; otherwise the roles named by `@AllowedRoles`. `super_admin` is implicitly allowed on **every** role-restricted endpoint.

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| POST | [`/auth/login`](#ep-auth-login) | Log in with username and password | Public (5/min) |
| POST | [`/auth/refresh`](#ep-auth-refresh) | Exchange a refresh token for a new token pair | Public |
| POST | [`/auth/forced-change-password`](#ep-auth-forced-change) | Set a password after login demanded it; logs in | Public (5/min) |
| POST | [`/auth/accept-invitation`](#ep-auth-accept-invitation) | Activate an invited account | Public (5/min) |
| POST | [`/auth/forgot-password`](#ep-auth-forgot) | Email a password-reset OTP | Public (5/min) |
| POST | [`/auth/reset-password`](#ep-auth-reset) | Reset the password with the OTP | Public (5/min) |
| PATCH | [`/auth/change-password`](#ep-auth-change-password) | Change own password (OTP step for super admins) | Any (5/min) |
| POST | [`/auth/logout`](#ep-auth-logout) | End the current session | Any |
| DELETE | [`/auth/users/:id/sessions`](#ep-auth-revoke) | Log a user out of every device | `super_admin` |
| GET | [`/auth/me`](#ep-auth-me) | The logged-in user | Any |
| GET | [`/users`](#ep-users-list) | List users (filter by role/organization) | `super_admin` |
| PATCH | [`/users/me/full-name`](#ep-users-full-name) | Change own full name | Any |
| POST | [`/users/me/deletion-request`](#ep-users-deletion) | Record an account-deletion request | Any |
| GET | [`/users/me/organization`](#ep-users-org) | Own organization | Any |
| GET | [`/organizations`](#ep-org-list) | List organizations | Public |
| POST | [`/organizations`](#ep-org-create) | Create an organization and invite its owner | `super_admin` |
| GET | [`/organizations/:organizationId`](#ep-org-get) | Organization with its members | `school_administrator`, `fleet_manager`, `insurance_manager` |
| POST | [`/organizations/:organizationId/employees`](#ep-org-invite-employee) | Invite an employee | `school_administrator`, `fleet_manager`, `insurance_manager` |
| POST | [`/organizations/:organizationId/drivers`](#ep-org-invite-driver) | Invite a driver | `school_administrator`, `fleet_manager`, `insurance_manager` |
| POST | [`/instructors/:instructorId/students/:driverId`](#ep-instructors-assign) | Assign a driver to an instructor | `school_administrator` |
| GET | [`/trips/filteredTrips/:driverId`](#ep-trips-filtered) | A driver's trips with incidents, filtered and paged | `driver` |
| GET | [`/trips/tripOverall/:tripId`](#ep-trips-overall) | Trip overall stats card | `driver` |
| GET | [`/trips/detectedEvents/:tripId`](#ep-trips-detected) | Trip's detected events | `driver` |
| GET | [`/trips/speedMotionGraph/:tripId`](#ep-trips-motion) | Speed readings | `driver` |
| GET | [`/trips/accelerationMotionGraph/:tripId`](#ep-trips-motion) | Acceleration readings | `driver` |
| GET | [`/trips/steeringMotionGraph/:tripId`](#ep-trips-motion) | Steering-angle readings | `driver` |
| GET | [`/trips/me/totals`](#ep-trips-totals) | Own totals and last-trip score | `driver` |
| GET | [`/trips/me/recent`](#ep-trips-recent) | Own 6 latest scored trips | `driver` |
| GET | [`/trips/tripReportHeader/:tripId`](#ep-trips-header) | Trip report header | `driver` |
| GET | [`/trips/incidentsCount/:tripId`](#ep-trips-incidents-count) | Incident count per type for a trip | `driver` |
| GET | [`/trips/tripStatistics/:tripId`](#ep-trips-statistics) | Trip statistics | `driver` |
| GET | [`/trips/incidentAnalysis/:tripId`](#ep-trips-incident-analysis) | Count and points lost per type for a trip | `driver` |
| GET | [`/trips/progressDetails/:driverId`](#ep-trips-progress-details) | "My progress" cards | `driver` |
| GET | [`/trips/progressGraph/:driverId`](#ep-trips-progress-graph) | "My progress" score graph | `driver` |
| GET | [`/trips/:tripId/map`](#ep-trip-map) | Trip map: summary, route, markers, timeline | Any |
| GET | [`/trips/:tripId/route`](#ep-trip-route) | GPS route coloured by speed | Any |
| GET | [`/trips/:tripId/incidents`](#ep-trip-incidents) | Trip's incident markers | Any |
| GET | [`/incidents/significant`](#ep-incidents-significant) | Own 5 costliest incidents (60 days) | `driver` |
| GET | [`/incidents/trip/:tripId`](#ep-incidents-trip) | Trip's incidents, costliest first | `driver` |
| GET | [`/incidents/tripIncidentsCount/:driverId`](#ep-incidents-type-totals) | Driver's count and points lost per type (all time) | `driver` |
| GET | [`/incidents/eventMix/:driverId`](#ep-incidents-event-mix) | Driver's count per type (all time) | `driver` |
| GET | [`/incidents/recentCounts`](#ep-incidents-recent-counts) | Count per type, all drivers, last 21 days | `driver_instructor` |
| GET | [`/drivers/:driverId/stats`](#ep-drivers-stats) | Driver's headline numbers | Any |
| GET | [`/drivers/:driverId/score-history`](#ep-drivers-score-history) | Score per trip, oldest first | Any |
| GET | [`/drivers/:driverId/incidents/summary`](#ep-drivers-incident-summary) | Count and points lost per type | Any |
| GET | [`/drivers/:driverId/incidents`](#ep-drivers-incidents) | Driver's incidents across trips | Any |
| GET | [`/drivers/:driverId/coaching/tips`](#ep-coaching) | Coaching tips (FastAPI) | Any |
| GET | [`/drivers/:driverId/coaching/what-to-improve`](#ep-coaching) | What to improve (FastAPI) | Any |
| GET | [`/drivers/:driverId/coaching/what-went-well`](#ep-coaching) | What went well (FastAPI) | Any |
| GET | [`/drivers/:driverId/coaching/recommendations`](#ep-coaching) | Recommendations (FastAPI) | Any |
| GET | [`/notifications`](#ep-notifications-list) | Own notifications, paged | Any |
| PATCH | [`/notifications/read-all`](#ep-notifications-read-all) | Mark all own notifications read | Any |
| PATCH | [`/notifications/:notificationId/read`](#ep-notifications-read) | Mark one notification read | Any |
| GET | [`/reports/downloadReport`](#ep-reports-download) | Own performance report (PDF) | `driver` |
| GET | [`/health`](#ep-health) | MongoDB + Redis health | Public |
| GET | [`/health/coaching`](#ep-health-coaching) | FastAPI health | Public |

Socket.IO events (same server, see [Socket.IO gateway](#socket-gateway)): `createNotification`, `findAllUserNotifications`, `findAllUnreadUserNotifications`, `markNotificationAsRead`, `markAllNotificationsAsReadForUser`. All require a token.

> **Common errors** apply to every protected endpoint and are not repeated below: `401` / `403` from the [token checks](#token-checks), `404 Resource not found` for a disallowed role, and `429` from rate limiting. Validation failures return `400` as described in [Errors](#api-conventions).

---

<a id="auth-endpoints"></a>
## Auth endpoints

Source: `src/modules/auth/auth.controller.ts`, `auth.service.ts`, `authenticator.service.ts`, `token/`, `otp/`.

The `user` object returned by several auth endpoints (mapped through `userResponseSchema`, so nothing else is exposed):

```json
{
  "id": "665f1c2e8b3e4a1d2c9f0a13",
  "username": "jane-doe-k3x9q",
  "email": "jane.doe@mail.com",
  "role": "driver",
  "status": "active",
  "mustChangePassword": false
}
```

The `tokens` object:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<signature>",
  "refreshToken": "<128 hex characters>"
}
```

Shared password rules: **new** passwords are 12–128 characters and are never trimmed; `confirmPassword` must equal the new password (`confirmPassword: Passwords do not match`). Passwords checked against an existing hash only need 1–128 characters.

<a id="ep-auth-login"></a>
### `POST /auth/login`

Log in with username and password. Use it to start a session.

**Access:** Public · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `username` | string | Required. Trimmed and lowercased, 3–30 characters. |
| `password` | string | Required, 1–128 characters. |

```json
{ "username": "jane-doe-k3x9q", "password": "MySecurePassword123" }
```

**Responses**

Normal login:

```json
{
  "message": "Login successful",
  "data": {
    "passwordChangeRequired": false,
    "tokens": { "accessToken": "eyJhbGciOi…", "refreshToken": "9f2c…" },
    "user": { "id": "665f1c2e8b3e4a1d2c9f0a13", "username": "jane-doe-k3x9q", "email": "jane.doe@mail.com", "role": "driver", "status": "active", "mustChangePassword": false }
  }
}
```

User must change their password first (no tokens issued):

```json
{
  "message": "Password change required",
  "data": { "passwordChangeRequired": true, "passwordChangeToken": "q7Jx…base64url" }
}
```

**Business logic**
1. Loads the user by username, including the password hash.
2. Verifies the password with argon2. If the username doesn't exist, it verifies against a dummy hash so the response takes the same time.
3. Rejects users whose `status` isn't `active`.
4. If `mustChangePassword` is set, issues a single-use `passwordChangeToken` (Redis, 15 min) and stops.
5. Otherwise starts a session: deletes the user's expired refresh tokens, creates a session id (`sid`), stores the refresh token hash and signs an access token.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 401 | `Invalid credentials` | Unknown username or wrong password. Invited users who haven't activated also land here, because their password is random. |
| 403 | `Please contact system administrator` | The account isn't `active`. |
| 429 | `ThrottlerException: Too Many Requests` | More than 5 attempts per minute from the same IP. |

<a id="ep-auth-refresh"></a>
### `POST /auth/refresh`

Exchange a refresh token for a new access token and refresh token. Call it when the access token expires.

**Access:** Public · **Rate limit:** global · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `refreshToken` | string | Required, 1–256 characters. |

```json
{ "refreshToken": "9f2c…" }
```

**Response**

```json
{
  "message": "Tokens refreshed successfully",
  "data": { "tokens": { "accessToken": "eyJhbGciOi…", "refreshToken": "1b7e…" } }
}
```

**Business logic**
1. Hashes the token (SHA-256) and looks up its session. An expired session is deleted.
2. Loads the user. The session is deleted and the call rejected if the user is gone, their security stamp changed, they aren't `active`, or they must change their password.
3. Atomically replaces the session's token hash (conditional update on the old hash) and restarts its lifetime. The new access token keeps the **same `sid`**.
4. The old refresh token can't be used again.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 401 | `Refresh token is invalid. Please login again` | Unknown token (including one already exchanged), or the user is no longer allowed in. |
| 401 | `Refresh token has expired. Please login again` | Past its expiry. |
| 401 | `Refresh token has already been used. Please login again` | Two concurrent refreshes with the same token; the second loses. |

<a id="ep-auth-forced-change"></a>
### `POST /auth/forced-change-password`

Set a new password after `POST /auth/login` returned `passwordChangeRequired: true`. Logs the user in.

**Access:** Public · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `token` | string | Required, 1–256. The `passwordChangeToken` from login. |
| `newPassword` | string | Required, 12–128. |
| `confirmPassword` | string | Required, must equal `newPassword`. |

```json
{ "token": "q7Jx…", "newPassword": "MyNewSecurePassword123", "confirmPassword": "MyNewSecurePassword123" }
```

**Response**

```json
{
  "message": "Password changed successfully",
  "data": {
    "tokens": { "accessToken": "eyJhbGciOi…", "refreshToken": "4c0a…" },
    "user": { "id": "665f1c2e8b3e4a1d2c9f0a13", "username": "jane-doe-k3x9q", "email": "jane.doe@mail.com", "role": "driver", "status": "active", "mustChangePassword": false }
  }
}
```

**Business logic:** consumes the one-time token (single use) → hashes the new password → in a transaction, stores it, clears `mustChangePassword`, rotates the security stamp and deletes all refresh tokens → starts a new session.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 401 | `Invalid or expired token` | Token unknown, expired (15 min) or already used. |
| 404 | `User not found` | The user was deleted in the meantime. |

<a id="ep-auth-accept-invitation"></a>
### `POST /auth/accept-invitation`

Activate an invited account by choosing its password. The token comes from the invitation link `<APP_CLIENT_URL>/activate-account?token=…`.

**Access:** Public · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `token` | string | Required, 1–256. The activation token. |
| `password` | string | Required, 12–128. |
| `confirmPassword` | string | Required, must equal `password`. |

```json
{ "token": "Zk3P…", "password": "MyNewSecurePassword123", "confirmPassword": "MyNewSecurePassword123" }
```

**Response**

```json
{ "message": "Account activated successfully. You can now login with your new password." }
```

**Business logic:** consumes the activation token (valid 8 h, single use) → hashes the password → updates the user **only if** still `waiting_for_activation`: sets the password, `status: active`, `mustChangePassword: false` and a new security stamp. No tokens are issued; the user then logs in. The token is consumed even if the final update fails.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 401 | `Invalid or expired token` | Token unknown, expired or used. |
| 404 | `No pending invitation for this user` | The user isn't waiting for activation (already active, or deleted). |

<a id="ep-auth-forgot"></a>
### `POST /auth/forgot-password`

Email a 6-digit password reset code. Always returns the same response, whether or not the account exists.

**Access:** Public · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `username` | string | Required. Trimmed and lowercased, 3–30. |

```json
{ "username": "jane-doe-k3x9q" }
```

**Response**

```json
{ "message": "If an account exists for this username, a password reset code has been sent to its email." }
```

**Business logic:** if the user exists **and is `active`**, issues a reset OTP (stores its HMAC in Redis for `OTP_EXPIRY_MINUTES`, replacing any previous one) and queues the email. A second request within 60 s doesn't send a new code, and returns the same response so the account's existence isn't revealed. Otherwise it does nothing.

**Errors:** only validation and the rate limit.

<a id="ep-auth-reset"></a>
### `POST /auth/reset-password`

Set a new password using the emailed reset code. Ends every existing session.

**Access:** Public · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `username` | string | Required, 3–30, trimmed and lowercased. |
| `otp` | string | Required, exactly 6 digits (`OTP must be exactly 6 digits`). |
| `newPassword` | string | Required, 12–128. |
| `confirmPassword` | string | Required, must equal `newPassword`. |

```json
{ "username": "jane-doe-k3x9q", "otp": "123456", "newPassword": "MyNewSecurePassword123", "confirmPassword": "MyNewSecurePassword123" }
```

**Response**

```json
{ "message": "Password reset successfully. You can now login with your new password." }
```

**Business logic:** verifies the OTP (constant-time HMAC comparison; a correct code is consumed; 5 wrong guesses delete it) → in a transaction, stores the new password, clears `mustChangePassword`, rotates the security stamp and deletes all refresh tokens.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 401 | `Invalid or expired OTP. Please request a new password reset OTP.` | Unknown username, wrong/expired/used code, or too many wrong guesses. |

<a id="ep-auth-change-password"></a>
### `PATCH /auth/change-password`

Change the logged-in user's password. Returns a new token pair, because all existing sessions, including the current one, are ended.

**Access:** Any authenticated user · **Rate limit:** 5/min per IP · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `currentPassword` | string | Required, 1–128. |
| `newPassword` | string | Required, 12–128, must differ from `currentPassword`. |
| `confirmPassword` | string | Required, must equal `newPassword`. |
| `otp` | string | Optional, exactly 6 digits. **Required on the second call for super admins**; ignored for other roles. |

```json
{ "currentPassword": "MyCurrentSecurePassword123", "newPassword": "MyNewSecurePassword123", "confirmPassword": "MyNewSecurePassword123" }
```

**Responses**

Password changed:

```json
{
  "message": "Password changed successfully",
  "data": { "otpRequired": false, "tokens": { "accessToken": "eyJhbGciOi…", "refreshToken": "77ad…" } }
}
```

Super admin, first call without `otp` (a code is emailed):

```json
{ "message": "OTP sent to your registered email", "data": { "otpRequired": true } }
```

**Business logic**
1. Verifies `currentPassword`.
2. **Super admins only:** without `otp`, emails a code (60 s cooldown) and stops. With `otp`, verifies it.
3. In a transaction: stores the new hash, clears `mustChangePassword`, rotates the security stamp, deletes all refresh tokens and starts a new session. The token used for this call stops working; switch to the returned tokens.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 400 | `newPassword: New password must differ from the current one` | Same as `currentPassword`. |
| 401 | `Invalid token. Please login again` | The user no longer exists. |
| 403 | `Current password is incorrect` | Wrong `currentPassword`. |
| 403 | `Invalid or expired OTP` | Super admin sent a wrong/expired code. |
| 429 | `Please wait 60 seconds before requesting another code` | Super admin asked for a new code too soon. |

<a id="ep-auth-logout"></a>
### `POST /auth/logout`

End the session the request was made with.

**Access:** Any authenticated user · **Success:** `204 No Content` (empty body) · **Body:** none

**Business logic:** puts the access token's `sid` on a Redis blocklist (`blocked_access_token:<sid>`) for the rest of the token's lifetime and deletes the session's refresh token. Other sessions of the user are unaffected.

<a id="ep-auth-revoke"></a>
### `DELETE /auth/users/:id/sessions`

Log a user out of every device.

**Access:** `super_admin` · **Success:** `200`

**Path parameters**

| Name | Rules |
| --- | --- |
| `id` | User id, 24 hex characters (`id: Must be a valid ID`). |

**Response**

```json
{ "message": "User logged out from all devices successfully" }
```

**Business logic:** in a transaction, rotates the user's security stamp (invalidating all their access tokens) and deletes all their refresh tokens.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 404 | `User not found` | No user with that id. |

<a id="ep-auth-me"></a>
### `GET /auth/me`

The logged-in user.

**Access:** Any authenticated user · **Success:** `200`

**Response**

```json
{
  "message": "Current user information retrieved successfully",
  "data": { "id": "665f1c2e8b3e4a1d2c9f0a13", "username": "jane-doe-k3x9q", "email": "jane.doe@mail.com", "role": "driver", "status": "active", "mustChangePassword": false }
}
```

**Business logic:** returns the user the guard loaded, reduced to the fields above. `fullName` and `organization` are **not** included; use [`GET /users/me/organization`](#ep-users-org) for the organization.

---

<a id="users-endpoints"></a>
## Users endpoints

Source: `src/modules/users/`. All routes require a token.

<a id="ep-users-list"></a>
### `GET /users`

List users, newest first.

**Access:** `super_admin` · **Success:** `200`

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `role` | string | Optional. One of the [roles](#domain-reference). |
| `organizationId` | string | Optional ObjectId (`organizationId: Must be a valid ID`). |
| `page` | integer | ≥ 1, default 1. |
| `limit` | integer | 1–100, default 20. |

**Response.** Documents are serialized directly, so items have both `_id` and `id`. Only these fields are selected; the password hash and security stamp are never included.

```json
{
  "message": "Users",
  "data": [
    {
      "_id": "665f1c2e8b3e4a1d2c9f0a13",
      "username": "jane-doe-k3x9q",
      "fullName": "Jane Doe",
      "email": "jane.doe@mail.com",
      "status": "active",
      "organization": "665f1c2e8b3e4a1d2c9f0a12",
      "role": "driver",
      "createdAt": "2026-10-22T09:30:00.000Z",
      "id": "665f1c2e8b3e4a1d2c9f0a13"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 57 }
}
```

**Business logic:** filters by `role` and/or `organization`, sorts by `createdAt` descending, and runs the page query and the total count in parallel.

<a id="ep-users-full-name"></a>
### `PATCH /users/me/full-name`

Change the logged-in user's full name (shown to evaluators and in reports).

**Access:** Any authenticated user · **Success:** `200`

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `fullName` | string | Required, trimmed, 2–100 characters (`Full name is too short` / `Full name is too long`). |

```json
{ "fullName": "Youssef Nabil" }
```

**Response**

```json
{ "message": "Full name updated successfully", "data": { "fullName": "Youssef Nabil" } }
```

**Errors:** `404 User not found` if the user no longer exists.

<a id="ep-users-deletion"></a>
### `POST /users/me/deletion-request`

Ask for the logged-in user's account and data to be deleted.

**Access:** Any authenticated user · **Success:** `200` · **Body:** none

**Responses**

```json
{ "message": "Your deletion request was recorded" }
```

```json
{ "message": "Your deletion request was already recorded" }
```

**Business logic:** sets `deletionRequestedAt` to now only if it is still `null`, so repeating the request keeps the first date. Nothing in the codebase acts on these requests yet; no deletion job or admin endpoint exists.

<a id="ep-users-org"></a>
### `GET /users/me/organization`

The organization the logged-in user belongs to.

**Access:** Any authenticated user · **Success:** `200`

**Response**

```json
{
  "message": "Organization",
  "data": { "id": "665f1c2e8b3e4a1d2c9f0a12", "name": "Cairo Driving School", "organizationType": "driving_school" }
}
```

`data` is `null` for super admins (no organization) and if the referenced organization no longer exists.

**Errors:** `404 User not found` if the user no longer exists.

---

<a id="organizations-endpoints"></a>
## Organizations endpoints

Source: `src/modules/organizations/`. Organization types and the roles they give:

| `organizationType` | Owner role (on create) | Employee role (on invite) |
| --- | --- | --- |
| `driving_school` | `school_administrator` | `driver_instructor` |
| `fleet_company` | `fleet_manager` | `fleet_analyst` |
| `insurance_company` | `insurance_manager` | `insurance_analyst` |

Invited users (owners, employees, drivers) are created with a random unusable password, `status: waiting_for_activation`, `mustChangePassword: true` and a username generated from their email. They receive the [activation email](#account-lifecycle). Emails are unique **per organization** (`{ email, organization }` unique index); usernames are globally unique.

<a id="ep-org-list"></a>
### `GET /organizations`

List all organizations, sorted by name.

**Access:** **Public** (no token) · **Success:** `200`

**Query** (strict): `page` (≥ 1, default 1), `limit` (1–100, default 20).

**Response.** Documents are serialized directly.

```json
{
  "message": "Organizations",
  "data": [
    {
      "_id": "665f1c2e8b3e4a1d2c9f0a12",
      "name": "Cairo Driving School",
      "organizationOwner": "665f1c2e8b3e4a1d2c9f0a14",
      "organizationType": "driving_school",
      "createdAt": "2026-10-22T09:30:00.000Z",
      "id": "665f1c2e8b3e4a1d2c9f0a12"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

<a id="ep-org-create"></a>
### `POST /organizations`

Create an organization and invite its owner.

**Access:** `super_admin` · **Success:** `201`

**Body.** Not strict: unknown keys are silently dropped.

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Required, trimmed, 2–100 characters. |
| `organizationType` | string | Required. `driving_school` \| `insurance_company` \| `fleet_company`. |
| `organizationOwner` | string | Optional ObjectId. Used only while the organization is first inserted; it is always replaced by the newly created owner (see the 409 below). |
| `fullName` | string | Owner's name. Required, trimmed, 2–100. |
| `email` | string | Owner's email. Required, trimmed, lowercased, valid email, ≤ 255. |
| `age` | number | Owner's age. Required **JSON number**, integer 18–100 (strings are rejected). |
| `gender` | string | Owner's gender. Required, `male` \| `female`. |

```json
{
  "name": "Cairo Driving School",
  "organizationType": "driving_school",
  "fullName": "Youssef Nabil",
  "email": "youssef.nabil@example.com",
  "age": 42,
  "gender": "male"
}
```

**Response.** The organization document (serialized directly). The owner's generated username is not included; a super admin can find it with [`GET /users?organizationId=…`](#ep-users-list).

```json
{
  "message": "Organization created successfully",
  "data": {
    "name": "Cairo Driving School",
    "organizationOwner": "665f1c2e8b3e4a1d2c9f0a14",
    "organizationType": "driving_school",
    "_id": "665f1c2e8b3e4a1d2c9f0a12",
    "createdAt": "2026-10-22T09:30:00.000Z",
    "updatedAt": "2026-10-22T09:30:00.000Z",
    "__v": 0,
    "id": "665f1c2e8b3e4a1d2c9f0a12"
  }
}
```

**Business logic**
1. **In a MongoDB transaction:** inserts the organization; creates the owner as an invited user with the type's owner role in that organization; sets `organizationOwner` to the new user.
2. **After the commit:** issues an 8-hour activation token and queues the invitation email, so a rolled-back owner is never emailed. If queueing fails, the organization and owner remain.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 409 | `Organization already exists` | A MongoDB duplicate key during the transaction, e.g. the unique, case-insensitive `{ name, organizationOwner }` index when `organizationOwner` is supplied and that owner already has an organization with this name. |
| 409 | `Email already exists` / `Username already exists` | Duplicate key while creating the owner. Unlikely, since the organization is new. |
| 500 | `Internal server error` | E.g. MongoDB isn't a replica set (transactions fail). |

<a id="ep-org-get"></a>
### `GET /organizations/:organizationId`

An organization with its members.

**Access:** `school_administrator`, `fleet_manager`, `insurance_manager` (and `super_admin`) · **Success:** `200`

**Path parameters:** `organizationId`, validated by `ParseObjectIdPipe`.

**Response.** Documents are serialized directly; each member is limited to `username`, `fullName`, `email`, `role`, `status` (plus `_id`/`id`).

```json
{
  "message": "Organization",
  "data": {
    "_id": "665f1c2e8b3e4a1d2c9f0a12",
    "name": "Cairo Driving School",
    "organizationOwner": "665f1c2e8b3e4a1d2c9f0a14",
    "organizationType": "driving_school",
    "createdAt": "2026-10-22T09:30:00.000Z",
    "updatedAt": "2026-10-22T09:30:00.000Z",
    "__v": 0,
    "organizationDrivers": [],
    "organizationEmployees": [
      { "_id": "665f1c2e8b3e4a1d2c9f0a14", "username": "youssef-nabil-m2q8z", "fullName": "Youssef Nabil", "email": "youssef.nabil@example.com", "status": "active", "role": "school_administrator", "id": "665f1c2e8b3e4a1d2c9f0a14" },
      { "_id": "665f1c2e8b3e4a1d2c9f0a13", "username": "jane-doe-k3x9q", "fullName": "Jane Doe", "email": "jane.doe@mail.com", "status": "active", "role": "driver", "id": "665f1c2e8b3e4a1d2c9f0a13" }
    ],
    "id": "665f1c2e8b3e4a1d2c9f0a12"
  }
}
```

> **Actual behaviour vs. the Swagger description** ("drivers" and "employees except drivers"):
> - `organizationDrivers` is **always an empty array**. Its virtual uses `foreignField: 'User'`, a field that doesn't exist on users.
> - `organizationEmployees` contains **every user of the organization, drivers included**. Its virtual has no role filter.
> - Member order isn't guaranteed (both virtuals sort on `occurredAt`, which users don't have).
> - The code does **not** check that the caller belongs to (or owns) this organization: any user with an owner role can read any organization.

**Errors:** `400` invalid id; `404 Organization not found`.

<a id="ep-org-invite-employee"></a>
### `POST /organizations/:organizationId/employees`

Invite an employee into an organization. The role comes from the organization type (driver instructor, fleet analyst or insurance analyst), never from the body.

**Access:** `school_administrator`, `fleet_manager`, `insurance_manager` (and `super_admin`) · **Success:** `201`

**Path parameters:** `organizationId` (`ParseObjectIdPipe`).

**Body** (strict)

| Field | Type | Rules |
| --- | --- | --- |
| `fullName` | string | Required, trimmed, 2–100. |
| `email` | string | Required, trimmed, lowercased, valid, ≤ 255. |
| `age` | number | Required JSON number, integer 18–100. |
| `gender` | string | Required, `male` \| `female`. |

```json
{ "fullName": "Jane Doe", "email": "jane.doe@mail.com", "age": 29, "gender": "female" }
```

**Response**

```json
{
  "message": "Employee invited successfully",
  "data": {
    "id": "665f1c2e8b3e4a1d2c9f0a15",
    "username": "jane-doe-k3x9q",
    "fullName": "Jane Doe",
    "email": "jane.doe@mail.com",
    "role": "driver_instructor",
    "status": "waiting_for_activation"
  }
}
```

**Business logic:** loads the organization → creates the invited user with the employee role → issues the activation token and queues the invitation email. Not transactional. The code does **not** check that the caller owns this organization.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 404 | `Organization not found` | No organization with that id. |
| 409 | `Email already exists` | The email is already used in this organization. |
| 409 | `Username already exists` | Generated-username collision on insert (unlikely; the service retries known collisions first). |

<a id="ep-org-invite-driver"></a>
### `POST /organizations/:organizationId/drivers`

Invite a driver into an organization. Identical to the [employee invite](#ep-org-invite-employee) except that the role is always `driver` and the message is `Driver invited successfully`.

**Access:** `school_administrator`, `fleet_manager`, `insurance_manager` (and `super_admin`) · **Success:** `201`

```json
{
  "message": "Driver invited successfully",
  "data": { "id": "665f1c2e8b3e4a1d2c9f0a13", "username": "omar-ali-p4t1c", "fullName": "Omar Ali", "email": "omar.ali@mail.com", "role": "driver", "status": "waiting_for_activation" }
}
```

---

<a id="instructors-endpoints"></a>
## Instructors endpoints

Source: `src/modules/instructors/`. Instructors are users with `role: driver_instructor`, stored in the `users` collection through a Mongoose discriminator that adds `drivingStudents` (driver ids).

<a id="ep-instructors-assign"></a>
### `POST /instructors/:instructorId/students/:driverId`

Add a driver to an instructor's students. Both must be in the caller's driving school.

**Access:** `school_administrator` · **Success:** `201` · **Body:** none

**Path parameters:** `instructorId`, `driverId` (both `ParseObjectIdPipe`).

**Response**

```json
{ "message": "Driver assigned to instructor successfully" }
```

**Business logic**
1. Takes the organization from the logged-in user. A super admin passes the role check but has no organization, so they get `404 Resource not found`.
2. Finds a user with that id, `role: driver` and the caller's organization.
3. Atomically adds the driver to `drivingStudents` (`$addToSet`) of the instructor with that id in the caller's organization. Assigning an existing student changes nothing.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 404 | `Resource not found` | Caller has no organization (super admin) or the wrong role. |
| 404 | `Driver not found in this organization` | Not a driver of the caller's organization. |
| 404 | `Instructor not found in this organization` | Not a `driver_instructor` of the caller's organization. |

---

<a id="trips-endpoints"></a>
## Trips endpoints (driver dashboards)

Source: `src/modules/trips/trips.controller.ts`, `trips.service.ts`, `trips.repository.ts`.

**Access for every route in this section:** `driver` (and `super_admin`), set on the controller.

> **Ownership is not checked.** The `:tripId` and `:driverId` path parameters are used as given; the code doesn't check that the trip or driver belongs to the logged-in driver. Only the `me/...` routes are scoped to the caller.

**Scoring rules used below** (`trip-scoring.ts`):
- A trip's `score` is `max(0, 100 − Σ pointsDeducted)`, rounded to 1 decimal. Measurements and `score` are `null` until the trip is processed.
- `risk` (a virtual): `low` for score ≥ 85, `medium` for 65–84.9, `high` below 65, `null` when unscored.
- "Scored trips" means `status: completed` with a non-null `score`.

All `:tripId` / `:driverId` params here are validated by `ParseObjectIdPipe`.

<a id="ep-trips-filtered"></a>
### `GET /trips/filteredTrips/:driverId`

A driver's trips matching the filters, newest first and paginated, each with its incidents.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `status` | string | Optional [trip status](#domain-reference). |
| `eventType` | string | Optional [incident type](#domain-reference). Only incidents of this type are attached, and trips without any are omitted. |
| `from`, `to` | string | Optional ISO 8601 date-times on `startedAt` (`Z` or an offset; date-only strings are rejected with `Invalid ISO datetime`). `from` must be ≤ `to` (`` from: `from` must be before `to` ``). |
| `page` | integer | ≥ 1, default 1. |
| `limit` | integer | 1–100, default 20. |

Example: `GET /trips/filteredTrips/665f1c2e8b3e4a1d2c9f0a13?status=completed&eventType=speeding&from=2026-10-01T00:00:00Z&page=1&limit=10`

**Response.** A **bare JSON array** (no `message`/`data`/`meta` envelope), containing the raw aggregation output: every stored trip field, including the motion-reading arrays (which can hold thousands of entries) and `__v`, without the `id`/`risk` virtuals, plus `incidents` (raw incident documents, chronological).

```json
[
  {
    "_id": "6ad24e609609bf3649c97cdf",
    "code": "T-90012",
    "driver": "665f1c2e8b3e4a1d2c9f0a13",
    "organization": "665f1c2e8b3e4a1d2c9f0a12",
    "vehicle": "Toyota Corolla (AB12 CDE)",
    "status": "completed",
    "startedAt": "2026-10-08T12:18:00.000Z",
    "speedLimitKmh": 50,
    "durationSeconds": 1380,
    "distanceKm": 5.8,
    "averageSpeedKmh": 15.1,
    "topSpeedKmh": 58,
    "eventsCount": 1,
    "score": 95.2,
    "tripSpeedLimits": 45,
    "tripSpeeds": [{ "time": "2026-10-08T12:18:05.000Z", "speed": 22.5 }],
    "tripAccelerations": [{ "time": "2026-10-08T12:18:05.000Z", "acceleration": 1.2 }],
    "steeringWheelAngle": [{ "time": "2026-10-08T12:18:05.000Z", "steeringWheelAngle": -4.1 }],
    "createdAt": "2026-10-08T12:42:00.000Z",
    "updatedAt": "2026-10-08T12:42:00.000Z",
    "__v": 0,
    "incidents": [
      {
        "_id": "6ad24e7a9609bf3649c97d04",
        "trip": "6ad24e609609bf3649c97cdf",
        "driver": "665f1c2e8b3e4a1d2c9f0a13",
        "type": "speeding",
        "severity": "medium",
        "occurredAt": "2026-10-08T12:27:00.000Z",
        "location": { "latitude": 31.2001, "longitude": 29.9187 },
        "speedKmh": 58,
        "clipUrl": null,
        "clipPublicId": null,
        "pointsDeducted": 4.8,
        "createdAt": "2026-10-08T12:42:00.000Z",
        "updatedAt": "2026-10-08T12:42:00.000Z",
        "__v": 0
      }
    ]
  }
]
```

**Business logic:** aggregation `$match` (driver, status, `startedAt` range) → `$lookup` incidents (filtered by `eventType`, sorted by `occurredAt`) → drop trips without incidents when `eventType` is set → sort `startedAt` desc → skip/limit. No total count is returned.

<a id="ep-trips-overall"></a>
### `GET /trips/tripOverall/:tripId`

The trip page's overall stats card.

```json
{
  "message": "Trip overall data",
  "data": { "durationMs": 1380000, "distanceKm": 5.8, "averageSpeedKmh": 15.1, "topSpeedKmh": 58, "eventsCount": 1, "score": 95.2, "risk": "low" }
}
```

`durationMs` is `durationSeconds × 1000`. Any field can be `null` for an unprocessed trip. **Errors:** `404 Trip not found`.

<a id="ep-trips-detected"></a>
### `GET /trips/detectedEvents/:tripId`

The trip's detected events, chronological.

```json
{
  "message": "Detected events",
  "data": [
    { "type": "speeding", "severity": "medium", "occurredAt": "2026-10-08T12:27:00.000Z", "pointsDeducted": 4.8 }
  ]
}
```

`pointsDeducted` is positive (display it as −4.8). An unknown trip id returns an empty array (no 404).

<a id="ep-trips-motion"></a>
### `GET /trips/speedMotionGraph/:tripId`, `GET /trips/accelerationMotionGraph/:tripId`, `GET /trips/steeringMotionGraph/:tripId`

The stored speed, acceleration or steering-wheel readings for the motion graphs, in stored order.

| Route | `message` | Item shape |
| --- | --- | --- |
| `speedMotionGraph` | `Trip speed motion graph` | `{ "time": "2026-10-16T12:49:05.000Z", "speed": 42.5 }` (km/h) |
| `accelerationMotionGraph` | `Trip acceleration motion graph` | `{ "time": "…", "acceleration": 1.8 }` (m/s²) |
| `steeringMotionGraph` | `Trip steering motion graph` | `{ "time": "…", "steeringWheelAngle": -12.4 }` (degrees) |

```json
{ "message": "Trip speed motion graph", "data": [{ "time": "2026-10-16T12:49:05.000Z", "speed": 42.5 }] }
```

**Errors:** `404 Trip <tripId> not found`.

<a id="ep-trips-totals"></a>
### `GET /trips/me/totals`

The logged-in driver's totals over scored trips, plus the last trip's score.

```json
{
  "message": "Trip totals",
  "data": { "trips": 13, "distanceKm": 104.9, "durationSeconds": 15480, "lastTripScore": 90.4, "difference": 3.2 }
}
```

- `trips`, `distanceKm` (rounded to 2 decimals), `durationSeconds`: sums over scored trips; zeros when there are none.
- `lastTripScore`: the most recent scored trip's score, or `null`.
- `difference`: `lastTripScore` minus the average of the **5 most recent scored trips (the latest one included)**, rounded to 1 decimal; `null` without a scored trip.

<a id="ep-trips-recent"></a>
### `GET /trips/me/recent`

The logged-in driver's 6 most recent **scored** trips (newest first).

```json
{
  "message": "Recent trips",
  "data": [
    { "code": "T-90012", "vehicle": "Toyota Corolla (AB12 CDE)", "status": "completed", "startedAt": "2026-10-08T12:18:00.000Z", "distanceKm": 5.8, "score": 95.2, "risk": "low" }
  ]
}
```

> The Swagger summary says "planned ones included", but the query only returns `completed` trips with a score.

<a id="ep-trips-header"></a>
### `GET /trips/tripReportHeader/:tripId`

Trip report header fields.

```json
{
  "message": "Trip dashboard header",
  "data": { "startedAt": "2026-10-08T12:18:00.000Z", "durationSeconds": 1380, "vehicle": "Toyota Corolla (AB12 CDE)", "driverName": "Jane Doe" }
}
```

`driverName` is `null` if the driver's user document no longer exists. **Errors:** `404 Trip not found`.

<a id="ep-trips-incidents-count"></a>
### `GET /trips/incidentsCount/:tripId`

How many times each incident type happened in the trip. Every type is present, with 0 for the ones that didn't happen.

```json
{
  "message": "Trip incidents count",
  "data": {
    "harsh_braking": 1, "harsh_acceleration": 0, "speeding": 2, "poor_lateral_control": 0,
    "unsafe_following_distance": 0, "distraction": 0, "phone_usage": 1, "drowsiness": 0, "eye_closure": 0
  }
}
```

An unknown trip id returns all zeros (no 404).

<a id="ep-trips-statistics"></a>
### `GET /trips/tripStatistics/:tripId`

Trip report statistics.

```json
{
  "message": "Trip statistics",
  "data": { "durationSeconds": 1380, "distanceKm": 5.8, "averageSpeedKmh": 15.1, "topSpeedKmh": 58, "eventsCount": 1 }
}
```

**Errors:** `404 Trip not found`.

<a id="ep-trips-incident-analysis"></a>
### `GET /trips/incidentAnalysis/:tripId`

Count and total points lost for each incident type in the trip (all 9 types, in [enum order](#domain-reference), `totalDeduction` rounded to 1 decimal).

```json
{
  "message": "Incident analysis",
  "data": [
    { "incidentType": "harsh_braking", "count": 1, "totalDeduction": 3.4 },
    { "incidentType": "harsh_acceleration", "count": 0, "totalDeduction": 0 }
  ]
}
```

**Errors:** `404 Trip not found`.

<a id="ep-trips-progress-details"></a>
### `GET /trips/progressDetails/:driverId`

Data for the "My progress" cards. The shape mixes processed values and raw aggregation results:

```json
{
  "message": "Progress components data",
  "data": {
    "recentAverage": 87.24,
    "changeSinceStart": { "message": "Change since start", "data": { "change": 6.8 } },
    "longTermAverage": [{ "_id": null, "averageScore": 84.13 }],
    "bestTrip": [{ "_id": null, "bestScore": 98.5 }]
  }
}
```

| Field | Meaning |
| --- | --- |
| `recentAverage` | Average score of the 5 most recent scored trips (not rounded), or `null`. |
| `changeSinceStart` | A nested `{ message, data: { change } }` object. `change` = average of the 5 newest minus average of the 5 oldest scored trips, rounded to 1 decimal, or `null`. |
| `longTermAverage` | Raw aggregation **array**: the simple mean of all completed trips' scores (not the weighted long-term score of [`/drivers/:id/stats`](#ep-drivers-stats)). `[]` when the driver has no completed trips. |
| `bestTrip` | Raw aggregation **array** with the highest completed-trip score; `[]` when none. |

<a id="ep-trips-progress-graph"></a>
### `GET /trips/progressGraph/:driverId`

Scores of the driver's scored trips for the progress graph.

```json
{
  "message": "Progress graph data",
  "data": [
    { "trips": [ { "date": "2026-10-01T09:00:00.000Z", "score": 82.1 }, { "date": "2026-10-08T12:18:00.000Z", "score": 95.2 } ] }
  ]
}
```

`data` is an array with one object holding `trips`, or `[]` when there are none. The aggregation sorts on a `date` field that trip documents don't have, so **the order of `trips` isn't guaranteed**; sort client-side. For ordered data use [`GET /drivers/:driverId/score-history`](#ep-drivers-score-history).

---

<a id="trip-map-endpoints"></a>
## Trip map endpoints

Source: `src/modules/trips/trip-map.controller.ts`, `trip-map.service.ts`, `trip-route.ts`.

**Access:** any authenticated user (no `@AllowedRoles`). The service loads the trip's driver and organization but **does not perform an access check**, so any logged-in user can read any trip's map. `:tripId` is validated by `ParseObjectIdPipe`; an unknown trip returns `404 Trip not found`.

**How the route is built**
- GPS fixes are stored in the `triproutepoints` collection (`TripRoutePoint`, unique per `{ trip, recordedAt }`) and streamed in `recordedAt` order.
- Each point's speed limit is the one recorded for that point (`speedLimitSource: "route"`), else the trip's `speedLimitKmh` (`"trip"`), else `null`.
- `speedCategory`: `within_limit` (speed ≤ limit), `near_limit` (up to 10% over), `over_limit` (more), `unknown` (speed or limit missing).
- **Downsampling:** stride = ⌈point count / `maxPoints`⌉. Every stride-th point is kept, along with the last point and the points on both sides of every speed-category change, so colour boundaries never move.
- `segments` are runs of the same category as inclusive index ranges into `points`. Each segment ends on the next one's first point so the polylines join; fewer than 2 points give no segments.

<a id="ep-trip-map"></a>
### `GET /trips/:tripId/map`

Everything the trip map needs in one call.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `maxPoints` | integer | 2–10 000, default 2 000. Approximate number of route points to return. |

**Response**

```json
{
  "message": "Trip map data",
  "data": {
    "trip": {
      "id": "6ad24e609609bf3649c97cdf",
      "code": "T-90012",
      "status": "completed",
      "startedAt": "2026-10-16T12:00:00.000Z",
      "endedAt": "2026-10-16T12:05:00.000Z",
      "durationSeconds": 300,
      "distanceKm": 2.4,
      "speedLimitKmh": 35
    },
    "route": {
      "points": [
        { "latitude": 31.2001, "longitude": 29.9187, "recordedAt": "2026-10-16T12:00:00.000Z", "offsetSeconds": 0, "speedKmh": 30, "speedLimitKmh": 35, "speedLimitSource": "trip", "headingDeg": 87, "speedCategory": "within_limit" },
        { "latitude": 31.2004, "longitude": 29.9201, "recordedAt": "2026-10-16T12:00:05.000Z", "offsetSeconds": 5, "speedKmh": 37.5, "speedLimitKmh": 35, "speedLimitSource": "trip", "headingDeg": 88, "speedCategory": "near_limit" },
        { "latitude": 31.2007, "longitude": 29.9215, "recordedAt": "2026-10-16T12:00:10.000Z", "offsetSeconds": 10, "speedKmh": 41, "speedLimitKmh": 35, "speedLimitSource": "trip", "headingDeg": 88, "speedCategory": "over_limit" }
      ],
      "segments": [
        { "speedCategory": "within_limit", "startIndex": 0, "endIndex": 1 },
        { "speedCategory": "near_limit", "startIndex": 1, "endIndex": 2 }
      ],
      "totalPoints": 3,
      "downsampled": false
    },
    "incidents": [
      {
        "id": "6ad24e7a9609bf3649c97d04",
        "type": "speeding",
        "category": "driving_action",
        "severity": "medium",
        "occurredAt": "2026-10-16T12:00:10.000Z",
        "offsetSeconds": 10,
        "location": { "latitude": 31.2007, "longitude": 29.9215 },
        "speedKmh": 41,
        "speedLimitKmh": 35,
        "pointsDeducted": 4.5,
        "clipUrl": null
      }
    ],
    "timeline": {
      "drivingActions": [
        { "incidentId": "6ad24e7a9609bf3649c97d04", "type": "speeding", "severity": "medium", "occurredAt": "2026-10-16T12:00:10.000Z", "offsetSeconds": 10, "durationSeconds": null }
      ],
      "driverStates": []
    },
    "metadata": {
      "hasRoute": true,
      "hasIncidents": true,
      "incidentsWithoutLocation": 0,
      "speedUnit": "km/h",
      "coordinateSystem": "WGS84",
      "nearLimitTolerancePercent": 10
    }
  }
}
```

- `trip.endedAt` = `startedAt + durationSeconds` (`null` until processed).
- `offsetSeconds` is measured from `trip.startedAt`.
- `incidents` are all of the trip's incidents, chronological, including those without a `location` (show those on the timeline only).
- `timeline` splits incidents by category: `drivingActions` (harsh braking, harsh acceleration, speeding, poor lateral control, unsafe following distance) and `driverStates` (distraction, phone usage, drowsiness, eye closure). `durationSeconds` is always `null`.
- An incident's `speedLimitKmh` is the trip's limit.

<a id="ep-trip-route"></a>
### `GET /trips/:tripId/route`

Only the route part of the map, optionally for a time window.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `from`, `to` | string | Optional ISO 8601 date-times on the points' `recordedAt`. `from` ≤ `to`. |
| `maxPoints` | integer | 2–10 000, default 2 000. |

**Response:** `{ "message": "Trip route", "data": <route> }`, where `<route>` has exactly the shape of `data.route` in [`/map`](#ep-trip-map) (`points`, `segments`, `totalPoints`, `downsampled`). `totalPoints` counts the points in the requested window before downsampling, and `downsampled` is `true` when fewer points were returned than that.

<a id="ep-trip-incidents"></a>
### `GET /trips/:tripId/incidents`

The trip's incident markers, optionally filtered.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `eventType` | string | Optional incident type. |
| `severity` | string | Optional `low` \| `medium` \| `high`. |
| `sort` | string | `occurredAt` (default, chronological) \| `-pointsDeducted` (costliest first, then chronological). |
| `limit` | integer | Optional, 1–500. All of them when omitted. |

Example: `GET /trips/6ad24e609609bf3649c97cdf/incidents?sort=-pointsDeducted&limit=5`

**Response:** `{ "message": "Trip incidents", "data": [ … ] }`, where each item has exactly the shape of an item in `data.incidents` of [`/map`](#ep-trip-map).

---

<a id="incidents-endpoints"></a>
## Incidents endpoints

Source: `src/modules/incidents/`. `pointsDeducted` is stored as a positive number.

<a id="ep-incidents-significant"></a>
### `GET /incidents/significant`

The logged-in driver's 5 incidents that cost the most points in the last 60 days (the main dashboard's "most significant events").

**Access:** `driver` (and `super_admin`) · **Success:** `200`

```json
{
  "message": "Most significant events",
  "data": [
    { "id": "6ad24e7a9609bf3649c97d04", "tripId": "6ad24e609609bf3649c97cdf", "type": "phone_usage", "severity": "high", "occurredAt": "2026-10-02T12:49:00.000Z", "pointsDeducted": 23.8 }
  ]
}
```

<a id="ep-incidents-trip"></a>
### `GET /incidents/trip/:tripId`

A trip's incidents, most points deducted first (trip report dashboard).

**Access:** `driver` (and `super_admin`) · **Success:** `200`

**Path parameters:** `tripId` (`ParseObjectIdPipe`). **Query:** `limit` (documented in Swagger as a number).

> **`limit` currently has no effect.** The handler binds the whole query object to `limit` (`@Query()` with no key and no schema), so it's never validated, and because the value isn't a number neither Mongoose nor the MongoDB driver applies it. All of the trip's incidents are returned. This was traced through Mongoose 9 and the MongoDB 7 driver, not observed at runtime.

```json
{
  "message": "Top incidents for trip",
  "data": {
    "incidents": [
      { "_id": "6ad24e7a9609bf3649c97d04", "type": "speeding", "severity": "high", "occurredAt": "2026-10-02T12:49:00.000Z", "location": { "latitude": 31.2001, "longitude": 29.9187 }, "speedKmh": 52, "clipUrl": null, "pointsDeducted": 9.2 }
    ]
  }
}
```

The trip's ownership isn't checked. An unknown trip returns an empty list.

<a id="ep-incidents-type-totals"></a>
### `GET /incidents/tripIncidentsCount/:driverId`

Despite its name and Swagger summary ("a trip's incidents count"), this returns a **driver's all-time** incident count and points lost per type (the progress dashboard's "Where points are lost").

**Access:** `driver` (and `super_admin`) · **Path:** `driverId` (`ParseObjectIdPipe`; not checked against the caller)

```json
{
  "message": "All incidents for trip",
  "data": { "incidents": [ { "_id": "speeding", "count": 5, "totalDeduction": 22 }, { "_id": "harsh_braking", "count": 3, "totalDeduction": 9 } ] }
}
```

`_id` is the incident type. `totalDeduction` is rounded to a whole number. Types with no incidents are omitted, and the order isn't guaranteed.

<a id="ep-incidents-event-mix"></a>
### `GET /incidents/eventMix/:driverId`

A driver's all-time incident count per type (event-mix chart).

**Access:** `driver` (and `super_admin`) · **Path:** `driverId` (`ParseObjectIdPipe`; not checked against the caller)

```json
{
  "message": "All Event Mix",
  "data": { "incidents": [ { "_id": "speeding", "count": 5 }, { "_id": "drowsiness", "count": 1 } ] }
}
```

Types with no incidents are omitted, and the order isn't guaranteed.

<a id="ep-incidents-recent-counts"></a>
### `GET /incidents/recentCounts`

Incident count per type over the last 21 days, **across all drivers in the database** (not limited to the instructor's students or organization).

**Access:** `driver_instructor` (and `super_admin`) · **Success:** `200`

**Response.** A **bare array** (no envelope):

```json
[ { "_id": "speeding", "count": 41 }, { "_id": "harsh_braking", "count": 17 } ]
```

**Business logic:** the result is cached in Redis under `incidents:type-counts:21d` for 10 minutes and shared by all callers. Types with no incidents are omitted, and the order isn't guaranteed.

---

<a id="drivers-endpoints"></a>
## Drivers endpoints

Source: `src/modules/drivers/`. A driver's numbers across all their trips.

**Access for every route in this section:** any authenticated user (no `@AllowedRoles`).

**`:driverId`** is either `me` (the logged-in user) or a 24-hex ObjectId (Zod union; anything else is a `400`). Other ids aren't checked against the caller, so any authenticated user can read any driver's data.

<a id="ep-drivers-stats"></a>
### `GET /drivers/:driverId/stats`

The driver's headline numbers (dashboard score ring and cards, progress page).

```json
{
  "message": "Driver stats",
  "data": {
    "totals": { "trips": 13, "distanceKm": 104.9, "durationSeconds": 15480 },
    "lastTripScore": 90.4,
    "lastTripDifference": 3.2,
    "recentAverage": 87.2,
    "changeSinceStart": 6.8,
    "longTermScore": 84.1,
    "risk": "low",
    "bestTripScore": 98.5
  }
}
```

| Field | Definition |
| --- | --- |
| `totals` | Count, distance (2 decimals) and duration of scored trips; zeros when none. |
| `lastTripScore` | Latest scored trip's score. |
| `recentAverage` | Average of the 5 newest scored trips (1 decimal). |
| `lastTripDifference` | `lastTripScore − recentAverage` (1 decimal). |
| `changeSinceStart` | `recentAverage −` average of the 5 oldest scored trips (1 decimal). |
| `longTermScore` | Mean of trip scores weighted by `durationSeconds × e^(−ageDays / 30)` (1 decimal). |
| `risk` | Risk level of `longTermScore`. |
| `bestTripScore` | Highest completed-trip score. |

Every value except `totals` is `null` before the first scored trip.

<a id="ep-drivers-score-history"></a>
### `GET /drivers/:driverId/score-history`

One point per scored trip, oldest first (score-over-time chart).

```json
{
  "message": "Score history",
  "data": [ { "tripId": "6ad24e609609bf3649c97cdf", "code": "T-90012", "startedAt": "2026-10-08T12:18:00.000Z", "score": 95.2 } ]
}
```

<a id="ep-drivers-incident-summary"></a>
### `GET /drivers/:driverId/incidents/summary`

Count and points lost for **every** incident type (0 for types that didn't happen), in [enum order](#domain-reference).

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `days` | integer | Optional, 1–3650. How many days back; all time when omitted. |

```json
{
  "message": "Incidents per type",
  "data": [
    { "type": "harsh_braking", "count": 3, "totalDeduction": 12.4 },
    { "type": "harsh_acceleration", "count": 0, "totalDeduction": 0 }
  ]
}
```

`totalDeduction` is rounded to 1 decimal.

<a id="ep-drivers-incidents"></a>
### `GET /drivers/:driverId/incidents`

The driver's incidents across their trips.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `days` | integer | 1–365, default 60. |
| `sort` | string | `-occurredAt` (default, newest first) \| `-pointsDeducted` (costliest first, then newest). |
| `limit` | integer | 1–100, default 20. |

`?days=60&sort=-pointsDeducted&limit=5` gives the dashboard's "most significant events".

```json
{
  "message": "Driver incidents",
  "data": [ { "id": "6ad24e7a9609bf3649c97d04", "tripId": "6ad24e609609bf3649c97cdf", "type": "speeding", "severity": "medium", "occurredAt": "2026-10-08T12:27:00.000Z", "pointsDeducted": 4.8 } ]
}
```

---

<a id="coaching-endpoints"></a>
## Coaching endpoints

Source: `src/modules/fast-api/`. These routes proxy the external FastAPI coaching service.

<a id="ep-coaching"></a>
### `GET /drivers/:driverId/coaching/{tips | what-to-improve | what-went-well | recommendations}`

AI coaching for one driver.

**Access:** any authenticated user · **Path:** `driverId` = `me` or an ObjectId (not checked against the caller)

| Route | Upstream call | `message` |
| --- | --- | --- |
| `.../coaching/tips` | `GET {FASTAPI_URL}/coach/coachingTips?driverId=<id>` | `Coaching tips` |
| `.../coaching/what-to-improve` | `GET {FASTAPI_URL}/coach/whatToImprove?driverId=<id>` | `What to improve` |
| `.../coaching/what-went-well` | `GET {FASTAPI_URL}/coach/whatWentWell?driverId=<id>` | `What went well` |
| `.../coaching/recommendations` | `GET {FASTAPI_URL}/coach/recommendations?driverId=<id>` | `Recommendations` |

Every upstream call sends `X-Service-Token: <SERVICE_TOKEN>` and times out after `FASTAPI_TIMEOUT_MS`.

**Response:** the upstream JSON is passed through unchanged as `data`:

```json
{ "message": "Coaching tips", "data": "<whatever the FastAPI service returned>" }
```

The shape of `data` is defined by the FastAPI service and **can't be determined from this codebase**. A comment in `reports.service.ts` says `/coach/recommendations` is currently a placeholder returning `{ success, message }`.

**Errors**

| Status | Message | When |
| --- | --- | --- |
| 502 | `The coaching service is unavailable` | Network error reaching FastAPI. |
| 502 | `The coaching service failed (<status>)` | FastAPI answered with a non-2xx status. |
| 504 | `The coaching service did not answer in time` | Timeout. |
| 500 | `Internal server error` | FastAPI answered 2xx with a body that isn't JSON (the parse error isn't caught). |

---

<a id="notifications-endpoints"></a>
## Notifications endpoints

Source: `src/modules/notifications/`. Each notification belongs to one `recipient`. The client builds the text from `type` and `params` in the user's language.

Notification document (returned directly, so `_id`, `id` and `__v` are present):

```json
{
  "_id": "6ad250019609bf3649c97e11",
  "recipient": "665f1c2e8b3e4a1d2c9f0a13",
  "type": "trip_report_ready",
  "trip": "6ad24e609609bf3649c97cdf",
  "incident": null,
  "params": { "tripCode": "T-90012", "score": 95 },
  "readAt": null,
  "createdAt": "2026-10-22T09:30:00.000Z",
  "updatedAt": "2026-10-22T09:30:00.000Z",
  "__v": 0,
  "id": "6ad250019609bf3649c97e11"
}
```

**Access for every HTTP route:** any authenticated user, always scoped to their own notifications.

<a id="ep-notifications-list"></a>
### `GET /notifications`

The logged-in user's notifications, newest first.

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `unread` | boolean string | Default `false`. `true`/`1`/`yes`/`on`/`y`/`enabled` or `false`/`0`/`no`/`off`/`n`/`disabled`. When true, only unread ones. |
| `page` | integer | ≥ 1, default 1. |
| `limit` | integer | 1–100, default 20. |

```json
{
  "message": "Notifications",
  "data": [
    {
      "_id": "6ad250019609bf3649c97e11",
      "recipient": "665f1c2e8b3e4a1d2c9f0a13",
      "type": "trip_report_ready",
      "trip": "6ad24e609609bf3649c97cdf",
      "incident": null,
      "params": { "tripCode": "T-90012", "score": 95 },
      "readAt": null,
      "createdAt": "2026-10-22T09:30:00.000Z",
      "updatedAt": "2026-10-22T09:30:00.000Z",
      "__v": 0,
      "id": "6ad250019609bf3649c97e11"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 4 }
}
```

<a id="ep-notifications-read-all"></a>
### `PATCH /notifications/read-all`

Mark every unread notification of the logged-in user as read.

```json
{ "message": "All notifications marked as read", "data": { "updated": 3 } }
```

`updated` is how many were unread.

<a id="ep-notifications-read"></a>
### `PATCH /notifications/:notificationId/read`

Mark one notification read. Idempotent: an already-read notification is returned unchanged, keeping its original `readAt`.

**Path:** `notificationId` (`ParseObjectIdPipe`)

```json
{
  "message": "Notification marked as read",
  "data": {
    "_id": "6ad250019609bf3649c97e11",
    "recipient": "665f1c2e8b3e4a1d2c9f0a13",
    "type": "trip_report_ready",
    "trip": "6ad24e609609bf3649c97cdf",
    "incident": null,
    "params": { "tripCode": "T-90012", "score": 95 },
    "readAt": "2026-10-22T10:02:00.000Z",
    "createdAt": "2026-10-22T09:30:00.000Z",
    "updatedAt": "2026-10-22T10:02:00.000Z",
    "__v": 0,
    "id": "6ad250019609bf3649c97e11"
  }
}
```

**Errors:** `404 Notification not found`. The notification doesn't exist or belongs to another user.

<a id="socket-gateway"></a>
### Socket.IO gateway

`NotificationsGateway` is declared with `@WebSocketGateway()` and no options, so it shares the HTTP server and port and uses Socket.IO's defaults (namespace `/`, path `/socket.io`, no CORS configuration).

**Authentication.** Send the access token in the handshake, either as `auth.token` or as an `Authorization` header:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', { auth: { token: `Bearer ${accessToken}` } });

// Guard and validation errors arrive on the "exception" event, with the HTTP error body
socket.on('exception', (err) => console.error(err)); // e.g. { message: 'Authorization token is required', error: 'Unauthorized', statusCode: 401 }

// Handler results come back as the acknowledgement
const result = await socket.emitWithAck('findAllUnreadUserNotifications');
```

A connection is **not** rejected at handshake time: a middleware only copies the token onto the socket. Instead, the global guards (rate limit, authentication, roles) and the validation pipe run on **every message**. None of the events below has a role restriction. **The server never pushes notifications on its own**: there is no `emit` anywhere in the gateway and no listener for any trip event, so clients must poll with the events below or with HTTP.

| Event | Payload | Acknowledgement |
| --- | --- | --- |
| `createNotification` | `{ recipient, type, trip?, incident?, params? }` (strict, see below) | `{ "message": "Notification created successfully", "data": <notification> }`, or on a database error `{ "message": "Error creating notification", "error": "<reason>" }` |
| `findAllUserNotifications` | none | `{ "message": "Notifications retrieved successfully", "data": [ <notification>, … ] }`: all, newest first, no pagination |
| `findAllUnreadUserNotifications` | none | `{ "message": "Unread notifications retrieved successfully", "data": [ … ] }` |
| `markNotificationAsRead` | Notification id string (24 hex) | `{ "message": "Notification marked as read successfully", "data": <notification> }`, or `{ "message": "Notification not found or already marked as read", "data": null }` |
| `markAllNotificationsAsReadForUser` | none | `{ "message": "All notifications marked as read successfully", "data": { "acknowledged": true, "modifiedCount": 3, … } }`, or `{ "message": "No unread notifications found for the user", "data": null }` |

`createNotification` payload rules:

| Field | Rules |
| --- | --- |
| `recipient` | Required user ObjectId. |
| `type` | Required: `trip_report_ready` \| `high_risk_event` \| `system_update`. |
| `trip` | ObjectId or `null` (default `null`). **Required** unless `type` is `system_update` (`trip: Trip reports and high-risk events need a trip`). |
| `incident` | ObjectId or `null` (default `null`). **Required** for `high_risk_event` (`incident: High-risk events need an incident`). |
| `params` | Object of string → string \| number (default `{}`). |

> `createNotification` lets **any authenticated user create a notification for any recipient**. The DTO comment says notifications are meant to be created only by the backend.

---

<a id="reports-endpoints"></a>
## Reports endpoints

Source: `src/modules/reports/`.

<a id="ep-reports-download"></a>
### `GET /reports/downloadReport`

The logged-in driver's performance report as a PDF, in English or Arabic (right-to-left).

**Access:** `driver` (and `super_admin`) · **Success:** `200`, `application/pdf`

**Query** (strict)

| Name | Type | Rules |
| --- | --- | --- |
| `language` | string | `en` (default) \| `ar` (`language: Invalid option: expected one of "en"\|"ar"`). |

**Response headers**

```
Content-Type: application/pdf
Content-Disposition: inline; filename="driver-report-en.pdf"
Content-Description: File Transfer
```

**PDF contents** (report period is always "All time"):

| Section | Source |
| --- | --- |
| Driver info | Full name, user id, generation date. |
| Overview | **Average score** = rounded simple mean of all completed trips' scores (not the weighted long-term score); **trips** = number of scored trips; **incidents** = all-time incident count; **driving time** = total minutes of scored trips. |
| Incident analysis | All-time count and points lost (whole numbers) per type that occurred. |
| Trip history | The 5 most recent `completed` trips: date, duration (min), score, status, incident count. |
| Recommendations | `GET {FASTAPI_URL}/coach/recommendations?driverId=<id>`, expected to return `{ "recommendations": string[] }`. Any failure or other shape results in "no recommendations" rather than failing the report. |

The PDF is rendered with `pdfmake-rtl` into a temporary directory, read into memory and the directory deleted.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" -o report.pdf "http://localhost:3000/reports/downloadReport?language=ar"
```

**Errors:** `500 Failed to generate driver report PDF` if rendering fails.

---

<a id="health-endpoints"></a>
## Health endpoints

Source: `src/modules/health/`. For load balancers, orchestrators and uptime monitors. **Public**, but rate limited like everything else. Responses use the `@nestjs/terminus` format, not the envelope.

<a id="ep-health"></a>
### `GET /health`

Whether the API can serve requests: pings MongoDB and does a write-then-read round trip in Redis (key `health:ping`, 10 s TTL). Each check times out after 1.5 s.

`200`:

```json
{
  "status": "ok",
  "info": { "mongodb": { "status": "up" }, "redis": { "status": "up" } },
  "error": {},
  "details": { "mongodb": { "status": "up" }, "redis": { "status": "up" } }
}
```

`503` when either check fails: `status` is `"error"` and the failing check appears under `error` with `"status": "down"`. Terminus may add a message to it.

<a id="ep-health-coaching"></a>
### `GET /health/coaching`

Whether the FastAPI coaching service answers (`POST {FASTAPI_URL}/health/health-check` with the service token, 3 s timeout). Kept separate so a coaching outage doesn't mark the whole API unhealthy.

`200`: `{ "status": "ok", "info": { "fastapi": { "status": "up" } }, "error": {}, "details": { "fastapi": { "status": "up" } } }`. `503` when it's down.

---

<a id="background-jobs-and-internals"></a>
## Background jobs and internals

| Mechanism | Details |
| --- | --- |
| **Mail queue** | `MailService.sendMail` adds a `send-mail` job to the BullMQ queue `mail`. `MailProcessor` sends it through a pooled Gmail transporter. 3 attempts with exponential backoff (5 s, 10 s, 20 s); completed jobs are removed (they contain OTPs/links); failed jobs are kept for 1 day. Invitation and OTP emails are sent this way, so an API response doesn't wait for SMTP. |
| **Refresh-token cleanup** | Cron `delete-expired-refresh-tokens` runs daily at 03:00 server time. Expired tokens are also deleted per user on each login, and a MongoDB TTL index on `expiresAt` removes them automatically. |
| **Transactions** | `TransactionService.run()` wraps work in `connection.transaction()`. Nested calls join the outer transaction. Mongoose's `transactionAsyncLocalStorage` makes queries inside use the session automatically. |
| **Trip ingestion** | `TripIngestionService` implements the in-vehicle upload flow (start trip, add GPS points / telemetry / incidents in idempotent batches, complete → measure, score and set `completed`, then emit `trip.completed`). **No route exposes it yet**, and no listener handles `trip.completed`. It imports types from `./trip-upload.dto`, which isn't in the repository. |
| **Redis keys** | `blocked_access_token:<sid>`, `one_time_token:<purpose>:<sha256>`, `otp:<purpose>:<userId>` (+ `:cooldown`), `incidents:type-counts:21d`, `health:ping`, plus BullMQ's keys. |
| **Indexes** | Created on startup (`autoIndex: true`): unique `username`; unique `{ email, organization }`; unique trip `code`; unique `{ trip, recordedAt }` for route points; unique case-insensitive `{ name, organizationOwner }` for organizations (when an owner is set); query indexes on trips, incidents and notifications. |

---

<a id="domain-reference"></a>
## Domain reference (enums)

| Enum | Values |
| --- | --- |
| User role | `super_admin`, `driver`, `fleet_manager`, `fleet_analyst`, `insurance_manager`, `insurance_analyst`, `driver_instructor`, `school_administrator` |
| User status | `active`, `inactive`, `waiting_for_activation` |
| Gender | `male`, `female` |
| Language | `en`, `ar` (stored on users, default `en`; no endpoint changes it) |
| Organization type | `driving_school`, `insurance_company`, `fleet_company` |
| Trip status | `completed`, `recording`, `uploading`, `processing`, `planned`, `failed` |
| Trip risk | `low` (≥ 85), `medium` (65–84.9), `high` (< 65) |
| Incident type (enum order) | `harsh_braking`, `harsh_acceleration`, `speeding`, `poor_lateral_control`, `unsafe_following_distance`, `distraction`, `phone_usage`, `drowsiness`, `eye_closure` |
| Incident category | `driving_action` (first five types), `driver_state` (last four) |
| Incident severity | `low`, `medium`, `high` |
| Speed category | `within_limit`, `near_limit`, `over_limit`, `unknown` |
| Speed limit source | `route`, `trip` |
| Notification type | `trip_report_ready`, `high_risk_event`, `system_update` |

---

<a id="known-caveats"></a>
## Known caveats

These are observations about the current code, documented so that callers aren't surprised. None of them were changed as part of this documentation.

**Access control**
1. **Many routes don't check ownership or relationship.**
   - The driver-dashboard trip routes that take `:tripId` or `:driverId`, all [trip map](#trip-map-endpoints) routes, `GET /incidents/trip/:tripId`, `tripIncidentsCount/:driverId`, `eventMix/:driverId`, all [drivers](#drivers-endpoints) routes and all [coaching](#coaching-endpoints) routes use the id from the path without checking it against the caller.
   - Owner roles can read any organization and invite users into any organization.
2. [`createNotification`](#socket-gateway) (Socket.IO) lets any authenticated user create notifications for any recipient.
3. [`GET /organizations`](#ep-org-list) is public and lists every organization.

**Responses that differ from Swagger or comments**

4. [`GET /organizations/:organizationId`](#ep-org-get): `organizationDrivers` is always empty and `organizationEmployees` includes drivers.
5. [`GET /trips/filteredTrips/:driverId`](#ep-trips-filtered) returns a bare array of raw documents (with motion arrays, without `risk`/`id`, with no pagination `meta`), not the enveloped `tripListItemSchema` Swagger describes.
6. [`GET /trips/me/recent`](#ep-trips-recent) returns only completed, scored trips (Swagger says planned ones are included).
7. [`GET /trips/progressDetails/:driverId`](#ep-trips-progress-details) nests a full `{ message, data }` object and raw aggregation arrays inside `data`.
8. [`GET /trips/progressGraph/:driverId`](#ep-trips-progress-graph) sorts on a non-existent field, so point order isn't guaranteed.
9. [`GET /incidents/trip/:tripId`](#ep-incidents-trip) ignores `limit`.
10. [`GET /incidents/tripIncidentsCount/:driverId`](#ep-incidents-type-totals) and [`/eventMix/:driverId`](#ep-incidents-event-mix) are per driver (all time), not per trip as their summaries say.
11. [`GET /incidents/recentCounts`](#ep-incidents-recent-counts) returns a bare array covering all drivers.
12. The PDF report's "average score" is a simple mean, while [`/drivers/:id/stats`](#ep-drivers-stats) uses the weighted long-term score.

**Missing or unused pieces**

13. The server never pushes notifications over Socket.IO, and nothing creates notifications except the `createNotification` event.
14. Deletion requests (`POST /users/me/deletion-request`) are recorded but never processed.
15. The invitation email doesn't include the generated username, and `POST /organizations` doesn't return the owner's username.
16. Trip ingestion has no HTTP routes (see [internals](#background-jobs-and-internals)).
17. `AppController` (`GET /` → "Hello World!") exists but isn't registered in any module, so `GET /` returns `404`. The e2e spec in `test/app.e2e-spec.ts` still expects "Hello World!".
18. `src/shared/interceptors` (`TransformInterceptor`, `TimeoutInterceptor`, `LoggingInterceptor`) and `src/shared/filters/HttpExceptionFilter` are never registered, and `src/shared/guards/*.ts` are empty, so none of them affect responses.
19. `@fastify/helmet` is a dependency but isn't registered, and CORS isn't enabled.
20. No endpoint sets a user to `inactive`, changes a user's `language`, or assigns an organization owner after creation (`OrganizationsService.assignOrganizationOwner` exists without a route).
