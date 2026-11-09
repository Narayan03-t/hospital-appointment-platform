# Hospital Appointment Platform — Architecture

## 1. Overview

The Hospital Appointment Platform is a containerized REST API for doctor appointment scheduling. It uses synthetic data and is designed to demonstrate reproducible deployment, basic security, observability, and recovery.

## 2. Architecture Diagram

The diagram below describes the current local deployment and continuous integration workflow.

<img width="992" height="1020" alt="mermaid-diagram" src="https://github.com/user-attachments/assets/4e3ec487-cd41-40e5-bb55-4259a3116ae1" />

## 3. Components

| Component | Responsibility |
|---|---|
| Nginx | Terminates local TLS and forwards HTTPS requests to the API |
| Node.js / Express | Implements health checks, authentication, doctor endpoints, and appointment operations |
| MongoDB | Stores users, doctors, and appointments |
| Docker Compose | Coordinates containers, health checks, networking, and persistent storage |
| GitHub Actions | Runs linting, automated tests, and a Docker image build |
| MongoDB backup archive | Supports local database restoration and recovery verification |

## 4. Network and Ports

| Service | Port | Exposure |
|---|---:|---|
| Nginx HTTPS | 443 | Bound to `127.0.0.1:443` on the host |
| API | 3000 | Internal Compose network; reached through Nginx |
| MongoDB | 27017 | Bound to `127.0.0.1:27018` on the host |

The API and MongoDB communicate over the Compose bridge network. MongoDB is not published on a public interface in the current local setup.

HTTP port 80 is not configured in the current deployment. The local TLS certificate is self-signed and is not suitable for public production use.

## 5. Request Flow

1. A client sends an HTTPS request to the local Nginx endpoint.
2. Nginx forwards the request to the API on the internal Compose network.
3. Express applies the relevant middleware and route authorization.
4. The API validates input and reads or updates MongoDB through Mongoose.
5. The API returns the response; structured request logs capture the HTTP method, path, status, duration, and timestamp.

## 6. Appointment Conflict Protection

Confirmed appointments have a unique partial MongoDB index on doctor and appointment time. This prevents two confirmed appointments from occupying the same doctor/time combination. Duplicate-key conflicts are mapped to HTTP 409 Conflict.

## 7. CI Workflow

The `.github/workflows/ci.yml` workflow runs for pushes and pull requests targeting `main`.

The current pipeline:

1. Checks out the repository.
2. Sets up Node.js 22.
3. Installs dependencies using `npm ci`.
4. Runs ESLint.
5. Runs the Jest test suite.
6. Builds a Docker image tagged with the commit SHA.

The workflow builds the image but does not currently publish it to a container registry.

## 8. Reliability and Recovery

- MongoDB data persists in the `mongodb_data` named volume.
- Docker Compose health checks monitor MongoDB and the API.
- Structured JSON request logs support troubleshooting.
- A compressed database archive was restored successfully into a separate test database.
- A manual API stop-and-recovery drill was performed, followed by a successful HTTPS health check.

These local demonstrations do not establish public cloud availability, automated monitoring alerting, or off-site backup retention.

## 9. Security Boundaries

- JWT authentication and role-based authorization protect patient appointment operations and administrative doctor creation.
- Passwords are hashed with bcrypt.
- The API runs as a non-root user in its container.
- MongoDB host exposure is limited to loopback.
- Secrets and local TLS private keys must remain outside version control.
- The self-signed TLS certificate is for local demonstration only.

## 10. Current Limitations

- The deployment is local Docker Compose, not a verified public cloud deployment.
- CI does not publish an image to a registry.
- Metrics export and alerting have not been verified as implemented.
- The TLS certificate is not publicly trusted.
- The service is a focused appointment API, not a complete hospital management system.
