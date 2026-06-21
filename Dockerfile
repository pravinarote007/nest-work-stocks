# Stage 1 — build the React/Vite frontend.
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# No VITE_API_BASE → the app calls /api/ohlc on the same origin (served by FastAPI below).
RUN npm run build

# Stage 2 — Python backend that serves the API and the built SPA.
FROM python:3.12-slim
WORKDIR /app
COPY api/requirements.txt ./api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api/ ./api/
COPY --from=frontend /app/dist ./dist
ENV PORT=8000
EXPOSE 8000
# Railway provides $PORT; bind it from the api/ working dir.
CMD ["sh", "-c", "cd api && uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
