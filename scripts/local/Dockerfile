# syntax=docker/dockerfile:1
FROM rust:1.98.1-bookworm AS rust
FROM node:22.23.2-bookworm AS dependencies
COPY --from=rust /usr/local/cargo /usr/local/cargo
COPY --from=rust /usr/local/rustup /usr/local/rustup
ARG LOCAL_UID=1000
ARG LOCAL_GID=1000
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    COREPACK_HOME=/usr/local/share/corepack \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    CI=1 \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:${PATH}
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
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
RUN rustup target add wasm32-unknown-unknown \
    && cargo fetch --locked \
    && pnpm build:ui \
    && chown -R ${LOCAL_UID}:${LOCAL_GID} /usr/local/cargo /workspace/target /workspace/.ui-build /workspace/public/entry-wasm
EXPOSE 3000
CMD ["node", "scripts/local/container.mjs", "app"]

FROM development AS qa
# Chromium and its OS dependencies match the lockfile's @playwright/test.
RUN pnpm exec playwright install --with-deps chromium
CMD ["node", "scripts/local/container.mjs", "qa"]
