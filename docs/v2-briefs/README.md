# V2 Build Briefs

> **These are step-by-step task instructions for building Canopy CRM V2.**
> Prepared by Claude Cowork. Executed by Claude Code.

---

## How This Works

1. **Claude Cowork** reads the V2 Knowledge files (130 spec documents) and creates detailed briefs for each task.
2. **You** open Claude Code in the `canopy_crm` directory.
3. **You tell Claude Code** which brief to read: `"Read docs/v2-briefs/wave-1/task-01-migrations-020-021-job-numbers.md and do it"`
4. **Claude Code** reads the brief and builds it.
5. **You test**, then move to the next task.

---

## Folder Structure

```
docs/v2-briefs/
├── README.md          <- You are here
├── wave-0/            <- Pre-requisites (before any V2 code)
│   ├── task-01-fix-nan-dashboard.md         (DONE)
│   ├── task-02-production-jwt-keys.md
│   ├── task-03-deploy-to-production.md      (DONE)
│   ├── task-04-crew-data-entry.md
│   ├── task-05-contract-templates.md
│   └── task-06-uat-testing.md
├── wave-1/            <- Foundation (migrations 020-034)
│   ├── task-01-migrations-020-021-job-numbers.md
│   ├── task-02-migrations-022-023-diary-photos.md
│   ├── task-03-migration-024-xero-items.md
│   ├── task-04-migration-025-quote-builder.md
│   ├── task-05-migration-026-file-storage.md
│   ├── task-06-migration-027-property-v2-fields.md
│   ├── task-07-migration-028-property-service-history.md
│   ├── task-08-migration-029-service-tiers.md
│   ├── task-09-migration-030-service-occurrences.md
│   ├── task-10-migration-031-billing-schedule.md
│   ├── task-11-migration-032-billing-milestones.md
│   ├── task-12-migration-033-automation-engine.md
│   └── task-13-migration-034-customer-feedback.md
├── wave-2/            <- Core Modules (7 tasks, 64 API endpoints) ✅ COMPLETE
│   ├── task-01-job-pipeline.md           (DONE — 29 tests, 755 total)
│   ├── task-02-file-management.md        (DONE — 24 tests, 779 total)
│   ├── task-03-quote-builder.md          (DONE — 21 tests, 800 total)
│   ├── task-04-e-signature.md            (DONE — 18 tests, 818 total)
│   ├── task-05-service-occurrences.md    (DONE — 13 tests, 831 total)
│   ├── task-06-billing-engine.md         (DONE — 13 tests, 844 total)
│   └── task-07-property-knowledge-card.md (DONE — 13 tests, 857 total)
├── wave-3/            <- Supporting Modules
├── wave-4/            <- API & Integrations
├── wave-5/            <- Frontend - New UI
├── wave-6/            <- Frontend - Updates
├── wave-7/            <- Workflows & Reports
└── wave-8/            <- Config, QA & Launch
```

## Brief Naming Convention

`task-NN-short-description.md`

- Task numbers are sequential within each wave
- Each brief has: context, SQL, files to change, testing instructions, and done criteria

## Wave 1 Summary (13 tasks, 15 migrations)

| Task | Migration(s) | What it creates |
|------|-------------|-----------------|
| 01 | 020-021 | Job number sequence + Job V2 fields + Job badges |
| 02 | 022-023 | Job diary entries + Job photos |
| 03 | 024 | Xero items cache |
| 04 | 025 | Quote builder (quotes, sections, line items, signatures) |
| 05 | 026 | File storage (folders, files, access log) + deferred FKs |
| 06 | 027 | Property V2 fields (17 new columns) |
| 07 | 028 | Property service history |
| 08 | 029 | Service tiers on contracts |
| 09 | 030 | Service occurrences |
| 10 | 031 | Billing schedule + Invoice drafts |
| 11 | 032 | Hardscape billing milestones |
| 12 | 033 | Automation configs + Automation log |
| 13 | 034 | Customer feedback |

## How to Execute Wave 1

Tell Claude Code to run each task in order:

```
Read docs/v2-briefs/wave-1/task-01-migrations-020-021-job-numbers.md and do it
```

After each task, run: `npm run migrate:up -w api && npm run test -w api`

Then move to the next task number.

## Wave 2 Summary (7 tasks, 64 API endpoints)

| Task | Module | What it builds | Build Order |
|------|--------|----------------|-------------|
| 01 | Job Pipeline (D-23) | Diary, photos, badges, job numbers, status transitions | FIRST |
| 02 | File Management (D-33) | R2 uploads, folders, signed URLs, access control | FIRST (parallel with 01) |
| 03 | Quote Builder (D-24) | Sections, line items, PDF generation, versioning, templates | After 01 + 02 |
| 04 | E-Signature (D-25) | Public signing page, Work Order conversion, signed PDFs | After 03 |
| 05 | Service Occurrences (D-28) | Season setup, bulk assignment, service lists, skip tracking | After 01 |
| 06 | Billing Engine (D-29) | Draft generation, approval workflow, Xero push, milestones | After 05 |
| 07 | Property Knowledge Card (D-34) | Estimation assistant, service history, crew notes | After 01 + 05 |

## How to Execute Wave 2

Tell Claude Code to run each task in order:

```
Read docs/v2-briefs/wave-2/task-01-job-pipeline.md and do it
```

**Important:** Wave 2 tasks have dependencies. Follow the build order:
1. Tasks 01 + 02 (can run in parallel)
2. Task 03 (needs 01 + 02)
3. Task 04 (needs 03)
4. Task 05 (needs 01)
5. Task 06 (needs 05)
6. Task 07 (needs 01 + 05)

## Wave 2 Results

| Task | Module | New Tests | Running Total |
|------|--------|-----------|---------------|
| 01 | Job Pipeline | 29 | 755 |
| 02 | File Management | 24 | 779 |
| 03 | Quote Builder | 21 | 800 |
| 04 | E-Signature | 18 | 818 |
| 05 | Service Occurrences | 13 | 831 |
| 06 | Billing Engine | 13 | 844 |
| 07 | Property Knowledge Card | 13 | 857 |

**Total: 131 new tests, 857 total passing, 64 API endpoints built.**

## Current Wave

**Wave 3 — Supporting Modules** (briefs need to be prepared)

See `V2_Wave_Tracker.md` in the project documentation folder for current status.
