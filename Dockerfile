# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS dependencies
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       python3 \
       make \
       g++ \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NPM_CONFIG_FETCH_RETRIES=5
ENV NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000
ENV NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
ENV NPM_CONFIG_LOGLEVEL=warn

COPY package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

# npm runs only inside Docker. No host Node.js installation is required.
RUN npm install --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app
COPY . .

RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/server/package.json /app/apps/server/package.json
COPY --from=build /app/apps/server/dist /app/apps/server/dist
COPY --from=build /app/apps/web/dist /app/apps/web/dist
COPY --from=build /app/prisma /app/prisma
COPY --from=build /app/docker /app/docker

RUN chmod +x /app/docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker/entrypoint.sh"]
