# Wave 0, Task 3: Deploy V1 to Production

> **Priority:** HIGH — V1 must be on production before V2 development begins.
> **No code branch needed** — This is a deployment/infrastructure task.

---

## What This Is

V1 is currently running on staging (staging.sunsetapp.us). It needs to be deployed to production (app.sunsetapp.us) on VM101 via Dokploy. Production uses a separate Docker Compose file, separate database, and separate JWT keys.

## Pre-Requisites
- [ ] Task 2 complete (production JWT keys generated)
- [ ] Task 1 complete ($NaN bug fixed and merged to staging)

## Steps

### Step 1: Create the production environment file

Create `.env.production` on the production server with all required variables. Use `.env.example` as the template.

Key differences from staging:
```
NODE_ENV=production
DB_NAME=canopy_crm_prod        # Different from staging (canopy_crm_staging)
FRONTEND_URL=https://app.sunsetapp.us
API_URL=https://api.sunsetapp.us
LOG_LEVEL=warn                  # Not debug in production
JWT_PRIVATE_KEY=<production private key>   # Different from staging!
JWT_PUBLIC_KEY=<production public key>     # Different from staging!
DB_PASSWORD=<strong unique password>       # Not the default "changeme"
```

All other variables (R2, Resend, Redis, Xero, etc.) should be set to production values.

### Step 2: Deploy using Docker Compose

On VM101, in the project directory:

```bash
# Pull latest code from main branch
git pull origin main

# Build and start production containers
docker compose -f docker-compose.production.yml up -d --build
```

This starts 4 containers:
- **API** (Node.js 20) — port 3000 (internal only)
- **Frontend** (Nginx) — port 80 (public)
- **PostgreSQL 16** — persistent volume `pgdata-production`
- **Redis 7** — persistent volume `redisdata-production`

### Step 3: Run database migrations

Once containers are running:

```bash
# Execute migrations inside the API container
docker compose -f docker-compose.production.yml exec api npm run migrate:up
```

This applies all 19 V1 migrations to the production database.

### Step 4: Import customer data

The 301 customers and 315 properties need to be imported into production (same import that was done on staging). Use the import CSV:

```bash
# Copy the import file into the container if needed
docker cp sunset_customers_import.csv <api-container>:/app/

# Run the import script
docker compose -f docker-compose.production.yml exec api npm run db:seed
```

### Step 5: Configure Dokploy

In Dokploy (the container management tool):
1. Add the production deployment as a new project
2. Point it to the `docker-compose.production.yml` file
3. Configure auto-restart on failure
4. Set up health check monitoring

### Step 6: Verify production is working

1. Open https://app.sunsetapp.us — should show the login page
2. Log in with an admin account — should see the Owner Dashboard
3. Verify customer list shows 301 customers
4. Verify property list shows 315 properties
5. Check dashboard revenue cards show dollar amounts (not $NaN)
6. Test the crew mobile PWA
7. Test the client portal

## Architecture Reference

From `docker-compose.production.yml`:
- All 4 services on the `canopy-production` bridge network
- PostgreSQL health check: `pg_isready` every 10s, 5 retries
- Redis health check: `redis-cli ping` every 10s, 5 retries
- API and frontend restart policy: `unless-stopped`
- Database data persists in Docker volumes (survives container restarts)

## Done When
- [ ] All 4 containers running and healthy on VM101
- [ ] 19 migrations applied to production database
- [ ] 301 customers and 315 properties imported
- [ ] Login works with production JWT keys
- [ ] Dashboard loads without $NaN
- [ ] app.sunsetapp.us accessible and stable
- [ ] Dokploy configured for monitoring and auto-restart
