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

Verify the application:

```bash
curl -k -i https://localhost/health
curl -k -i https://localhost/api/doctors
```

Expected result: the health endpoint returns HTTP 200 and reports a connected database.

The `-k` flag bypasses certificate verification for the local self-signed certificate. It is for local testing only.

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
curl -k -i https://localhost/health
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
| HTTP 409 during booking | Check whether the doctor already has a confirmed appointment at that time |
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
- Keep MongoDB bound to loopback for the current local deployment.
- The API is accessible through Nginx on local HTTPS port 443.
- The local TLS certificate is self-signed and not publicly trusted.
- Validate configuration with `docker compose config --quiet`.
- Record timestamps, commit IDs, test output, and backup checksums when collecting submission evidence.
- Document incomplete features honestly; do not claim unverified monitoring, registry publishing, or cloud deployment.

## 11. Evidence Checklist

Before submission, collect:

- [ ] Successful GitHub Actions run for the submitted commit
- [ ] Lint and automated test results
- [ ] Docker Compose service status and HTTPS health response
- [ ] Appointment conflict and authorization test results
- [ ] Backup integrity check and checksum
- [ ] Restore verification and collection counts
- [ ] Failure and recovery demonstration
- [ ] Final architecture diagram and README
- [ ] Three-to-five-minute demonstration video
- [ ] Verified repository, workflow, and evidence links
