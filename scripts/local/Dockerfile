# syntax=docker/dockerfile:1
FROM node:22.23.2-bookworm AS dependencies
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_HOME=/usr/local/share/corepack \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CI=1
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY vendor/parlor ./vendor/parlor
RUN corepack enable \
    && corepack prepare pnpm@10.22.0 --activate \
    && pnpm install --frozen-lockfile --child-concurrency=1 --network-concurrency=4 \
    && chown -R ${LOCAL_UID}:${LOCAL_GID} /workspace

FROM dependencies AS development
# Runtime HOME is isolated; reuse the package manager baked into this image.
ENV COREPACK_ENABLE_NETWORK=0
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
# .dockerignore applies to builds AND Compose watch. No workspace bind mount.
COPY --chown=${LOCAL_UID}:${LOCAL_GID} . .
EXPOSE 3000
CMD ["node", "scripts/local/container.mjs", "app"]

FROM development AS qa
# Chromium and its OS dependencies match the lockfile's @playwright/test.
RUN pnpm exec playwright install --with-deps chromium
CMD ["node", "scripts/local/container.mjs", "qa"]
