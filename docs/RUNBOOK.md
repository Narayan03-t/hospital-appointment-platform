# Operations Runbook

## 1. Purpose and Scope

This runbook describes how to deploy, inspect, troubleshoot, back up, restore, and recover the local Hospital Appointment Platform.

The deployment uses Docker Compose, a Node.js/Express API, MongoDB, and an Nginx reverse proxy with a self-signed TLS certificate.

**Environment:** Local Docker Desktop / Docker Engine  
**Application data:** Synthetic data only  
**Public cloud deployment:** Not demonstrated by this runbook

## 2. Prerequisites

- Docker Engine or Docker Desktop with Compose support
- Git
- OpenSSL for generating the local TLS certificate
- A configured `.env` file containing a secure `JWT_SECRET`

Never commit `.env`, private keys, passwords, or database backup archives.

## 3. Deploy the Application

From the repository root:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Wait for MongoDB and the API to report healthy. Confirm that Nginx is running.

Verify the application through the published local HTTPS port:

```bash
curl -k -i https://localhost:8443/health
curl -k -i https://localhost:8443/api/doctors
```

Expected result: the health endpoint returns HTTP 200 and reports a connected database.

Open `https://localhost:8443` in a browser to use the CareFlow frontend. The browser warning is expected because the local certificate is self-signed; accept it only for this local demonstration. The `-k` flag bypasses certificate verification for command-line local testing only.

## 4. Service Status and Logs

Check service status:

```bash
docker compose ps
```

Inspect recent logs:

```bash
docker compose logs --tail=100 api
docker compose logs --tail=100 mongodb
docker compose logs --tail=100 nginx
```

Follow API logs in real time:

```bash
docker compose logs -f api
```

API request logs use JSON and include the method, path, HTTP status, request duration, and timestamp. Avoid sharing logs that may contain sensitive operational information.

## 5. Restart and Recovery

Restart the API:

```bash
docker compose restart api
```

If the API container is stopped, recreate or start it:

```bash
docker compose up -d api
```

Verify recovery:

```bash
docker compose ps
curl -k -i https://localhost:8443/health
```

If health checks fail, inspect the API and MongoDB logs, verify the `.env` configuration, and confirm that MongoDB is healthy before restarting dependent services.

### Failure and Recovery Drill

A manual failure drill was performed by stopping the API container with `docker compose kill api`. The API was subsequently started using `docker compose up -d api`, and the HTTPS health endpoint returned HTTP 200 with the database connected.

The configured restart policy is `unless-stopped`. An explicitly issued stop or kill is a manual stop action and does not, by itself, demonstrate automatic restart after an unexpected process crash.

## 6. Database Backup

MongoDB uses the persistent Docker volume `mongodb_data`.

Create a backup directory:

```bash
mkdir -p backups
```

Create a compressed database archive:

```bash
docker compose exec -T mongodb mongodump \
  --db hospital_appointments \
  --archive \
  --gzip > backups/hospital_appointments_$(date +%Y%m%d_%H%M%S).archive.gz
```

Verify the archive:

```bash
gzip -t backups/<backup-file>.archive.gz
sha256sum backups/<backup-file>.archive.gz
```

Replace `<backup-file>` with the actual filename.

Store backups securely outside the public repository. This local procedure does not provide off-site backup retention.

## 7. Restore Verification

A restore was tested against a separate database named `hospital_restore_test`, leaving the application database intact.

Example restore command:

```bash
docker compose exec -T mongodb mongorestore \
  --archive \
  --gzip \
  --nsFrom='hospital_appointments.*' \
  --nsTo='hospital_restore_test.*' \
  < backups/<backup-file>.archive.gz
```

Verify the restored collections and their document counts before considering the restore successful.

The recorded verification restored eight documents: three appointments, three users, and two doctors, with zero restore failures.

Do not restore over the active application database without a reviewed recovery plan and an additional backup.

## 8. Troubleshooting

| Symptom | Checks and actions |
|---|---|
| API is unhealthy | Inspect API logs and verify environment configuration |
| Database connection fails | Check MongoDB health, Compose networking, and `MONGODB_URI` |
| HTTPS connection fails | Check Nginx logs, certificate files, and port 443 binding |
| HTTP 401 | Verify that the request includes a valid bearer token |
| HTTP 403 | Verify the authenticated user's role and endpoint permissions |
| HTTP 409 during booking or approval | Check whether the doctor already has an approved or confirmed appointment at that time, or whether the requested approval time is not in the doctor's configured slots |
| Container is stopped | Inspect logs and service status, then start it with Compose |

## 9. Rollback

The GitHub Actions workflow builds a Docker image tagged with the commit SHA but does not publish it to a registry.

To identify the current version:

```bash
git rev-parse HEAD
docker image ls hospital-appointment-platform
```

Choose a known-good commit, preserve the current configuration and database backup, and rebuild the chosen version before redeployment. Validate application health and appointment behavior afterwards.

Database changes may not be compatible with older application versions. Never assume an application rollback also reverses database changes.

## 10. Security and Operational Notes

- Use synthetic patient and appointment records only.
- Keep secrets in local environment configuration, never in Git.
- Keep MongoDB internal to the Compose network for the current local deployment; the preserved override removes its host-port mapping.
- The API and frontend are accessible through Nginx at `https://localhost:8443`; Nginx listens on container port 443 and publishes host port 8443.
- The local TLS certificate is self-signed and not publicly trusted.
- Validate configuration with `docker compose config --quiet`.
- Record timestamps, commit IDs, test output, and backup checksums when collecting submission evidence.
- Document incomplete features honestly; do not claim unverified monitoring, registry publishing, or cloud deployment.

## 11. Evidence Checklist

- [x] Lint and automated test results
- [x] Docker Compose service status and HTTPS health response
- [x] Appointment conflict and authorization test results
- [x] Backup integrity check and checksum
- [x] Restore verification and collection counts
- [x] Failure and recovery demonstration
- [x] Final architecture diagram and README
- [ ] Successful GitHub Actions run for the submitted commit
- [ ] Three-to-five-minute demonstration video
- [ ] Verified repository, workflow, and evidence links

### Verified Appointment Conflict Test — 2026-11-09 and 2026-11-12

- The legacy MongoDB index `doctor_1_appointmentTime_1` was preserved. The current index `doctor_active_appointment_slot` enforces uniqueness on `doctor` and `appointmentTime` for approved and confirmed appointments.
- A temporary confirmed appointment was inserted successfully for synthetic data.
- A second confirmed appointment for the same doctor and time, using a different synthetic patient, was rejected with MongoDB error `E11000 duplicate key`.
- The temporary test appointment was deleted successfully.
- Cleanup verification returned `temporaryTestRecords: 0` and `totalAppointments: 3`. The three original appointments were preserved.
- Concurrent API verification — 2026-11-12: `tests/appointmentConcurrency.test.js` sent two simultaneous authenticated HTTP booking requests for the same doctor and appointment time against the dedicated local MongoDB test database.
- Expected and observed results: one request returned `201 Created`, the other returned `409 Conflict`, and exactly one confirmed appointment remained.
- The test uses synthetic patient and doctor records and cleans up its test records. The dedicated test database is `hospital_appointments_concurrency_test`.
- Local verification: all 4 Jest suites and all 29 tests passed. Frontend lint and production build also passed. GitHub Actions status remains dependent on the workflow run for the submitted commit.

## 12. CareFlow Role and Notification Checks

Use synthetic accounts only when demonstrating the workflows:

1. Register and log in as a patient at `https://localhost:8443`.
2. Select an available doctor and submit a future appointment request with a reason.
3. Log in with the linked doctor account, review the pending request, and approve or reject it. A rejection can include a reason.
4. Return to the patient dashboard and verify the appointment status and persisted notification. Use the Notifications view to mark one or all notifications read.
5. Log in as an admin and verify overview counts, doctor/patient search, account activation controls, and appointment reporting.
6. Confirm that patient and doctor tokens receive HTTP 403 from `/api/admin/*`.

The supported notification channel is in-app persistence. SMTP email delivery is not implemented.
