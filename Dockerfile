# ============================================
# ClientForge.ai — Production Dockerfile
# Multi-stage: build Vite apps, serve from Node
# ============================================

# Stage 1: Main app (React / Vite)
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Grace to Grace demo (Vite)
FROM node:20-alpine AS g2g-build
WORKDIR /app/grace-to-grace-web
COPY grace-to-grace-web/package*.json ./
RUN npm ci
COPY grace-to-grace-web/ .
RUN npm run build

# Stage 3: Production server
FROM node:20-alpine AS production
WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend/ ./backend/

# Static assets the Express app serves (must match paths in backend/src/app.js)
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=g2g-build /app/grace-to-grace-web/dist ./grace-to-grace-web/dist

# Marketing / legal HTML
COPY landing/ ./landing/

# Non-root user for security
RUN addgroup -g 1001 -S appuser && adduser -S appuser -u 1001
USER appuser

EXPOSE 3000

WORKDIR /app/backend
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.js && node src/index.js"]
