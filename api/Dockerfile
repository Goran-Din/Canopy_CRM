# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files + api package.json
COPY package.json package-lock.json ./
COPY api/package.json ./api/

# Create stub for frontend workspace so npm ci doesn't fail
RUN mkdir -p frontend && echo '{"name":"canopy-crm-frontend","version":"0.1.0","private":true}' > frontend/package.json

RUN npm ci --workspace=api

# Copy API source and build
COPY api/src/ ./api/src/
COPY api/tsconfig.json ./api/
RUN npm run build --workspace=api

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY api/package.json ./api/
RUN mkdir -p frontend && echo '{"name":"canopy-crm-frontend","version":"0.1.0","private":true}' > frontend/package.json
RUN npm ci --workspace=api --omit=dev && npm cache clean --force

# Copy compiled output
COPY --from=builder /app/api/dist/ ./api/dist/

# Copy runtime assets
COPY api/db/ ./api/db/

WORKDIR /app/api

EXPOSE 3000

CMD ["node", "dist/index.js"]
