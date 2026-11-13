# Hospital Appointment Platform

A containerized doctor appointment scheduling API and responsive React/Vite CareFlow web application with separate patient, doctor, and hospital-admin dashboards, built as a DevOps and Cloud Engineering internship project for ALGIONS AI LABS PRIVATE LIMITED.

The project demonstrates reproducible builds, Docker Compose orchestration, API authentication and authorization, appointment conflict prevention, automated CI checks, local HTTPS reverse proxying, structured request logs, and database backup and restoration.

> **Scope:** This is a small appointment scheduling service using synthetic data, not a complete Hospital Information Management System (HIMS).

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Role Workflows](#role-workflows)
- [API Endpoints](#api-endpoints)
- [Security](#security)
- [Testing and CI](#testing-and-ci)
- [Database Backup and Restore](#database-backup-and-restore)
- [Operations and Recovery](#operations-and-recovery)
- [Ports](#ports)
- [Known Limitations](#known-limitations)
- [Repository Structure](#repository-structure)

## Architecture

```text
                 Local client / browser
                          |
             HTTPS https://localhost:8443
                          |
                  Nginx reverse proxy
                          |
                    Docker network
                          |
                  Node.js / Express API
                          |
                    MongoDB :27017
                          |
                  Persistent Docker volume

GitHub push / pull request
              |
       GitHub Actions CI
              |
   npm ci -> lint -> tests
              |
       Docker image build
```

The React/Vite frontend is built into the Nginx image and served as a single-page application. Nginx serves the frontend, proxies `/api/*` and `/health` to Express, and terminates local HTTPS. The API and database communicate over a dedicated Docker bridge network. MongoDB data is stored in the named `mongodb_data` volume. The preserved local `compose.override.yaml` removes MongoDB host-port exposure when Docker Desktop cannot bind port `27018`; the API still reaches MongoDB at `mongodb:27017` inside Compose.

The local HTTPS certificate is self-signed and intended for development and demonstration, not public production use.

## Technology Stack

- Node.js 22 and Express
- React 19 and Vite 7
- MongoDB 8 and Mongoose
- JWT authentication and role-based authorization
- Jest for automated tests
- ESLint for linting
- Docker and Docker Compose
- Nginx reverse proxy with local TLS
- GitHub Actions for continuous integration

## Prerequisites

Install the following:

- Git
- Docker Desktop with Docker Compose and Linux container support, or a compatible Docker Engine installation
- OpenSSL for generating a local development certificate
- Node.js 22 and npm if running the application or tests directly on the host

Commands below assume execution from the repository root. Shell syntax is shown as Bash unless a PowerShell command is specifically shown.

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Narayan03-t/hospital-appointment-platform.git
cd hospital-appointment-platform
```

### 2. Configure environment variables

Create the local environment file:

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Set `JWT_SECRET` to a randomly generated secret of at least 32 characters. Keep the actual secret private. Never commit `.env`. `SEED_DOCTOR_PASSWORD` is optional and creates the linked demo doctor account when using the seed script. Admin bootstrap variables are only used for the one-time command below.

Generate a secret locally if needed:

```bash
openssl rand -hex 32
```

Copy the generated value into `.env` using Nano. Do not publish the secret in terminal screenshots, issue reports, or documentation.

### 3. Generate a local HTTPS certificate

```bash
mkdir -p nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/certs/server.key \
  -out nginx/certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

The certificate and private key are local-only files and must not be committed.

### 4. Validate and start the stack

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Wait until MongoDB and the API report healthy. Nginx starts after the API health check succeeds.

### 5. Verify the service

```bash
curl -k -i https://localhost:8443/health
curl -k -i https://localhost:8443/api/doctors
```

The health endpoint should return HTTP 200 when the database connection is healthy. The doctors endpoint returns synthetic doctor records and the browser UI is available at `https://localhost:8443`. Because the local certificate is self-signed, the browser will display a certificate warning; accept it only for this local demonstration.

The `-k` option disables certificate verification for this local self-signed certificate only. Do not use this as a production TLS configuration.

## Configuration

The following variables are used by the application and Compose configuration:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime environment |
| `PORT` | API listening port; defaults to `3000` in the container |
| `MONGODB_URI` | MongoDB connection URI |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `BOOTSTRAP_ADMIN_NAME` | One-time admin display name |
| `BOOTSTRAP_ADMIN_EMAIL` | One-time admin email |
| `BOOTSTRAP_ADMIN_PASSWORD` | One-time admin password; never commit it |

See `.env.example` for the starter configuration. Use a strong, private `JWT_SECRET` for every environment. Never store real secrets in Git.

The optional seed script requires `SEED_PATIENT_PASSWORD` and `SEED_ADMIN_PASSWORD`, each at least 12 characters long, and optionally `SEED_DOCTOR_PASSWORD`. It is restricted to a host MongoDB URI on `localhost` or `127.0.0.1` port `27018`; it is not the normal Compose startup path. Set these values locally only if seeding is needed; do not publish them.

Create one admin account without modifying existing records:

```bash
$env:BOOTSTRAP_ADMIN_NAME="Hospital Administrator"
$env:BOOTSTRAP_ADMIN_EMAIL="admin@example.test"
$env:BOOTSTRAP_ADMIN_PASSWORD="use-a-private-12-character-password"
docker compose exec -T -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_PASSWORD api npm run bootstrap:admin
```

The command refuses to modify an existing email address. Remove the temporary shell variables after use and do not place real credentials in `.env.example`.

## Role Workflows

### Patient

Public registration creates patient accounts only. After login, patients can search available doctors by name or specialty, submit a future appointment request with a reason, view their appointment list, and cancel pending, approved, or confirmed appointments. The request starts as `pending`.

### Doctor

An admin creates a linked doctor login and profile. A doctor can view requests assigned to that profile, configure future availability slots, and approve or reject pending requests. If explicit slots exist, approval is limited to those exact times. Approval changes the request to `approved`; rejection changes it to `rejected` and can store a rejection reason.

### Hospital admin

Admins use the protected admin dashboard to view counts, search doctors and patients, create or edit linked doctor profiles, activate or deactivate doctor/patient accounts, and filter appointment reports. Admins cannot make appointment decisions on behalf of doctors. Public registration cannot create admin accounts; use the one-time environment-driven bootstrap command above.

### Notifications and status

Submitting a request creates a persisted notification for the linked doctor. A doctor decision creates a persisted notification for the patient. Notifications expose read/unread state and can be marked individually or all at once. Appointment records persist the current status (`pending`, `approved`, `confirmed`, `rejected`, `cancelled`, or `completed`) and timestamps; the application does not maintain a separate status-transition history collection.

Approvals and legacy confirmed bookings are protected by a MongoDB unique partial index on doctor and appointment time. If concurrent requests target the same active slot, one can succeed and the other receives HTTP 409 Conflict.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Application and database health |
| GET | `/` | API root information |
| POST | `/api/auth/register` | Register a patient |
| POST | `/api/auth/login` | Authenticate and obtain a JWT |
| GET | `/api/doctors` | List doctors |
| POST | `/api/doctors` | Create a basic doctor profile; admin role required |
| POST | `/api/appointments` | Create a confirmed appointment; patient role required |
| POST | `/api/appointments/request` | Submit a pending appointment request; patient role required |
| GET | `/api/appointments/my` | List the authenticated patient's appointments |
| PATCH | `/api/appointments/:id/cancel` | Cancel the patient's pending, approved, or confirmed appointment |
| PATCH | `/api/appointments/:id/reschedule` | Reschedule the patient's confirmed appointment |
| GET | `/api/doctor/appointments` | List appointments for the linked doctor account |
| PATCH | `/api/doctor/appointments/:id/decision` | Approve or reject a pending request |
| PUT | `/api/doctor/slots` | Replace the linked doctor's available slots |
| GET | `/api/doctor/slots` | Read the linked doctor's available slots |
| GET | `/api/notifications` | List the authenticated user's notifications |
| PATCH | `/api/notifications/:id/read` | Mark one notification as read |
| PATCH | `/api/notifications/read-all` | Mark all notifications as read |
| GET | `/api/admin/stats` | Admin-only hospital counts |
| GET | `/api/admin/doctors` | Admin-only doctor profiles and account status |
| POST | `/api/admin/doctors` | Admin-only linked doctor account creation |
| PATCH | `/api/admin/doctors/:id` | Admin-only doctor profile edit |
| GET | `/api/admin/patients` | Admin-only patient records |
| PATCH | `/api/admin/accounts/:id/status` | Admin-only doctor/patient activation |
| GET | `/api/admin/appointments` | Admin-only appointment reporting/filtering by status, doctorId, patientId, from, and to |

Protected endpoints require a bearer token:

```text
Authorization: Bearer <JWT>
```

Registration is restricted to the patient role. The admin dashboard's doctor-creation endpoint (`POST /api/admin/doctors`) creates both a doctor login and linked profile; the simpler `POST /api/doctors` endpoint creates only a doctor profile. Appointment operations require an authenticated patient. Doctor request management requires an active `doctor` user linked to a `Doctor` document through its `user` field. Admin APIs are independently protected by the `admin` role; admins can manage records and report on appointments but cannot make doctor decisions. Notifications are persisted in MongoDB and expose unread/read state.

Booking and rescheduling validate identifiers and future appointment times. A unique partial MongoDB index named `doctor_active_appointment_slot` on doctor and appointment time for `approved` and `confirmed` appointments prevents conflicting active bookings. Duplicate-key errors are mapped to HTTP 409 Conflict.

## Security

Implemented controls include:

- JWT authentication and role-based authorization
- Password hashing with bcrypt
- Request body size limits
- HTTP security headers through Helmet
- API rate limiting
- Restricted host binding for MongoDB
- A dedicated Compose bridge network
- A non-root API container user
- Local TLS termination at Nginx
- Structured HTTP request logs that avoid logging request bodies and authentication tokens
- Environment-based secret configuration

The local certificate is self-signed. Public deployment requires a trusted certificate, appropriate network controls, production secret management, and environment-specific security review.

## Testing and CI

Run the checks locally:

```bash
npm ci
npm run lint
npm test
npm ci --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
docker compose config --quiet
docker compose build
```

The preserved `compose.override.yaml` removes the MongoDB host port mapping for environments where Docker Desktop cannot bind `127.0.0.1:27018`. Keep that override in place for the current local setup; MongoDB remains reachable by the API on the internal Compose network and the named `mongodb_data` volume is preserved.

The primary demo workflow is:

1. Register/login as a patient at `https://localhost:8443`.
2. Select a doctor and submit a future appointment request.
3. Login with a linked doctor account and approve or reject it.
4. Return to the patient account and open Notifications.

The GitHub Actions workflow is `.github/workflows/ci.yml`. It runs on pushes and pull requests targeting `main`, installs dependencies, runs lint and tests, and builds a Docker image tagged with the commit SHA.

Repository: https://github.com/Narayan03-t/hospital-appointment-platform

Workflow runs: https://github.com/Narayan03-t/hospital-appointment-platform/actions

The current workflow builds an image but does not publish it to a container registry. The image tag used in CI is based on the Git commit SHA.

## Database Backup and Restore

MongoDB data persists in the named `mongodb_data` volume.

### Create a compressed backup

Create the backup directory if needed:

```bash
mkdir -p backups
```

Create a timestamped archive without committing the archive to Git:

```bash
docker compose exec -T mongodb mongodump \
  --db hospital_appointments \
  --archive \
  --gzip > backups/hospital_appointments_$(date +%Y%m%d_%H%M%S).archive.gz
```

Verify archive integrity:

```bash
gzip -t backups/<backup-file>.archive.gz
sha256sum backups/<backup-file>.archive.gz
```

Replace `<backup-file>` with the actual archive filename.

### Restore to a separate test database

Test restoration without overwriting the active application database:

```bash
docker compose exec -T mongodb mongorestore \
  --archive \
  --gzip \
  --nsFrom='hospital_appointments.*' \
  --nsTo='hospital_restore_test.*' \
  < backups/<backup-file>.archive.gz
```

Verify the restored collections and document counts using `mongosh`. A restore to the separate test database is safer for validation than overwriting live application data.

For a production recovery, stop or isolate writes, verify the target database and backup, take an additional backup if appropriate, and follow a reviewed restore plan. Do not run destructive restore operations against the active database without explicit confirmation.

**Evidence note:** Record the actual backup filename, SHA-256 checksum, restored collection counts, and command output from the run performed during testing. Keep database archives out of the public repository.

## Operations and Recovery

### Inspect service status

```bash
docker compose ps
```

### View logs

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 mongodb
docker compose logs --tail=100 nginx
```

API request logs are JSON and include the HTTP method, path, status code, duration, and timestamp.

### Restart a service

```bash
docker compose restart api
```

Verify recovery:

```bash
docker compose ps
curl -k -i https://localhost:8443/health
```

### Recover a stopped API container

```bash
docker compose up -d api
docker compose ps
curl -k -i https://localhost:8443/health
```

An explicit `docker compose kill api` is a manual stop action; it does not demonstrate automatic restart recovery under the `unless-stopped` policy. The documented recovery drill uses `docker compose up -d api` and verifies the health endpoint afterwards.

### Validate Compose configuration

```bash
docker compose config --quiet
```

Avoid printing the fully resolved Compose configuration to shared logs if it may contain interpolated secrets.

### Roll back

The CI image is tagged with a commit SHA, but the current workflow does not push images to a registry. A rollback therefore requires a previously retained, verified local image or rebuilding the chosen known-good commit.

Before a rollback, record the current commit and image identifier, verify the target version, and preserve a database backup. Database schema or data changes may not be backward-compatible with an older application image.

## Ports

| Component | Container port | Host exposure |
|---|---:|---|
| Nginx HTTPS | 443 | `127.0.0.1:8443` |
| API | 3000 | Internal Compose network only |
| MongoDB | 27017 | Internal Compose network only; the override removes host exposure |

The API is reached through Nginx. MongoDB is bound to loopback and should not be exposed directly to the public internet.

HTTP port 80 is not configured; requests should use `https://localhost:8443` in the current local setup.

## Known Limitations

- The HTTPS certificate is self-signed and suitable only for local demonstration.
- The CI workflow builds but does not publish a versioned image to a registry.
- The deployment currently runs locally using Docker Compose at `https://localhost:8443`; a public cloud deployment has not been demonstrated by this setup.
- Monitoring dashboards and metrics export have not been verified as implemented.
- Backup and restoration have been tested locally; this is not a substitute for off-host, encrypted, retention-managed backups.
- Appointment conflict protection is implemented through a MongoDB unique partial index covering approved and confirmed appointments; production behavior should also be tested under concurrent requests against a real running database.
- The legacy confirmed-slot index is preserved and the expanded approved/confirmed index uses a new name, avoiding destructive index migration on existing volumes.
- The service uses synthetic records only. Do not add real patient data or other sensitive information.
- Email notifications via SMTP and clinical record integrations are not implemented; persisted in-app notifications are the supported notification channel.

## Repository Structure

```text
.
├── .github/workflows/ci.yml
├── src/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── server.js
├── frontend/
│   ├── src/
│   └── package.json
├── tests/
├── scripts/seed.js
├── scripts/bootstrapAdmin.js
├── nginx/
│   ├── conf.d/hospital.conf
│   └── certs/                 # local-only, ignored by Git
├── backups/                   # local-only backup archives
├── Dockerfile
├── compose.yaml
├── .env.example
└── README.md
```

This README describes the current local implementation and should be updated whenever implementation or deployment behavior changes.
