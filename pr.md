# Add donation reliability and operational safeguards

## Summary

This PR addresses backend issues #28, #29, #30, and #31:

- Adds required `Idempotency-Key` support to donation recording, with 24-hour
  retention and duplicate-request short-circuiting.
- Adds bounded donation history pagination with frontend loading of older pages.
- Extends `/health` with a fast Soroban RPC probe and degraded dependency status.
- Documents Railway PostgreSQL backup verification, restore, and restore-drill
  procedures.

## API changes

- `POST /api/donations` now requires an `Idempotency-Key` header.
- `GET /api/donations` accepts `page` and `limit`; `limit` defaults to 20 and is
  capped at 100.
- Donation history responses now return `items` and `pagination`.
- `/health` reports `dependencies.sorobanRpc` and returns `degraded` when RPC is
  unavailable while keeping the backend responsive.

## Validation

- Backend build passes.
- Backend Jest suite passes: 67 tests.
- Workspace diagnostics report no errors in the touched frontend files.

## Deployment notes

- Apply the Prisma schema to the target database with the deployment's normal
  Prisma migration or `db push` workflow.
- Enable and verify Railway automated backups in the production database
  service. The repository includes the restore runbook, but Railway account
  access is required to perform the backup verification and restore drill.
