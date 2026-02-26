# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files + frontend package.json
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/

# Create stub for api workspace so npm ci doesn't fail
RUN mkdir -p api && echo '{"name":"canopy-crm-api","version":"0.1.0","private":true}' > api/package.json

RUN npm ci --workspace=frontend

# Copy frontend source and build
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/frontend/dist/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
