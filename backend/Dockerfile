# Stage 1: Build
FROM rust:1.88-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Cache dependencies by building a dummy main first
COPY Cargo.toml ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs
RUN cargo build --release 2>/dev/null || true
RUN rm -rf src

# Copy actual source and migrations
COPY src ./src
COPY migrations ./migrations

# Build the real binary (touch main.rs to invalidate cache)
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim AS runtime

WORKDIR /app

# P1-4: Create a dedicated non-root system user so the process cannot write outside
# its own working directory even if a path-traversal bug exists in the upload handler.
RUN addgroup --system appuser && adduser --system --ingroup appuser appuser

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    gosu \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/server ./server
COPY --from=builder /app/migrations ./migrations
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# P1-4: Pre-create uploads dir. The entrypoint re-chowns it at runtime so named
# volume mounts (which overwrite image layers) are always writable by appuser.
RUN mkdir -p /app/uploads

EXPOSE 3001

# P1-4: Entrypoint runs as root, fixes /app/uploads ownership, then drops to
# appuser via gosu before exec-ing the server.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["./server"]
