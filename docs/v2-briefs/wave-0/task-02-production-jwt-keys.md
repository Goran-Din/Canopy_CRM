# Wave 0, Task 2: Generate Production JWT Key Pair

> **Priority:** HIGH — Required before production deployment.
> **No branch needed** — This is a server configuration task, not a code change.

---

## What This Is

Canopy CRM uses RS256 (RSA) JWT tokens for authentication. Staging currently has its own key pair. Production MUST have a separate key pair — if production uses the same keys as staging, a token from staging would work on production (security risk).

## Steps

### Step 1: Generate the production RSA key pair

Run these commands on your local machine or on the production server (VM101):

```bash
# Generate 2048-bit RSA private key (PKCS#8 format)
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048

# Extract the public key from the private key
openssl rsa -pubout -in private.pem -out public.pem
```

This creates two files:
- `private.pem` — The private key (used to SIGN tokens). Keep this secret.
- `public.pem` — The public key (used to VERIFY tokens). Can be shared.

### Step 2: Choose how to provide keys to production

The Canopy CRM API supports two methods (configured in `api/src/config/env.ts`):

**Option A: Environment Variables (Recommended for Docker/Dokploy)**
Set these in your `.env.production` file or in Dokploy's environment settings:
```
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...(your key with \n for newlines)...-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANB...(your key with \n for newlines)...-----END PUBLIC KEY-----"
```

To convert the PEM file to a single line with `\n` escapes:
```bash
cat private.pem | tr '\n' '|' | sed 's/|/\\n/g'
cat public.pem | tr '\n' '|' | sed 's/|/\\n/g'
```

**Option B: File Paths (if mounting files into the container)**
```
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
```
Mount the keys directory as a Docker volume.

### Step 3: Verify the keys work

After deploying to production, test by logging in. If the keys are wrong, the API will fail to start or login will return 500 errors.

## Security Rules
- NEVER commit production keys to git
- NEVER use the same keys for staging and production
- Store the private key backup in a secure location (password manager, encrypted vault)
- The `.dockerignore` file already excludes the `keys/` folder from Docker images

## Done When
- [ ] Production RSA key pair generated (2048-bit)
- [ ] Keys configured in production environment (via env vars or mounted files)
- [ ] Keys are NOT committed to the git repository
- [ ] Backup of production private key stored securely
