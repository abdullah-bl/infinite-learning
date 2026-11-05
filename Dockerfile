# One executable: OneBase with this repo's functions and the built web app compiled in.
# The web app is static (single-page mode), so OneBase serves it, answering any path that is not
# a file with index.html and leaving /api, /_onebase and /_admin to itself.
FROM oven/bun:1.4.4 AS build
WORKDIR /src
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:binary

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/dist/infinite-learning /usr/local/bin/infinite-learning
# SQLite lives on the Fly volume mounted at /data.
VOLUME /data
EXPOSE 8080
CMD ["infinite-learning", "--port", "8080", "--data", "/data", "--trust-proxy"]
