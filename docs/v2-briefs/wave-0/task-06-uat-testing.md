# Wave 0, Task 6: User Acceptance Testing (UAT) with Erick and Marcin

> **Priority:** MEDIUM — V1 must be validated by end users before V2 complexity is added.
> **Do this AFTER:** All other Wave 0 tasks are complete.

---

## What This Is

Erick (owner) and Marcin (division manager) need to actually use the V1 system and confirm it works for their daily operations. This catches any bugs or usability issues before we add V2 features on top.

## Pre-Requisites
- [ ] Task 1 complete ($NaN bug fixed)
- [ ] Task 3 complete (V1 on production)
- [ ] Task 4 complete (crew data entered)
- [ ] Task 5 complete (contract templates set up)

## UAT Checklist for Erick (Owner Role)

### Dashboard
- [ ] Owner Dashboard loads without errors
- [ ] Revenue cards show correct dollar amounts (not $NaN)
- [ ] Customer count shows 301
- [ ] Property count shows 315

### Customer Management
- [ ] Can view customer list
- [ ] Can search customers by name, phone, email
- [ ] Can open a customer record and see all details
- [ ] Can create a new customer
- [ ] Can edit an existing customer
- [ ] Customer numbers (SS-XXXX) are displayed correctly

### Property Management
- [ ] Can view property list
- [ ] Can see properties linked to customers
- [ ] Can view property details (address, lawn area, etc.)

### Contracts
- [ ] Can create a new service contract
- [ ] Can view existing contracts
- [ ] Contract templates are available

### Jobs & Scheduling
- [ ] Can create a new job
- [ ] Can view the Dispatch Board
- [ ] Can drag and drop jobs on the Dispatch Board
- [ ] Jobs appear in day and week views

### Invoicing
- [ ] Can create a new invoice
- [ ] Can view invoice list
- [ ] Can push an invoice to Xero
- [ ] Invoice statuses update correctly

### Integrations
- [ ] Xero connection works (can sync customers and invoices)
- [ ] Google Drive link works from customer records

## UAT Checklist for Marcin (Division Manager Role)

### Dashboard
- [ ] Division Dashboard loads correctly
- [ ] Shows only their division's data
- [ ] Revenue cards show correct amounts

### Daily Operations
- [ ] Can see assigned jobs for the day
- [ ] Can assign jobs to crews
- [ ] Can update job status (in progress, completed)

### Crew Management
- [ ] Can view crew members in their division
- [ ] Can see crew schedules

## UAT Checklist — Crew Mobile PWA

- [ ] Can access mobile app from phone
- [ ] Can log in with crew credentials
- [ ] Start Day flow works
- [ ] Can view assigned jobs
- [ ] Can complete job checklist
- [ ] Can upload photos
- [ ] Clock in/out works
- [ ] Spanish language toggle works

## How to Run UAT

1. Schedule a 2-hour session with Erick and Marcin
2. Have them work through the checklists above on production
3. Note any bugs or issues they find
4. Fix any critical issues before starting V2

## Done When
- [ ] Erick has completed all owner checklist items
- [ ] Marcin has completed all division manager checklist items
- [ ] Crew mobile PWA tested by at least one crew member
- [ ] All critical bugs found during UAT are fixed
- [ ] Erick and Marcin give verbal approval to proceed to V2

---

## After UAT Passes: Wave 0 is Complete

Once all 6 tasks are done and UAT is approved, update the Wave Tracker:
- Wave 0 status → **Completed**
- Current Wave → **Wave 1 — Foundation**

Then come to Claude Cowork and say: "Wave 0 is complete. Let's plan Wave 1."
