# CareFlow Hospital Appointment Platform — Architecture

## 1. Overview

CareFlow is a containerized React/Vite and Node.js/Express appointment application with separate patient, doctor, and hospital-admin dashboards. It uses synthetic data and is designed to demonstrate reproducible deployment, role-based access control, appointment conflict protection, basic security, observability, and recovery.

## 2. Architecture Diagram

The diagram below describes the current local deployment and continuous integration workflow.

<img width="992" height="1020" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/4e3ec487-cd41-40e5-bb55-4259a3116ae1" />

## 3. Components

| Component | Responsibility |
|---|---|
| React / Vite | Builds and serves the responsive CareFlow patient, doctor, and admin dashboards through the Nginx image |
| Nginx | Terminates local TLS, serves the Vite `dist` output, provides SPA fallback, and forwards `/api` and `/health` to the API |
| Node.js / Express | Implements health checks, authentication, role authorization, doctor/admin endpoints, appointments, and notifications |
| MongoDB / Mongoose | Stores users, linked doctor profiles, appointments, notifications, and availability slots |
| Docker Compose | Coordinates containers, health checks, networking, and persistent storage |
| GitHub Actions | Runs linting, automated tests, and a Docker image build |
| MongoDB backup archive | Supports local database restoration and recovery verification |

## 4. Network and Ports

| Service | Port | Exposure |
|---|---:|---|
| Nginx HTTPS | 443 | Published as `127.0.0.1:8443` on the host |
| API | 3000 | Internal Compose network; reached through Nginx |
| MongoDB | 27017 | Internal Compose network in the current override; no host port |

The API and MongoDB communicate over the Compose bridge network. The base Compose file contains a loopback `27018:27017` mapping, but the preserved `compose.override.yaml` resets that mapping for the current Docker Desktop environment. MongoDB is therefore reached internally as `mongodb:27017`.

HTTP port 80 is not configured in the current deployment. The local TLS certificate is self-signed and is not suitable for public production use.

## 5. Request Flow

1. A browser loads `https://localhost:8443`; Nginx serves the Vite SPA and falls back to `index.html` for client routes.
2. The frontend sends `/api/*` requests with a JWT bearer token when authenticated.
3. Nginx forwards API requests to Express on the internal Compose network.
4. Express applies authentication, role authorization, input validation, and route/service logic.
5. Mongoose reads or updates MongoDB; structured request logs capture method, path, status, duration, and timestamp.
6. The API returns JSON to the frontend. `/health` reports HTTP 200 only when the MongoDB connection is ready.

## 6. Role and Appointment Workflow

- Patient registration is public, but registration can create only `patient` accounts.
- An admin creates a doctor account and linked `Doctor` profile through the admin API. Doctors authenticate with the normal JWT login flow.
- Patients submit requests with a future time and reason. Requests begin as `pending`.
- Doctors can approve or reject only pending appointments assigned to their linked profile. Approval may require an explicitly configured availability slot.
- Decisions create persisted in-app notifications for the patient; new requests notify the linked doctor. Notifications have read/unread state.
- Appointment statuses are `pending`, `approved`, `confirmed`, `rejected`, `cancelled`, and `completed`. Current status and document timestamps are persisted; there is no separate status-transition history collection.
- Admin endpoints are restricted server-side to the `admin` role. Admins manage accounts and reports but do not approve or reject appointments.

## 7. Appointment Conflict Protection

The `doctor_active_appointment_slot` unique partial MongoDB index covers doctor and appointment time for `approved` and `confirmed` appointments. This prevents two active appointments from occupying the same doctor/time combination, including concurrent approval attempts. Duplicate-key conflicts are mapped to HTTP 409 Conflict. The older confirmed-only index is preserved for existing data compatibility.

## 8. CI Workflow

The `.github/workflows/ci.yml` workflow runs for pushes and pull requests targeting `main`.

The current pipeline:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Installs dependencies using `npm ci`.
4. Runs ESLint.
5. Runs the Jest test suite against the CI MongoDB service.
6. Installs frontend dependencies and builds the Vite frontend.
7. Runs the frontend ESLint check.
8. Builds a Docker image tagged with the commit SHA.

The workflow builds the image but does not currently publish it to a container registry.

## 9. Reliability and Recovery

- MongoDB data persists in the `mongodb_data` named volume.
- Docker Compose health checks monitor MongoDB and the API.
- Structured JSON request logs support troubleshooting.
- A compressed database archive was restored successfully into a separate test database.
- A manual API stop-and-recovery drill was performed, followed by a successful HTTPS health check.

These local demonstrations do not establish public cloud availability, automated monitoring alerting, or off-site backup retention.

## 10. Security Boundaries

- JWT authentication and role-based authorization protect patient appointment operations, doctor decisions/availability, notifications, and admin APIs.
- Passwords are hashed with bcrypt.
- The API runs as a non-root user in its container.
- MongoDB has no host-port exposure in the current override and is reachable by the API only through the Compose network.
- Secrets and local TLS private keys must remain outside version control.
- The self-signed TLS certificate is for local demonstration only.

## 11. Current Limitations

- The deployment is local Docker Compose, not a verified public cloud deployment.
- CI does not publish an image to a registry.
- Metrics export and alerting have not been verified as implemented.
- The TLS certificate is not publicly trusted.
- The service is a focused appointment API, not a complete hospital management system.
- Notifications are persisted in-app only; SMTP email delivery is not implemented.
- Account deactivation blocks future login and disables the linked doctor profile, but already-issued JWTs are not independently revoked before their normal expiry.
