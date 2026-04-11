# Wave 0, Task 4: Enter Crew Roster and Routes

> **Priority:** MEDIUM — Required for dispatch operations to work.
> **Reference docs:** L-2 (Crew Roster & Division Setup), L-3 (Seasonal Route Configuration)

---

## What This Is

Sunset Services has 7 crews across 3 divisions. This data needs to be entered into the CRM so the Dispatch Board, crew assignment, and route management features work correctly.

## Pre-Requisites
- [ ] Task 3 complete (V1 deployed to production)

## What Needs to Be Entered

### Crew Roster (from L-2)
This is done through the CRM UI (Settings > Crew Management):
- Create each crew with their name and assigned division
- Add crew members (crew leaders and crew members) with roles
- Assign pay rates if applicable

### Division Assignment
Crews belong to one of 4 divisions:
- `landscaping_maintenance` — Weekly lawn maintenance crews
- `landscaping_projects` — One-time project crews
- `hardscape` — Hardscape installation crews
- `snow_removal` — Snow removal crews

### Route Configuration (from L-3)
- Create seasonal routes for landscape maintenance
- Assign properties to routes (which crew visits which properties on which day)
- Configure route schedules (Monday crew 1 does these properties, etc.)

## How to Do This

This task is primarily done through the CRM web interface, not through code. Erick or Marcin will need to:

1. Log in to the CRM at app.sunsetapp.us (or staging.sunsetapp.us to test first)
2. Go to Settings > Crew Management
3. Add crews, crew members, and assign to divisions
4. Go to Routes > Route Management
5. Create routes and assign properties to routes

### If bulk import is needed:
Claude Code can help create a seed script to import crew data from a spreadsheet. Ask Erick or Marcin to provide the crew roster in a spreadsheet format.

## Done When
- [ ] All 7 crews created in the system
- [ ] Crew members assigned to crews with correct roles
- [ ] Divisions properly assigned
- [ ] Routes created for the current season
- [ ] Properties assigned to routes
- [ ] Dispatch Board shows crews and routes correctly
