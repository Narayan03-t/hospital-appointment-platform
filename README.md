# Hospital Appointment Platform

A containerized doctor appointment scheduling API built as a DevOps and Cloud Engineering internship project for ALGIONS AI LABS PRIVATE LIMITED.

The project demonstrates reproducible builds, Docker Compose orchestration, API authentication and authorization, appointment conflict prevention, automated CI checks, local HTTPS reverse proxying, structured request logs, and database backup and restoration.

> **Scope:** This is a small appointment scheduling service using synthetic data, not a complete Hospital Information Management System (HIMS).

## Table of Contents

- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
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
                     HTTPS :443
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

The API and database communicate over a dedicated Docker bridge network. MongoDB data is stored in a named volume. The API is exposed to local clients through Nginx over HTTPS; the MongoDB host port is bound to loopback.

The local HTTPS certificate is self-signed and intended for development and demonstration, not public production use.

## Technology Stack

- Node.js 22 and Express
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

Commands below assume a Bash-compatible terminal and execution from the repository root.

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

Set `JWT_SECRET` to a randomly generated secret of at least 32 characters. Keep the actual secret private. Never commit `.env`.

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
curl -k -i https://localhost/health
curl -k -i https://localhost/api/doctors
```

The health endpoint should return HTTP 200 when the database connection is healthy. The doctors endpoint returns synthetic doctor records.

The `-k` option disables certificate verification for this local self-signed certificate only. Do not use this as a production TLS configuration.

## Configuration

The following variables are used by the application and Compose configuration:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Runtime environment |
| `PORT` | API listening port; defaults to `3000` in the container |
| `MONGODB_URI` | MongoDB connection URI |
| `JWT_SECRET` | Secret used to sign and verify JWTs |

See `.env.example` for the starter configuration. Use a strong, private `JWT_SECRET` for every environment. Never store real secrets in Git.

The optional seed script requires `SEED_PATIENT_PASSWORD` and `SEED_ADMIN_PASSWORD`, each at least 12 characters long. The script is restricted to a local MongoDB target. Set these values locally only if seeding is needed; do not publish them.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Application and database health |
| GET | `/` | API root information |
| POST | `/api/auth/register` | Register a patient |
| POST | `/api/auth/login` | Authenticate and obtain a JWT |
| GET | `/api/doctors` | List doctors |
| POST | `/api/doctors` | Create a doctor; admin role required |
| POST | `/api/appointments` | Book an appointment; patient role required |
| GET | `/api/appointments/my` | List the authenticated patient's appointments |
| PATCH | `/api/appointments/:id/cancel` | Cancel the patient's confirmed appointment |
| PATCH | `/api/appointments/:id/reschedule` | Reschedule the patient's confirmed appointment |

Protected endpoints require a bearer token:

```text
Authorization: Bearer <JWT>
```

Registration is restricted to the patient role. Doctor creation requires an authenticated admin. Appointment operations require an authenticated patient.

Booking and rescheduling validate identifiers and future appointment times. A unique partial MongoDB index on doctor and appointment time for confirmed appointments prevents conflicting confirmed bookings. Duplicate-key errors are mapped to HTTP 409 Conflict.

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
docker build -t hospital-appointment-platform:local .
```

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
curl -k -i https://localhost/health
```

### Recover a stopped API container

```bash
docker compose up -d api
docker compose ps
curl -k -i https://localhost/health
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
| Nginx HTTPS | 443 | `127.0.0.1:443` |
| API | 3000 | Internal Compose network only |
| MongoDB | 27017 | `127.0.0.1:27018` |

The API is reached through Nginx. MongoDB is bound to loopback and should not be exposed directly to the public internet.

HTTP port 80 is not configured; requests should use `https://localhost` in the current local setup.

## Known Limitations

- The HTTPS certificate is self-signed and suitable only for local demonstration.
- The CI workflow builds but does not publish a versioned image to a registry.
- The deployment currently runs locally using Docker Compose; a public cloud deployment has not been demonstrated by this setup.
- Monitoring dashboards and metrics export have not been verified as implemented.
- Backup and restoration have been tested locally; this is not a substitute for off-host, encrypted, retention-managed backups.
- Appointment conflict protection is implemented through a MongoDB unique partial index; production behavior should also be tested under concurrent requests against a real running database.
- The service uses synthetic records only. Do not add real patient data or other sensitive information.
- Features not verified in the repository or in the current test evidence must not be described as complete.

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
├── tests/
├── scripts/seed.js
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
