# Production Database Backups

SupportMe production PostgreSQL runs on Railway. Backups are a Railway project
setting and must be enabled on the production database before launch.

## Required policy

- Automated backups: enabled in the Railway PostgreSQL service's **Backups** tab.
- Frequency: daily, using Railway's managed backup schedule.
- Retention: keep the longest retention period available on the production plan;
  record the configured value in the deployment change log.
- Ownership: the production maintainer verifies the latest backup weekly and
  after any database migration.

## Verify backups

1. Open the production Railway project and select the PostgreSQL service.
2. Open **Backups** and confirm automated backups are enabled.
3. Confirm a recent successful backup exists and note its timestamp and
   retention window in the deployment log.
4. Repeat this check after changing the Railway plan or database service.

The Railway dashboard is the source of truth for whether backups are actually
running. This repository cannot inspect or enable a private Railway project.

## Restore procedure

1. Pause backend writes by scaling the backend down or putting it in maintenance
   mode. Preserve the current `DATABASE_URL` and application logs.
2. In Railway, choose the PostgreSQL service, select the known-good backup, and
   restore it to a new database service first. Do not overwrite the original
   database until validation succeeds.
3. Run the backend against the restored database with a temporary
   `DATABASE_URL`, then run `npx prisma db push` only if the restored schema is
   behind the checked-in schema.
4. Verify `GET /health`, authentication, creator lookup, donation listing, and
   a read-only dashboard request against the restored service.
5. Compare row counts for `User`, `Creator`, `Donation`, `Withdrawal`, and
   `Subscription` with the incident snapshot and inspect the newest records.
6. Update the production `DATABASE_URL` to the validated restored database,
   restart the backend, and confirm the health check and a read-only API request.
7. Keep the original database isolated until the incident is closed and the
   retention policy allows it to be removed.

## Restore drill

Run this procedure at least once before production launch and quarterly after
that. A drill is successful only when the restored service passes the checks in
step 4, row counts and representative records match step 5, and the elapsed
restore time is recorded. Never use production credentials or the production
database for the drill; use a non-production Railway project and anonymized data.