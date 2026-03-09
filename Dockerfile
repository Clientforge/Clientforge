# ============================================
# ClientForge.ai — Production Dockerfile
# Multi-stage: build frontend, serve everything from Node
# ============================================

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/

# Copy built frontend into the path the backend expects
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy landing page (marketing site)
COPY landing/ ./landing/

# Non-root user for security
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001
USER appuser

EXPOSE 3000

WORKDIR /app/backend
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.js && node src/index.js"]
