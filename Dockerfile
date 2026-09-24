# --- build: installs deps and builds the app with Bun ---
FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
# Optional extra CA (machines behind a TLS-inspecting proxy); absent on the server.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    bun install --frozen-lockfile

COPY . .

# Vite inlines VITE_* variables into the browser bundle, so they must exist at build time.
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN bun run build
# Self-contained migration runner, so the runtime image needs no node_modules.
RUN bun build scripts/migrate.ts --target=node --format=esm --outfile=migrate/migrate.mjs

# --- runtime: only the built server, migrations and the migration runner ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/.output ./.output
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/migrate/migrate.mjs ./migrate.mjs

USER node
EXPOSE 3000
# Applies pending migrations, then starts the server.
CMD ["sh", "-c", "node migrate.mjs && exec node .output/server/index.mjs"]
